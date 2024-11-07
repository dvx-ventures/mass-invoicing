const fs = require('fs-extra');
const path = require('path');
const OpenAIApi = require('openai');

// Get command-line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node script.js <input_directory> <output_file>');
  process.exit(1);
}

const inputDir = args[0];
const outputFile = args[1];

// Check if the input directory exists
if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
  console.error(`Error: Input directory "${inputDir}" does not exist or is not a directory.`);
  process.exit(1);
}

// Initialize OpenAI API with Configuration
require('dotenv').config();

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY, // Reads the API key from the .env file
});

// Check if API key is provided
if (!openai.apiKey) {
  console.error('Error: OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.');
  process.exit(1);
}

// Store unique fields and their properties
const fields = {};

// Determine type of field
function getType(value) {
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// Recursive function to extract fields, including those in arrays
function extractFields(obj, parentKey = '') {
  for (const key in obj) {
    const fieldPath = parentKey ? `${parentKey}.${key}` : key;
    const value = obj[key];
    const valueType = getType(value);

    if (!fields[fieldPath]) {
      fields[fieldPath] = { type: valueType, description: '' };
    }

    if (valueType === 'object') {
      extractFields(value, fieldPath);
    } else if (valueType === 'array' && value.length > 0 && typeof value[0] === 'object') {
      // For arrays of objects, recursively extract fields from the first element
      extractFields(value[0], fieldPath + '[]');
    }
  }
}


// Generate descriptions using OpenAI API
async function generateDescriptions() {
  for (const field in fields) {
    const prompt = `Describe the following field in an invoice JSON structure:\nField: ${field}\nType: ${fields[field].type}`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: "system", content: "You are a helpful assistant that provides descriptions of JSON fields." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
    });

    fields[field].description = response.choices[0].message.content.trim();
  }
}

// Process each JSON file and extract fields
async function processDirectory(directory) {
  const items = await fs.readdir(directory);

  for (const item of items) {
    const itemPath = path.join(directory, item);
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      await processDirectory(itemPath);
    } else if (path.extname(item).toLowerCase() === '.json') {
      const jsonData = JSON.parse(await fs.readFile(itemPath, 'utf8'));
      extractFields(jsonData);
    }
  }
}

// Main function to process files and output results
(async () => {
  try {
    await processDirectory(inputDir);
    await generateDescriptions();

    // Ensure the output directory exists
    await fs.ensureDir(path.dirname(outputFile));

    await fs.writeFile(outputFile, JSON.stringify(fields, null, 2));
    console.log(`Unique fields and descriptions have been saved to ${outputFile}`);
  } catch (error) {
    console.error('Error processing JSON files:', error);
  }
})();
