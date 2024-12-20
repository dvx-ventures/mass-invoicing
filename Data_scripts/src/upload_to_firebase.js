// Import necessary modules
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Resolve __dirname and __filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, './mass-7e4f9-firebase.json'); // Update with the correct path
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Service account file not found at path: ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Load lookup data from CSV
const lookupData = {};

const loadLookupData = (filePath) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`CSV file not found at path: ${filePath}`));
        }

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Assuming CSV columns are: fileName, URL, label
                const fileName = row.fileName ? row.fileName.trim() : '';
                const url = row.URL ? row.URL.trim() : '';
                const label = row.label ? row.label.trim() : '';

                if (!fileName) {
                    console.warn('Encountered a row with empty fileName. Skipping.');
                    return;
                }

                if (!lookupData[fileName]) {
                    // Initialize with URL and labels array
                    lookupData[fileName] = {
                        URL: url || null,
                        labels: []
                    };
                }

                if (label) {
                    lookupData[fileName].labels.push(label);
                }

                // If URL is missing in a subsequent row for the same fileName, retain the first URL
                if (!lookupData[fileName].URL && url) {
                    lookupData[fileName].URL = url;
                }
            })
            .on('end', () => {
                console.log('CSV file successfully processed');
                resolve();
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

// Helper function to get all JSON files in a directory recursively
function getJSONFiles(dir, files_ = []) {
    const files = fs.readdirSync(dir);
    for (let i = 0; i < files.length; i++) {
        const name = path.join(dir, files[i]);
        if (fs.statSync(name).isDirectory()) {
            getJSONFiles(name, files_);
        } else if (name.toLowerCase().endsWith('.json')) {
            files_.push(name);
        }
    }
    return files_;
}

// Function to process each JSON file and upload to Firestore
async function processAndUploadJSONFile(filePath, organizationId) {
    try {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        let jsonData = JSON.parse(fileData);

        // Remove UUID generation
        // jsonData.uuid = uuidv4(); // This line is removed

        // Strip .json from file_name and add to JSON
        const fileNameWithoutExtension = path.parse(filePath).name;
        jsonData.file_name = fileNameWithoutExtension;

        // Add folder name
        jsonData.folder_name = path.dirname(filePath).split(path.sep).pop();

        // Lookup and add the URL and labels
        const lookupEntry = lookupData[fileNameWithoutExtension];
        if (lookupEntry) {
            jsonData.url = lookupEntry.URL;

            // Add labels from CSV
            jsonData.labels = lookupEntry.labels || [];
        } else {
            jsonData.url = null;
            jsonData.labels = [];
            console.warn(`No lookup data found for file: ${fileNameWithoutExtension}`);
        }

        // Add organizationId
        jsonData.organizationId = organizationId;

        // Define the Firestore collection name (update as needed)
        const collectionName = 'invoice';

        // Upload the JSON data to Firestore with an auto-generated ID
        const docRef = await db.collection(collectionName).add(jsonData);
        console.log(`Uploaded file to Firestore: ${filePath} with ID: ${docRef.id}`);
    } catch (error) {
        console.error(`Failed to process/upload ${filePath}:`, error);
    }
}

// Main function to start processing
async function main() {
    const args = process.argv.slice(2);
    const dirPath = args[0];
    const organizationId = args[1];
    const lookupFilePath = './gcp_uploaded.csv'; // Update with the actual path

    if (!dirPath) {
        console.error('Error: Please provide a directory path as the first argument.');
        console.error('Usage: node script.js <directory_path> <organizationId>');
        process.exit(1);
    }

    if (!organizationId) {
        console.error('Error: Please provide an organizationId as the second argument.');
        console.error('Usage: node script.js <directory_path> <organizationId>');
        process.exit(1);
    }

    if (!fs.existsSync(dirPath)) {
        console.error(`Error: The directory path provided does not exist: ${dirPath}`);
        process.exit(1);
    }

    console.log('Loading lookup data...');
    try {
        await loadLookupData(lookupFilePath);
        console.log('Lookup data loaded.');
    } catch (error) {
        console.error('Failed to load lookup data:', error);
        process.exit(1);
    }

    const jsonFiles = getJSONFiles(dirPath);
    if (jsonFiles.length === 0) {
        console.warn('No JSON files found in the specified directory.');
        return;
    }

    console.log(`Found ${jsonFiles.length} JSON file(s) to process.`);

    for (const filePath of jsonFiles) {
        await processAndUploadJSONFile(filePath, organizationId);
    }

    console.log('All files have been processed and uploaded.');
}

// Run the main function
main();
