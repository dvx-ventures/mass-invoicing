import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Resolve __dirname and __filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, './mass-7e4f9-firebase.json'); // Update with the correct path
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Load lookup data from CSV
const lookupData = {};
const loadLookupData = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Assuming CSV columns are: Filename, Category, URL
                console.log("Filename:",row.Filename);
                lookupData[row.Filename] = row.URL.trim();
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
        } else if (name.endsWith('.json')) {
            files_.push(name);
        }
    }
    return files_;
}

// Function to process each JSON file and upload to Firestore
async function processAndUploadJSONFile(filePath) {
    const fileData = fs.readFileSync(filePath, 'utf-8');
    let jsonData = JSON.parse(fileData);

    // Add a unique UUID
    jsonData.uuid = uuidv4();

    // Strip .json from file_name and add to JSON
    const fileNameWithoutExtension = path.parse(filePath).name;
    jsonData.file_name = fileNameWithoutExtension;

    // Add folder name
    jsonData.folder_name = path.dirname(filePath).split(path.sep).pop();

    // Lookup and add the URL
    const url = lookupData[fileNameWithoutExtension] || null; // Add URL or null if not found
    if (url) {
        jsonData.url = url;
    } else {
        console.warn(`No URL found for file: ${fileNameWithoutExtension}`);
    }

    // Define the Firestore collection name (update as needed)
    const collectionName = 'invoice';

    // Upload the JSON data to Firestore
    try {
        await db.collection(collectionName).doc(jsonData.uuid).set(jsonData);
        console.log(`Uploaded file to Firestore: ${filePath}`);
    } catch (error) {
        console.error(`Failed to upload ${filePath} to Firestore:`, error);
    }
}

// Main function to start processing
async function main() {
    const dirPath = process.argv[2];
    const lookupFilePath = './IBA_urls.csv'; // Update with the actual path

    if (!dirPath) {
        console.error('Please provide a directory path as an argument.');
        process.exit(1);
    }

    console.log('Loading lookup data...');
    await loadLookupData(lookupFilePath);
    console.log('Lookup data loaded.');

    const jsonFiles = getJSONFiles(dirPath);
    for (const filePath of jsonFiles) {
        await processAndUploadJSONFile(filePath);
    }
}

// Run the main function
main();
