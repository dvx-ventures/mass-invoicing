const fs = require('fs');
const path = require('path');

// Path to your JSON file
const dataFilePath = path.join(__dirname, 'supplier.json');

// Output file path
const outputFilePath = path.join(__dirname, 'supplier_names.txt');

// Read and parse the JSON data
const rawData = fs.readFileSync(dataFilePath, 'utf-8');
const dataArray = JSON.parse(rawData);

// Extract the supplier_name values
let supplierNames = dataArray.map(item => item.supplier_name);

// Sort supplier names alphabetically
supplierNames.sort((a, b) => a.localeCompare(b));

// Convert each supplier_name to a quoted, JSON-stringified form
const quotedNames = supplierNames.map(name => JSON.stringify(name));

// Join them with a newline for the output file
const outputData = quotedNames.join('\n');

// Write the result to the output file
fs.writeFileSync(outputFilePath, outputData, 'utf-8');

console.log(`Successfully wrote ${quotedNames.length} supplier names to ${outputFilePath}`);
