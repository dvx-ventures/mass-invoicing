const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

// Change these paths accordingly
const SRC_DIR = './downloaded_files';
const DEST_DIR = './processed_files';

// Ensure destination directory exists
fs.ensureDirSync(DEST_DIR);

// Function to process a single PDF file
function processPdf(filePath, destPath) {
  return new Promise((resolve, reject) => {
    // Construct the command to run ocrmypdf
    const cmd = `ocrmypdf -l eng --rotate-pages --oversample 300 --skip-text "${filePath}" "${destPath}"`;

    // Execute the command
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error processing ${filePath}:`, stderr);
        reject(error);
      } else {
        console.log(`Successfully processed: ${filePath}`);
        resolve();
      }
    });
  });
}

// Function to recursively walk through directories and process PDFs
async function walkDir(currentPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (let entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(SRC_DIR, fullPath);
    const destPath = path.join(DEST_DIR, relativePath);

    if (entry.isDirectory()) {
      await walkDir(fullPath);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf') {
      // Ensure the destination directory exists
      await fs.ensureDir(path.dirname(destPath));

      try {
        await processPdf(fullPath, destPath);
      } catch (error) {
        console.error(`Failed to process ${fullPath}:`, error);
      }
    }
  }
}

// Start the script
(async () => {
  try {
    await walkDir(SRC_DIR);
    console.log('All PDFs have been processed.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
