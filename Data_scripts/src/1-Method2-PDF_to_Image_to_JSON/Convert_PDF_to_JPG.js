const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Function to recursively walk through directories
async function walkDir(dir, callback) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stats = await fs.promises.stat(filepath);
        if (stats.isDirectory()) {
            await walkDir(filepath, callback);
        } else if (stats.isFile()) {
            await callback(filepath);
        }
    }
}

// Main function to convert PDFs to JPGs
async function convertPdfs(sourceDir, outputDir) {
    const tasks = [];

    await walkDir(sourceDir, async (filepath) => {
        if (path.extname(filepath).toLowerCase() === '.pdf') {
            // Get the relative path from sourceDir
            const relativePath = path.relative(sourceDir, filepath);
            // Set the output path
            const outputFilePath = path.join(outputDir, relativePath);
            // Change the extension to .jpg
            const outputFilePathJpg = outputFilePath.replace(/\.pdf$/i, '.jpg');

            // Ensure the output directory exists
            const outputDirPath = path.dirname(outputFilePathJpg);
            await fs.promises.mkdir(outputDirPath, { recursive: true });

            // Convert the PDF to JPG (first page only)
            // You can adjust the quality by adding -quality option (e.g., -quality 85)
            const cmd = `magick "${filepath}[0]" -quality 85 "${outputFilePathJpg}"`;

            const task = execPromise(cmd)
                .then(() => {
                    console.log(`Converted ${filepath} to ${outputFilePathJpg}`);
                })
                .catch((error) => {
                    console.error(`Error converting ${filepath}:`, error);
                });

            tasks.push(task);
        }
    });

    // Wait for all conversion tasks to complete
    await Promise.all(tasks);
}

// Parse command-line arguments
const sourceDir = process.argv[2];
const outputDir = process.argv[3];

if (!sourceDir || !outputDir) {
    console.error('Usage: node convert-pdfs.js <sourceDir> <outputDir>');
    process.exit(1);
}

// Start the conversion process
convertPdfs(sourceDir, outputDir)
    .then(() => {
        console.log('All PDFs have been converted successfully.');
    })
    .catch((error) => {
        console.error('An error occurred during the conversion process:', error);
    });
