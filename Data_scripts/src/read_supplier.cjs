const fs = require('fs');
const admin = require('firebase-admin');

// Replace the path below with the path to your service account JSON file
const serviceAccount = require('./mass-7e4f9-firebase.json');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Replace 'invoice' with the name of the collection you want to download
const COLLECTION_NAME = 'supplier';

/**
 * Recursively converts Firestore Timestamps to ISO strings in the given data.
 * @param {any} obj - The data to process.
 * @returns {any} - The processed data with Timestamps converted.
 */
function convertTimestamps(obj) {
  if (obj instanceof admin.firestore.Timestamp) {
    return obj.toDate().toISOString();
  } else if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = convertTimestamps(value);
    }
    return newObj;
  }
  return obj;
}

async function downloadCollection() {
  try {
    const snapshot = await db.collection(COLLECTION_NAME).get();

    const data = [];
    snapshot.forEach(doc => {
      const docData = { id: doc.id, ...doc.data() };
      const convertedData = convertTimestamps(docData);
      data.push(convertedData);
    });

    // Convert to JSON with proper date formatting
    const jsonData = JSON.stringify(data, null, 2);

    // Write to file
    fs.writeFileSync(`${COLLECTION_NAME}.json`, jsonData, 'utf-8');
    console.log(`Data written to ${COLLECTION_NAME}.json`);
  } catch (error) {
    console.error('Error downloading collection:', error);
  }
}

downloadCollection();
