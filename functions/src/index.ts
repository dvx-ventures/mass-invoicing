import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const firestore = admin.firestore();

// Initialize Secret Manager Client
const client = new SecretManagerServiceClient();

// Function to access the secret
async function getServiceAccount() {
  console.log("Attempting to access the secret from Secret Manager...");
  try {
    const [version] = await client.accessSecretVersion({
      name: "projects/790780927928/secrets/mass-gmail/versions/1", // Using version 1 explicitly
    });
    console.log("Successfully accessed the secret version.");

    const payload = (version.payload?.data as Buffer).toString("utf8");
    console.log("Decoded secret payload.");

    if (!payload) {
      console.error("Secret payload is empty.");
      throw new Error("Secret payload is empty");
    }

    console.log("Parsed service account JSON.");
    return JSON.parse(payload);
  } catch (error) {
    console.error("Error accessing or parsing the secret:", error);
    throw new Error("Failed to access or parse the service account secret.");
  }
}

export const readInvoiceEmail = onSchedule(
  {
    schedule: "every 5 minutes",
  },
  async (event) => {
    console.log("readInvoiceEmail function triggered by scheduler.");
    console.log("test 1");
    try {
      console.log("Starting to retrieve service account credentials.");
      const serviceAccount = await getServiceAccount();
      console.log("Service account credentials retrieved successfully.");

      console.log("Initializing JWT authentication client.");
      const authClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ["https://www.googleapis.com/auth/gmail.modify"],
        subject: "invoice@masstogether.com",
      });
      console.log("JWT authentication client initialized.");

      console.log("Initializing Gmail API client.");
      const gmail = google.gmail({ version: "v1", auth: authClient });
      console.log("Gmail API client initialized.");

      console.log("Listing unread messages in INBOX...");
      const { data } = await gmail.users.messages.list({
        userId: "invoice@masstogether.com",
        q: "is:unread",
        labelIds: ["INBOX"],
      });
      console.log("Gmail messages.list API call completed.");

      if (!data.messages || data.messages.length === 0) {
        console.log("No new unread messages in invoice@masstogether.com.");
        return; // return void instead of null
      }

      console.log(`Found ${data.messages.length} unread message(s). Processing...`);

      for (const messageMeta of data.messages) {
        try {
          const messageId = messageMeta.id!;
          console.log(`Fetching message with ID: ${messageId}`);

          const messageResponse = await gmail.users.messages.get({
            userId: "invoice@masstogether.com",
            id: messageId,
            format: "full", // To get full message details including attachments
          });
          console.log(`Successfully fetched message ID: ${messageId}`);

          const message = messageResponse.data;
          const headers = message.payload?.headers || [];
          const from = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
          const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
          const snippet = message.snippet || "No Snippet";
          const dateHeader = headers.find((h) => h.name === "Date")?.value || new Date().toISOString();

          console.log(`New Email from: ${from}, Subject: ${subject}`);
          console.log(`Snippet: ${snippet}`);

          // Prepare email data to save to Firestore
          const emailData: any = {
            messageId: messageId,
            from,
            subject,
            snippet,
            date: new Date(dateHeader),
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Handle attachments
          const attachments: any[] = [];
          const parts = message.payload?.parts || [];

          // Recursive function to extract attachments
          function extractAttachments(parts: any[], parentId?: string) {
            for (const part of parts) {
              if (part.filename && part.filename.length > 0) {
                attachments.push({
                  filename: part.filename,
                  mimeType: part.mimeType,
                  attachmentId: part.body?.attachmentId,
                });
              }
              if (part.parts) {
                extractAttachments(part.parts, part.partId);
              }
            }
          }

          extractAttachments(parts);

          if (attachments.length > 0) {
            console.log(`Found ${attachments.length} attachment(s). Processing...`);
            emailData.attachments = [];

            for (const attachment of attachments) {
              if (!attachment.attachmentId) {
                console.warn(`Attachment ID missing for file: ${attachment.filename}`);
                continue;
              }

              // Fetch the attachment data
              const attachmentResponse = await gmail.users.messages.attachments.get({
                userId: "invoice@masstogether.com",
                messageId: messageId,
                id: attachment.attachmentId,
              });

              const attachmentData = attachmentResponse.data.data;
              if (!attachmentData) {
                console.warn(`No data found for attachment: ${attachment.filename}`);
                continue;
              }

              // Decode the attachment data
              const buffer = Buffer.from(attachmentData, "base64");
              
              // Save attachment to Firestore (not recommended for large files)
              // Instead, it's better to save to Cloud Storage and store the URL in Firestore
              
              // Initialize Cloud Storage
              const storage = admin.storage();
              const bucket = storage.bucket(); // Uses default bucket
              const filePath = `attachments/${messageId}/${attachment.filename}`;
              const file = bucket.file(filePath);

              // Upload the attachment to Cloud Storage
              await file.save(buffer, {
                metadata: {
                  contentType: attachment.mimeType,
                },
              });
              console.log(`Uploaded attachment to Cloud Storage at ${filePath}`);

              // Make the file publicly accessible (optional)
              // await file.makePublic();
              // const publicUrl = file.publicUrl();

              // Alternatively, generate a signed URL
              const [signedUrl] = await file.getSignedUrl({
                action: "read",
                expires: "03-01-2500", // Set a far future expiration date
              });

              // Save attachment info to emailData
              emailData.attachments.push({
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                url: signedUrl, // or publicUrl if made public
              });
            }
          }

          // Save email data to Firestore
          await firestore.collection("emails").doc(messageId).set(emailData);
          console.log(`Saved email ID: ${messageId} to Firestore.`);

          // Mark the message as read by removing the "UNREAD" label
          await gmail.users.messages.modify({
            userId: "invoice@masstogether.com",
            id: messageId,
            requestBody: {
              removeLabelIds: ["UNREAD"],
            },
          });
          console.log(`Marked message ID: ${messageId} as read.`);

          // Add any additional processing here

        } catch (messageError) {
          console.error(`Error processing message ID: ${messageMeta.id}`, messageError);
          // Optionally, continue processing other messages or decide to rethrow
        }
      }

      console.log("Finished processing all unread messages.");
      return; // return void
    } catch (error) {
      console.error("Error reading invoice emails:", error);
      throw new Error("Failed to read invoice emails.");
    }
  }
);
