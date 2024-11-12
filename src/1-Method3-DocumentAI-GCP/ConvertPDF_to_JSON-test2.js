// Imports the Google Cloud client library and required modules
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs-extra');
const path = require('path');

// Ensure the script is called with two arguments for input and output directories
if (process.argv.length < 4) {
  console.error('Usage: node script.js <inputDir> <outputDir>');
  process.exit(1);
}

const inputDir = process.argv[2];
const outputDir = process.argv[3];

// Set these variables before running the script
const projectId = 'mass-data-tools';
const location = 'us';  // Format: 'us' or 'eu'
const processorId = '2af4402ea6a6c913';
const mimeType = 'application/pdf';  // e.g., application/pdf

// Provide the path to your service account key file
const client = new DocumentProcessorServiceClient({
  keyFilename: '../invoice_credentials.json',
});

// The full resource name of the processor
const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

// Function to process a PDF document using Document AI and convert it to JSON
async function processPdfDocument(pdfBuffer) {
  // Encode the PDF buffer to base64
  const encodedImage = pdfBuffer.toString('base64');

  // Configure the request for Document AI
  const request = {
    name: processorName,
    rawDocument: {
      content: encodedImage,
      mimeType: mimeType,
    },
  };

  try {
    // Process the document
    const [result] = await client.processDocument(request);
    const { document } = result;

    const entities = document.entities || [];
    const extractedData = entities.map(entity => ({
      type: entity.type,
      mentionText: entity.mentionText,
      confidence: entity.confidence,
    }));

    return extractedData;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

// Function to traverse directories, process PDFs, and save JSON outputs
async function processDirectory(inputPath, outputPath) {
  await fs.ensureDir(outputPath);

  const items = await fs.readdir(inputPath);
  for (const item of items) {
    const itemPath = path.join(inputPath, item);
    const outputItemPath = path.join(outputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await processDirectory(itemPath, outputItemPath); // Recursive call for subdirectories
    } else if (path.extname(item).toLowerCase() === '.pdf') {
      console.log(`Processing PDF: ${itemPath}`);
      const pdfBuffer = await fs.readFile(itemPath);
      const jsonData = await processPdfDocument(pdfBuffer);

      // Define the output JSON path by replacing .pdf with .json
      const jsonFilePath = outputItemPath.replace(/\.pdf$/, '.json');
      await fs.ensureDir(path.dirname(jsonFilePath));
      await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
      console.log(`Saved JSON: ${jsonFilePath}`);
    }
  }
}

// Start the directory processing
(async () => {
  try {
    await processDirectory(inputDir, outputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing PDFs:', error);
  }
})();
