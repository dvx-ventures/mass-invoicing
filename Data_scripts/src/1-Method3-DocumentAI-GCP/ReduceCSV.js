const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');

// Get input and output directories from command line arguments
const inputDirectory = process.argv[2];
const outputDirectory = process.argv[3];

if (!inputDirectory || !outputDirectory) {
    console.error("Please provide both input and output directory paths as arguments.");
    process.exit(1);
}

// Helper function to read CSV and filter out empty columns
function processCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => results.push(row))
            .on('end', () => {
                if (results.length === 0) {
                    return resolve([]);
                }

                // Get columns that are non-empty across all rows
                const nonEmptyColumns = Object.keys(results[0]).filter(column =>
                    results.some(row => row[column] && row[column].trim() !== "")
                );

                // Filter out empty columns for each row
                const reducedResults = results.map(row =>
                    nonEmptyColumns.reduce((obj, column) => {
                        obj[column] = row[column];
                        return obj;
                    }, {})
                );

                resolve(reducedResults);
            })
            .on('error', (err) => reject(err));
    });
}

// Main function to process all CSV files in a directory
async function processCSVDirectory(inputDir, outputDir) {
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir).filter(file => path.extname(file) === '.csv');

    for (const file of files) {
        const inputFilePath = path.join(inputDir, file);
        const outputFilePath = path.join(outputDir, `${path.basename(file, '.csv')}+reduced.csv`);
        
        try {
            const reducedData = await processCSVFile(inputFilePath);
            
            // If reducedData is empty, skip writing the file
            if (reducedData.length === 0) {
                console.log(`Skipping empty file: ${file}`);
                continue;
            }
            
            // Write reduced data to new CSV file
            const json2csvParser = new Parser();
            const csvData = json2csvParser.parse(reducedData);
            fs.writeFileSync(outputFilePath, csvData);

            console.log(`Processed and saved: ${outputFilePath}`);
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }
}

processCSVDirectory(inputDirectory, outputDirectory);
