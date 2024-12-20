#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Removes the duplicated extension from a filename if present.
 * For example, "file.pdf.pdf" becomes "file.pdf".
 * @param {string} filename - The original filename.
 * @returns {string} - The filename with duplicated extension removed.
 */
function removeDuplicateExtension(filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const secondExt = path.extname(base);
    
    if (secondExt.toLowerCase() === ext.toLowerCase()) {
        // Remove the duplicated extension
        return path.join(path.dirname(filename), path.basename(base));
    }
    return filename;
}

/**
 * Recursively traverses the input directory, processes files, and copies them to the output directory.
 * @param {string} inputDir - The source directory path.
 * @param {string} outputDir - The destination directory path.
 */
async function processDirectory(inputDir, outputDir) {
    try {
        const entries = await fs.readdir(inputDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const inputPath = path.join(inputDir, entry.name);
            const relativePath = path.relative(inputDir, inputPath);
            let outputPath = path.join(outputDir, relativePath);
            
            if (entry.isDirectory()) {
                // Ensure the corresponding directory exists in the output
                await fs.mkdir(outputPath, { recursive: true });
                // Recursively process the subdirectory
                await processDirectory(inputPath, outputPath);
            } else if (entry.isFile()) {
                // Remove duplicated extension if present
                const newFilename = removeDuplicateExtension(entry.name);
                outputPath = path.join(outputDir, path.relative(inputDir, path.join(inputDir, newFilename)));
                
                // Ensure the destination directory exists
                await fs.mkdir(path.dirname(outputPath), { recursive: true });
                
                // Copy the file
                await fs.copyFile(inputPath, outputPath);
                console.log(`Copied: ${inputPath} -> ${outputPath}`);
            }
        }
    } catch (err) {
        console.error(`Error processing directory ${inputDir}:`, err);
    }
}

/**
 * Main function to execute the script.
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.error('Usage: node remove-duplicate-extensions.js <inputDir> <outputDir>');
        process.exit(1);
    }
    
    const [inputDir, outputDir] = args.map(arg => path.resolve(arg));
    
    try {
        const inputStat = await fs.stat(inputDir);
        if (!inputStat.isDirectory()) {
            console.error(`Input path is not a directory: ${inputDir}`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`Input directory does not exist: ${inputDir}`);
        process.exit(1);
    }
    
    // Create the output directory if it doesn't exist
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
        console.error(`Failed to create output directory: ${outputDir}`, err);
        process.exit(1);
    }
    
    // Start processing
    await processDirectory(inputDir, outputDir);
    console.log('Processing complete.');
}

main();
