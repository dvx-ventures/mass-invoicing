#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Read directories from command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node flatten_json.js <input_directory> <output_directory>");
  process.exit(1);
}

const inputDir = args[0];
const outputDir = args[1];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Recursively process a field.
 * If data is an object with {value, confidence}, extract value and confidence.
 * If data is a nested object or array, recurse.
 * Otherwise, return data as-is.
 *
 * @param {string} parentPath - The cumulative path of the field up to this point.
 * @param {string|number} key - The current field name or array index.
 * @param {any} data - The value to process.
 * @param {Array} fieldsConfidence - Reference array to store {field, confidence}.
 * @returns {any} - Processed value.
 */
function processField(parentPath, key, data, fieldsConfidence) {
  // Special rule: If the key is "line_items", rename it in the path to "line_item"
  const pathKey = (key === 'line_items') ? 'line_item' : key;

  const currentPath = parentPath
    ? `${parentPath}.${pathKey}`
    : pathKey.toString();

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    // Check if it's a simple {value, confidence} object
    if (keys.length === 2 && keys.includes('value') && keys.includes('confidence')) {
      const { value, confidence } = data;
      fieldsConfidence.push({ field: currentPath, confidence });
      return value;
    } else {
      // It's a nested object, process each key
      const newObj = {};
      for (const k of keys) {
        newObj[k] = processField(currentPath, k, data[k], fieldsConfidence);
      }
      return newObj;
    }
  } else if (Array.isArray(data)) {
    // Process each element in the array
    return data.map((item, i) => processField(currentPath, i, item, fieldsConfidence));
  } else {
    // Primitive value, just return
    return data;
  }
}

/**
 * Process the entire JSON structure, separating out fieldsConfidence.
 *
 * @param {object} data - The parsed JSON data.
 * @returns {object} - Flattened data with fieldsConfidence array.
 */
function processJsonStructure(data) {
  const fieldsConfidence = [];
  const newData = {};

  for (const [key, value] of Object.entries(data)) {
    newData[key] = processField('', key, value, fieldsConfidence);
  }

  newData.fieldsConfidence = fieldsConfidence;

  // Add the additional fields with current timestamps and empty strings
  const currentTimestamp = new Date().toISOString();

  newData.receivedAt = currentTimestamp;
  newData.processedAt = currentTimestamp;

  newData.from = "";
  newData.messageId = "";
  newData.snippet = "";
  newData.subject = "";
  newData.emailDocId = "";

  return newData;
}

/**
 * Recursively traverse the directory tree and process JSON files.
 *
 * @param {string} dir - Directory to traverse.
 */
async function traverseAndProcess(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await traverseAndProcess(fullPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      // Process JSON file
      const relativePath = path.relative(inputDir, dir);
      const outputPathDir = path.join(outputDir, relativePath);
      await ensureDir(outputPathDir);

      const inputPath = fullPath;
      const outputPath = path.join(outputPathDir, entry.name);

      const rawData = await fs.readFile(inputPath, 'utf8');
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        console.error(`Failed to parse JSON: ${inputPath}`, e);
        continue;
      }

      let flattenedData = processJsonStructure(data);

      await fs.writeFile(outputPath, JSON.stringify(flattenedData, null, 2), 'utf8');
      console.log(`Processed and wrote: ${outputPath}`);
    }
  }
}

(async function main() {
  try {
    await traverseAndProcess(inputDir);
    console.log("Processing complete.");
  } catch (error) {
    console.error("Error processing files:", error);
  }
})();
