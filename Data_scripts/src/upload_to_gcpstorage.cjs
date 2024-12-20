// upload-pdfs.js

const { Storage } = require('@google-cloud/storage');
const recursive = require('recursive-readdir');
const path = require('path');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// -------------------- Configuration -------------------- //

// **Google Cloud Configuration**
const GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, './mass-7e4f9-firebase.json'); // Path to your service account key
const GCS_BUCKET_NAME = 'mass-7e4f9.firebasestorage.app'; // Replace with your GCS bucket name
const GCS_URL_PREFIX = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/`; // Updated to dynamically include bucket name

// **Local Directory Configuration**
const LOCAL_DIRECTORY = path.join(__dirname, '../downloaded_ext_cleaned'); // Replace with the path to your PDF directory

// **CSV Output Configuration**
const CSV_OUTPUT = path.join(__dirname, 'gcp_uploaded.csv'); // Desired name and path for the output CSV file

// -------------------- End Configuration -------------------- //

// Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
});

// Get a reference to the bucket
const bucket = storage.bucket(GCS_BUCKET_NAME);

// Function to upload a single file
const uploadFile = async (filePath, destination) => {
  try {
    await bucket.upload(filePath, {
      destination,
      // Make the file public (optional)
      // Uncomment the following lines if you want each file to be publicly accessible
      // metadata: {
      //   cacheControl: 'public, max-age=31536000',
      // },
    });
    console.log(`Uploaded: ${filePath} to ${destination}`);
  } catch (error) {
    console.error(`Failed to upload ${filePath}:`, error);
    throw error;
  }
};

// Function to display usage instructions
const showUsage = () => {
  console.log('Usage: node upload-pdfs.js <GCS_FOLDER_NAME>');
  console.log('Example: node upload-pdfs.js my-folder');
};

// Main function
const main = async () => {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    if (args.length !== 1) {
      console.error('Error: Exactly one argument (GCS folder name) is required.');
      showUsage();
      process.exit(1);
    }

    const gcsFolderName = args[0].trim();

    // Validate folder name (optional)
    if (!/^[a-zA-Z0-9-_]+$/.test(gcsFolderName)) {
      console.error('Error: Folder name contains invalid characters. Use only letters, numbers, hyphens, and underscores.');
      process.exit(1);
    }

    // Check if the service account key file exists
    if (!fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)) {
      console.error(`Service account key file not found at ${GOOGLE_APPLICATION_CREDENTIALS}`);
      process.exit(1);
    }

    // Check if the local directory exists
    if (!fs.existsSync(LOCAL_DIRECTORY)) {
      console.error(`Local directory not found at ${LOCAL_DIRECTORY}`);
      process.exit(1);
    }

    // Get all files recursively
    const allFiles = await recursive(LOCAL_DIRECTORY);

    // Filter PDF files
    const pdfFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.pdf');

    if (pdfFiles.length === 0) {
      console.log('No PDF files found in the specified directory.');
      return;
    }

    console.log(`Found ${pdfFiles.length} PDF file(s). Starting upload to folder "${gcsFolderName}"...`);

    // Prepare CSV writer
    const csvWriter = createCsvWriter({
      path: CSV_OUTPUT,
      header: [
        { id: 'fileName', title: 'fileName' },
        { id: 'url', title: 'URL' },
        { id: 'label', title: 'label' }, // New column for label
      ],
    });

    const records = [];

    // Upload each PDF
    for (const filePath of pdfFiles) {
      // Determine the destination path in GCS (preserve directory structure within the specified folder)
      const relativePath = path.relative(LOCAL_DIRECTORY, filePath).replace(/\\/g, '/'); // For Windows compatibility
      const destination = `${gcsFolderName}/${relativePath}`; // Prefix with the folder name

      // Upload the file
      await uploadFile(filePath, destination);

      // Construct the file URL
      const fileUrl = `${GCS_URL_PREFIX}${encodeURI(destination)}`;

      // **Extract the base filename without directories**
      const baseFileName = path.basename(relativePath);

      // **Extract the label (parent folder name)**
      const pathParts = relativePath.split('/');
      let label;
      if (pathParts.length > 1) {
        label = pathParts[pathParts.length - 2]; // Immediate parent folder
      } else {
        label = 'root'; // Default label for files in the root directory
      }

      // Add record to CSV
      records.push({
        fileName: baseFileName, // Use baseFileName instead of relativePath
        url: fileUrl,
        label: label, // Add the label field
      });
    }

    // Write to CSV
    await csvWriter.writeRecords(records);
    console.log(`CSV file has been written to ${CSV_OUTPUT}`);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
};

// Execute the main function
main();
