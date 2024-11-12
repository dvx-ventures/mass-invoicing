const fs = require('fs');
const path = require('path');

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

// Main function to convert images to Base64
async function convertImagesToBase64(sourceDir, outputDir) {
    await walkDir(sourceDir, async (filepath) => {
        // Get the file extension
        const ext = path.extname(filepath).toLowerCase();
        // List of image extensions to process
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'];

        if (imageExtensions.includes(ext)) {
            // Get the relative path from sourceDir
            const relativePath = path.relative(sourceDir, filepath);
            // Set the output path with .txt extension
            const outputFilePath = path.join(outputDir, relativePath + '.txt');

            // Ensure the output directory exists
            const outputDirPath = path.dirname(outputFilePath);
            await fs.promises.mkdir(outputDirPath, { recursive: true });

            try {
                // Read the image file
                const imageData = await fs.promises.readFile(filepath);
                // Convert to Base64
                const base64Data = imageData.toString('base64');

                // Write the Base64 string to the output file
                await fs.promises.writeFile(outputFilePath, base64Data);

                console.log(`Converted ${filepath} to Base64 at ${outputFilePath}`);
            } catch (error) {
                console.error(`Error processing ${filepath}:`, error);
            }
        }
    });
}

// Parse command-line arguments
const sourceDir = process.argv[2];
const outputDir = process.argv[3];

if (!sourceDir || !outputDir) {
    console.error('Usage: node convert-images-to-base64.js <sourceDir> <outputDir>');
    process.exit(1);
}

// Start the conversion process
convertImagesToBase64(sourceDir, outputDir)
    .then(() => {
        console.log('All images have been converted to Base64 successfully.');
    })
    .catch((error) => {
        console.error('An error occurred during the conversion process:', error);
    });
