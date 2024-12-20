#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function main() {
  const [,, inputDirArg, outputDirArg] = process.argv;

  if (!inputDirArg || !outputDirArg) {
    console.error('Usage: node process_json.js <input_dir> <output_dir>');
    process.exit(1);
  }

  const inputDir = path.resolve(inputDirArg);
  const outputDir = path.resolve(outputDirArg);

  // Ensure outputDir exists
  await fs.mkdir(outputDir, { recursive: true });

  await processDirectory(inputDir, inputDir, outputDir);
}

async function processDirectory(currentDir, baseDir, outputDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, entryPath);
    const outputPath = path.join(outputDir, relativePath);

    if (entry.isDirectory()) {
      await fs.mkdir(outputPath, { recursive: true });
      await processDirectory(entryPath, baseDir, outputDir);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      await processJsonFile(entryPath, outputPath);
    }
  }
}

async function processJsonFile(inputPath, outputPath) {
  const data = await fs.readFile(inputPath, 'utf-8');
  let jsonData;
  try {
    jsonData = JSON.parse(data);
  } catch (err) {
    console.error(`Error parsing JSON file: ${inputPath}`, err);
    return;
  }

  const processedData = processJsonValue(jsonData);

  await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
}

const numericKeys = new Set([
  'net_amount',
  'total_amount',
  'total_tax_amount',
  'quantity',
  'unit_price',
  'amount',
  'freight_amount',
  'subtotal',
  'discount_amount',
  'discount_rate',
  'tax_amount',
  'tax_rate',
  'invoice_total',
  'amount_due',
  'previous_unpaid_amount',
  'payment_amount',
  'other_fees'
]);

function processJsonValue(value, key = null) {
  if (typeof value === 'string') {
    return cleanString(value, key);
  } else if (Array.isArray(value)) {
    return value.map(v => processJsonValue(v));
  } else if (value && typeof value === 'object') {
    const newObj = {};
    for (const [k, v] of Object.entries(value)) {
      newObj[k] = processJsonValue(v, k);
    }
    return newObj;
  }
  // For numbers, booleans, null, leave as is.
  return value;
}

function cleanString(str, key) {
  // Replace newline characters with space
  let cleaned = str.replace(/\n/g, ' ');
  // Reduce multiple whitespace sequences to a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  // Determine if we should convert to numeric
  if (key) {
    // Extract the last part of the key after any slash
    const lastKeyPart = key.includes('/') ? key.split('/').pop() : key;
    if (numericKeys.has(lastKeyPart)) {
      const numericValue = parseNumeric(cleaned);
      if (numericValue !== null) {
        return numericValue;
      }
    }
  }

  // Determine if string is all uppercase or all lowercase
  const isAllLower = cleaned === cleaned.toLowerCase();
  const isAllUpper = cleaned === cleaned.toUpperCase();

  if (isAllLower || isAllUpper) {
    cleaned = toCustomTitleCase(cleaned);
  }

  return cleaned;
}

function parseNumeric(str) {
  // Remove commas and attempt to parse as float
  const withoutCommas = str.replace(/,/g, '');
  const parsed = parseFloat(withoutCommas);
  if (!isNaN(parsed)) {
    return parsed;
  }
  return null; // Return null if not a valid number
}

function toCustomTitleCase(str) {
  const words = str.split(' ');
  return words.map(word => {
    // If the word is fully uppercase and length ≤ 2, keep it uppercase
    if (word === word.toUpperCase() && word.length <= 2) {
      return word;
    }
    // Otherwise, standard title case: first letter uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
