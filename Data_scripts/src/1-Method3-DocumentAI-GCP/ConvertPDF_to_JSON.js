// Imports the Google Cloud client libraries
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { Storage } = require('@google-cloud/storage');
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

// Initialize Document AI client
const documentClient = new DocumentProcessorServiceClient({
  keyFilename: '../invoice_credentials.json', // Update this path
});

// Initialize Google Cloud Storage client
const storage = new Storage({
  keyFilename: '../invoice_credentials.json', // Update this path
});

// Function to upload PDF to Cloud Storage
async function uploadToCloudStorage(filePath, bucketName) {
  const fileName = path.basename(filePath);
  const bucket = storage.bucket(bucketName);
  
  await bucket.upload(filePath, {
    destination: fileName,
    resumable: false,
  });
  
  console.log(`${fileName} uploaded to ${bucketName}.`);
  return `gs://${bucketName}/${fileName}`;
}

// Function to process a single invoice PDF
async function processInvoice(filePath, outputFilePath, entitiesOutputFilePath) {
    const projectId = 'mass-data-tools';
    const location = 'us';  // Ensure this matches your processor’s region
    const processorId = '2af4402ea6a6c913';
    const mimeType = 'application/pdf';
    const bucketName = 'mass-invoicing';  // Replace with your Cloud Storage bucket name
  
    // The full resource name of the processor
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  
    try {
      // Upload the file to Cloud Storage and get the GCS URI
      const gcsUri = await uploadToCloudStorage(filePath, bucketName);
      
      console.log("gcsURI:",gcsUri);
      // Configure the request for Document AI using the GCS URI
      const request = {
        name,
        rawDocument: {
            content: await fs.readFile(filePath),
            mimeType: 'application/pdf'
        }
        };
        
      console.log("request:",request);
      // Process the document
      const [result] = await documentClient.processDocument(request);
      const { document } = result;
  
      // Write document.entities to the entities output file
      await fs.ensureDir(path.dirname(entitiesOutputFilePath));
      await fs.writeFile(entitiesOutputFilePath, JSON.stringify(document.entities, null, 2));
  
      // Handle extracted document entities and properties
      const invoiceData = {};
      const lineItems = [];
  
      if (document.entities && document.entities.length > 0) {
        document.entities.forEach(entity => {
          const entityData = {};
          if (entity.properties && entity.properties.length > 0) {
            entity.properties.forEach(property => {
              const key = property.type;
              const value = property.textAnchor ? getText(property.textAnchor, document.text) : '';
              const confidence = property.confidence || 0;
              entityData[key] = { value, confidence };
            });
  
            if (entity.type === 'line_item') {
              lineItems.push(entityData);
            } else {
              invoiceData[entity.type] = entityData;
            }
          } else {
            const key = entity.type;
            const value = entity.textAnchor ? getText(entity.textAnchor, document.text) : '';
            const confidence = entity.confidence || 0;
            invoiceData[key] = { value, confidence };
          }
        });
  
        if (lineItems.length > 0) {
          invoiceData['line_items'] = lineItems;
        }
  
        const jsonOutput = JSON.stringify(invoiceData, null, 2);
        await fs.ensureDir(path.dirname(outputFilePath));
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
