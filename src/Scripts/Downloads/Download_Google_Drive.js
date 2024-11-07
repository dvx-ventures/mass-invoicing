const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Replace with your own credentials
const credentials = require('../credentials.json');

const scopes = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  scopes
);

const drive = google.drive({ version: 'v3', auth });

function getFileExtension(mimeType) {
  const mimeTypeMap = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'text/plain': '.txt'
  };
  return mimeTypeMap[mimeType] || '';
}

async function downloadFile(file, filePath) {
  const dest = fs.createWriteStream(filePath);
  try {
    const res = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'stream' }
    );
    return new Promise((resolve, reject) => {
      res.data
        .on('end', () => {
          console.log(`File downloaded successfully: ${filePath}`);
          if (file.mimeType === 'application/pdf') {
            console.log(`PDF file processed: ${filePath}`);
          }
          resolve();
        })
        .on('error', err => {
          console.error(`Error downloading file: ${filePath}`, err);
          reject(err);
        })
        .pipe(dest);
    });
  } catch (err) {
    console.error(`Error getting file ${file.id}:`, err.message);
  }
}

async function listFilesAndFolders(folderId, localPath) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType)',
      pageSize: 1000,
    });

    const files = res.data.files;
    if (files.length === 0) {
      console.log(`No files found in folder ${folderId}.`);
      return;
    }

    console.log(`Found ${files.length} files/folders in ${folderId}`);

    for (const file of files) {
      const extension = getFileExtension(file.mimeType);
      const filePath = path.join(localPath, `${file.name}${extension}`);
      console.log(`Processing: ${file.name} (${file.id}) - Type: ${file.mimeType}`);
      
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        if (!fs.existsSync(filePath)) {
          fs.mkdirSync(filePath, { recursive: true });
        }
        await listFilesAndFolders(file.id, filePath);
      } else {
        await downloadFile(file, filePath);
      }
    }
  } catch (err) {
    console.error(`Error listing files in folder ${folderId}:`, err.message);
    if (err.errors) {
      console.error('Detailed errors:', JSON.stringify(err.errors, null, 2));
    }
  }
}

async function main() {
  const folderId = '13i4oh1ctJLAj37_k9ehfwQRcI6CywF7Y';
  const localPath = './downloaded_files';

  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  console.log(`Starting download from folder ${folderId} to ${localPath}`);
  console.log(`Using service account: ${credentials.client_email}`);

  await listFilesAndFolders(folderId, localPath);
  console.log('Script execution completed.');
}

main().catch(console.error);