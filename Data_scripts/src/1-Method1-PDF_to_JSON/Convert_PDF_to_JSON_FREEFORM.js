// Imports the Google Cloud client library
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs-extra'); // Use fs-extra for promise-based methods
const path = require('path');

// Parse command-line arguments for input and output directories
const argv = require('yargs')
  .usage('Usage: node $0 --inputDir [path] --outputDir [path]')
  .demandOption(['inputDir', 'outputDir'])
  .argv;

// Define your input and output directories from command-line arguments
const inputDir = argv.inputDir;
const outputDir = argv.outputDir;

// Function to process a single invoice PDF
async function processInvoice(filePath, outputFilePath) {
  // Set these variables before running the script
  const projectId = 'mass-data-tools'; // Replace with your Google Cloud project ID
  const location = 'us';  // Format: 'us' or 'eu'
  const processorId = '2af4402ea6a6c913'; // Replace with your processor ID
  const mimeType = 'application/pdf';  // e.g., application/pdf

  // Provide the path to your service account key file
  const client = new DocumentProcessorServiceClient({
    keyFilename: 'C:\\path\\to\\your\\service-account-file.json', // Update this path
  });

  // The full resource name of the processor
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  try {
    // Read the file into a buffer
    const imageFile = await fs.readFile(filePath);
    const encodedImage = imageFile.toString('base64');

    // Configure the request
    const request = {
      name: name,
      rawDocument: {
        content: encodedImage,
        mimeType: mimeType,
      },
    };

    // Process the document
    const [result] = await client.processDocument(request);
    const { document } = result;

    // Initialize the invoice object
    const invoiceData = {};

    // Collect line items
    const lineItems = [];

    if (document.entities && document.entities.length > 0) {
      console.log("Processing document:", filePath);
      document.entities.forEach(entity => {
        // Check if the entity is a line item
        if (entity.type === 'line_item') {
          const lineItem = {};

          if (entity.properties && entity.properties.length > 0) {
            entity.properties.forEach(property => {
              const key = property.type; // Use the entity field name as the key
              const value = property.textAnchor
                ? getText(property.textAnchor, document.text)
                : '';
              const confidence = property.confidence || 0;

              // Include value and confidence
              lineItem[key] = {
                value: value,
                confidence: confidence,
              };
            });
          }
          lineItems.push(lineItem);
        } else {
          // General invoice entities
          const key = entity.type; // Use the entity field name as the key
          const value = entity.textAnchor
            ? getText(entity.textAnchor, document.text)
            : '';
          const confidence = entity.confidence || 0;

          // Include value and confidence
          invoiceData[key] = {
            value: value,
            confidence: confidence,
          };
        }
      });

      // Add line items to the invoice data
      invoiceData['line_items'] = lineItems;

      // Output the invoice data as JSON
      const jsonOutput = JSON.stringify(invoiceData, null, 2);

      // Ensure the output directory exists
      await fs.ensureDir(path.dirname(outputFilePath));

      // Write the JSON data to a file
      await fs.writeFile(outputFilePath, jsonOutput);

      console.log(`Invoice data has been written to ${outputFilePath}`);
    } else {
      console.log('No entities found in the document.');
    }
  } catch (error) {
    console.error('Error processing document:', error);
  }
}

// Helper function to extract text using text anchors
function getText(textAnchor, text) {
  if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
    return '';
  }
  let responseText = '';
  textAnchor.textSegments.forEach(segment => {
    const startIndex = parseInt(segment.startIndex) || 0;
    const endIndex = parseInt(segment.endIndex);
    responseText += text.substring(startIndex, endIndex);
  });
  return responseText;
}

// Function to traverse directories and process PDFs
async function processDirectory(inputPath, outputPath) {
  await fs.ensureDir(outputPath);

  const items = await fs.readdir(inputPath);
  for (const item of items) {
    const itemPath = path.join(inputPath, item);
    const outputItemPath = path.join(outputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await processDirectory(itemPath, outputItemPath);
    } else if (path.extname(item).toLowerCase() === '.pdf') {
      console.log(`Processing PDF: ${itemPath}`);
      await processInvoice(itemPath, outputItemPath.replace(/\.pdf$/, '.json'));
    }
  }
}

// Start the process
(async () => {
  try {
    await processDirectory(inputDir, outputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing PDFs:', error);
  }
})();
