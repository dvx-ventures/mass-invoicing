// Imports the Google Cloud client library
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs-extra'); // Use fs-extra for promise-based methods
const path = require('path');

// Parse command-line arguments for input and output directories
const argv = require('yargs')
  .usage('Usage: node $0 --inputDir [path] --outputDir [path] --entitiesOutputDir [path]')
  .demandOption(['inputDir', 'outputDir', 'entitiesOutputDir'])
  .argv;

// Define your input and output directories from command-line arguments
const inputDir = argv.inputDir;
const outputDir = argv.outputDir;
const entitiesOutputDir = argv.entitiesOutputDir;

// Function to process a single invoice PDF
async function processInvoice(filePath, outputFilePath, entitiesOutputFilePath) {
  // Set these variables before running the script
  const projectId = 'mass-data-tools';
  const location = 'us';  // Format: 'us' or 'eu'
  const processorId = '2af4402ea6a6c913';
  const mimeType = 'application/pdf';  // e.g., application/pdf

  // Provide the path to your service account key file
  const client = new DocumentProcessorServiceClient({
    keyFilename: '../invoice_credentials.json', // Update this path
  });

  // The full resource name of the processor
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  try {
    // Debugging: Log filePath
    console.log('Processing file:', filePath);

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

    // Write document.entities to the entities output file
    await fs.ensureDir(path.dirname(entitiesOutputFilePath));
    await fs.writeFile(entitiesOutputFilePath, JSON.stringify(document.entities, null, 2));

    // Initialize the invoice object
    const invoiceData = {};

    // Collect line items separately
    const lineItems = [];

    if (document.entities && document.entities.length > 0) {
      console.log('Processing document:', filePath);
      document.entities.forEach(entity => {
        // Check if the entity has properties
        if (entity.properties && entity.properties.length > 0) {
          // Initialize an object to hold the entity's properties
          const entityData = {};

          entity.properties.forEach(property => {
            const key = property.type; // Use the property type as the key
            const value = property.textAnchor
              ? getText(property.textAnchor, document.text)
              : '';
            const confidence = property.confidence || 0;

            // Include value and confidence
            entityData[key] = {
              value: value,
              confidence: confidence,
            };
          });

          if (entity.type === 'line_item') {
            // Add to line items array
            lineItems.push(entityData);
          } else {
            // Add to invoice data using the entity type as the key
            invoiceData[entity.type] = entityData;
          }
        } else {
          // Entities without properties
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

      // Add line items to the invoice data if any
      if (lineItems.length > 0) {
        invoiceData['line_items'] = lineItems;
      }

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
async function processDirectory(inputPath, outputPath, entitiesOutputPath) {
  await fs.ensureDir(outputPath);

  const items = await fs.readdir(inputPath);
  for (const item of items) {
    const itemPath = path.join(inputPath, item);
    const outputItemPath = path.join(outputPath, item);
    const entitiesOutputItemPath = path.join(entitiesOutputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await processDirectory(itemPath, outputItemPath, entitiesOutputItemPath);
    } else if (path.extname(item).toLowerCase() === '.pdf') {
      console.log('Processing PDF:', itemPath);

      const parsedPath = path.parse(outputItemPath);
      const outputFilePath = path.join(parsedPath.dir, `${parsedPath.name}.json`);

      const entitiesParsedPath = path.parse(entitiesOutputItemPath);
      const entitiesOutputFilePath = path.join(entitiesParsedPath.dir, `${entitiesParsedPath.name}.json`);

      await processInvoice(itemPath, outputFilePath, entitiesOutputFilePath);
    }
  }
}

// Start the process
(async () => {
  try {
    await processDirectory(inputDir, outputDir, entitiesOutputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing PDFs:', error);
  }
})();
