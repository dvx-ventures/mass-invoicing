const fs = require('fs');
const path = require('path');

// Get the input and output file paths from command-line arguments
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('Usage: node script.js <inputFilePath> <outputFilePath>');
  process.exit(1);
}

// Load the JSON file
let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error('Error reading or parsing input file:', error);
  process.exit(1);
}

// Recursive function to remove "description" fields
function removeDescriptions(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(removeDescriptions);
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (key === 'description') {
        delete obj[key];
      } else {
        removeDescriptions(obj[key]);
      }
    }
  }
}

// Run the function on the loaded JSON data
removeDescriptions(data);

// Write the modified JSON back to the output file
try {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Descriptions removed and saved to ${outputPath}`);
} catch (error) {
  console.error('Error writing to output file:', error);
  process.exit(1);
}
