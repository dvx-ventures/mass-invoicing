const fs = require('fs');
const path = require('path');

// Function to recursively sort JSON keys alphabetically
function sortJSONKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortJSONKeys);
    }

    return Object.keys(obj)
        .sort()
        .reduce((sortedObj, key) => {
            sortedObj[key] = sortJSONKeys(obj[key]);
            return sortedObj;
        }, {});
}

// Get command-line arguments for input and output files
const [inputFile, outputFile] = process.argv.slice(2);

if (!inputFile || !outputFile) {
    console.error('Usage: node sortJson.js <inputFile> <outputFile>');
    process.exit(1);
}

// Read the JSON file, sort the keys, and write to the output file
fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading input file:', err);
        return;
    }

    try {
        const json = JSON.parse(data);
        const sortedJson = sortJSONKeys(json);

        fs.writeFile(outputFile, JSON.stringify(sortedJson, null, 2), (err) => {
            if (err) {
                console.error('Error writing output file:', err);
            } else {
                console.log(`JSON file sorted and saved to ${outputFile}`);
            }
        });
    } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
    }
});
