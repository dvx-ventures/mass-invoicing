// Imports the Google Cloud client library
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const fs = require('fs');

async function processInvoice() {
  // Set these variables before running the script
  const projectId = 'mass-data-tools';
  const location = 'us';  // Format: 'us' or 'eu'
  const processorId = '2af4402ea6a6c913';
  const filePath = './Test.pdf';
  const mimeType = 'application/pdf';  // e.g., application/pdf, image/jpeg

  // Provide the path to your service account key file
  const client = new DocumentProcessorServiceClient({
    keyFilename: '../invoice_credentials.json',
  });
  // The full resource name of the processor
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  // Read the file into a buffer and encode it to base64
  const imageFile = fs.readFileSync(filePath);
  const encodedImage = imageFile.toString('base64');

  // Configure the request
  const request = {
    name: name,
    rawDocument: {
      content: encodedImage,
      mimeType: mimeType,
    },
  };

  try {
    // Process the document
    const [result] = await client.processDocument(request);
    const { document } = result;

    // Print the extracted entities
    console.log(JSON.stringify(result));
    if (document.entities && document.entities.length > 0) {
      document.entities.forEach(entity => {
        console.log(`Entity Type: ${entity.type}`);
        console.log(`Text: ${entity.mentionText}`);
        console.log(`Confidence: ${entity.confidence}\n`);
      });
    } else {
      console.log('No entities found in the document.');
    }
  } catch (error) {
    console.error('Error processing document:', error);
  }
}

processInvoice();
