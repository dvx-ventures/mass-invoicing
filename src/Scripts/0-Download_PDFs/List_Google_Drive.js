const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const credentials = require('../credentials.json');

const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  scopes
);

const drive = google.drive({ version: 'v3', auth });

// Helper function to generate file URLs
function generateFileUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// Save files info to CSV
function saveToCsv(files, csvPath) {
  const csvContent = files
    .map(file => `"${file.folderName}","${file.name}","${file.url}"`)
    .join('\n');
  fs.writeFileSync(csvPath, `Folder Name,File Name,URL\n${csvContent}`);
  console.log(`File list saved to ${csvPath}`);
}

async function listFilesAndFolders(folderId, folderName, filesList = []) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType)',
      pageSize: 1000,
    });

    const files = res.data.files;
    if (files.length === 0) {
      console.log(`No files found in folder ${folderId}.`);
      return filesList;
    }

    console.log(`Found ${files.length} files/folders in ${folderId} (${folderName})`);

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await listFilesAndFolders(file.id, file.name, filesList); // Recursive call for subfolders
      } else {
        const fileUrl = generateFileUrl(file.id);
        filesList.push({ folderName, name: file.name, url: fileUrl });
      }
    }
    return filesList;
  } catch (err) {
    console.error(`Error listing files in folder ${folderId}:`, err.message);
  }
}

async function main() {
  const folderId = '13i4oh1ctJLAj37_k9ehfwQRcI6CywF7Y';
  const csvPath = './file_list.csv';

  console.log(`Starting to list files from folder ${folderId}`);
  console.log(`Using service account: ${credentials.client_email}`);

  // Retrieve the root folder name to include in the CSV
  const res = await drive.files.get({ fileId: folderId, fields: 'name' });
  const rootFolderName = res.data.name;

  const filesList = await listFilesAndFolders(folderId, rootFolderName);
  saveToCsv(filesList, csvPath);
  console.log('Script execution completed.');
}

main().catch(console.error);
