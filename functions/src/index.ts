import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { onRequest } from 'firebase-functions/v2/https';
import { Invoice, SupplierRecord } from './types';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const firestore = admin.firestore();
//const storage = admin.storage();

const projectId = "mass-7e4f9";
const location = "us"; // e.g. us, eu
const processorId = "4a6027a84b72700b";

const document_client = new DocumentProcessorServiceClient();

// Initialize Secret Manager Client
const client = new SecretManagerServiceClient();

const numericKeys = new Set([
  'net_amount',
  'total_amount',
  'total_tax_amount',
  'quantity',
  'unit_price',
  'amount',
  'freight_amount',
  'subtotal',
  'discount_amount',
  'discount_rate',
  'tax_amount',
  'tax_rate',
  'invoice_total',
  'amount_due',
  'previous_unpaid_amount',
  'payment_amount',
  'other_fees'
]);

function toCustomTitleCase(str: string): string {
  const words = str.split(' ');
  return words.map(word => {
    // If the word is fully uppercase and length ≤ 2, keep it uppercase
    if (word === word.toUpperCase() && word.length <= 2) {
      return word;
    }
    // Otherwise, standard title case: first letter uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function parseNumeric(str: string): number | null {
  // Remove commas and attempt to parse as float
  const withoutCommas = str.replace(/,/g, '');
  const parsed = parseFloat(withoutCommas);
  if (!isNaN(parsed)) {
    return parsed;
  }
  return null; // Return null if not a valid number
}

function cleanString(str: string, key: string | null): string | number {
  // Replace newline characters with space
  let cleaned = str.replace(/\n/g, ' ');
  // Reduce multiple whitespace sequences to a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  if (key) {
    // Extract the last part of the key after any slash
    const lastKeyPart = key.includes('/') ? key.split('/').pop() : key;
    if (lastKeyPart && numericKeys.has(lastKeyPart)) {
      const numericValue = parseNumeric(cleaned);
      if (numericValue !== null) {
        return numericValue;
      }
    }
  }

  const isAllLower = cleaned === cleaned.toLowerCase();
  const isAllUpper = cleaned === cleaned.toUpperCase();

  if (isAllLower || isAllUpper) {
    cleaned = toCustomTitleCase(cleaned);
  }

  return cleaned;
}

function processJsonValue(value: any, key: string | null = null): any {
  if (typeof value === 'string') {
    return cleanString(value, key);
  } else if (Array.isArray(value)) {
    return value.map((v, i) => processJsonValue(v, null));
  } else if (value && typeof value === 'object') {
    const newObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      // Pass the key along to check if it's numeric
      newObj[k] = processJsonValue(v, k);
    }
    return newObj;
  }
  // For numbers, booleans, null, leave as is.
  return value;
}

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


function normalizeSupplierName(name: string): string {
  // Remove newline characters
  name = name.replace(/\r?\n|\r/g, ' ');

  // Basic normalization: lowercase, trim, remove punctuation
  let normalized = name.toLowerCase().trim();
  normalized = normalized.replace(/[^\w\s]/gi, ''); // remove punctuation
  // Remove common suffixes
  normalized = normalized.replace(/\b(llc|inc|co|company|corp|corporation)\b/gi, '').trim();

  // Collapse multiple spaces into a single space
  normalized = normalized.replace(/\s+/g, ' ');
  console.log("supplier_name:",normalized);
  return normalized;
}


function convertEmptyFieldsToEmptyString<T extends Record<string, any>>(obj: T): T {
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] === undefined || obj[key] === null) {
      newObj[key] = "";
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj as T;
}

export const buildSupplierList = onRequest({ timeoutSeconds: 540 }, async (req, res) => {
  const db = admin.firestore();
  // 1. Fetch all invoices from the 'invoice' collection
  const invoicesSnap = await db.collection('invoice').get();
  const invoices: Invoice[] = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[];

  // 2. Build a map to deduplicate suppliers
  const supplierMap: { [key: string]: SupplierRecord } = {};

  for (const invoice of invoices) {
    if (!invoice.supplier_name) continue;

    const normalizedName = normalizeSupplierName(invoice.supplier_name);
    /*const normalizedAddress = invoice.supplier_address
      ? invoice.supplier_address.toLowerCase().trim()
      : 'unknown_address';*/

    const supplierKey = normalizedName;

    if (!supplierMap[supplierKey]) {
      supplierMap[supplierKey] = {
        supplier_name: invoice.supplier_name,
        createdAt: admin.firestore.Timestamp.now(),
        invoice_ids: [invoice.id],
        matched_names: [invoice.supplier_name],
        supplier_address: invoice.supplier_address,
        supplier_email: invoice.supplier_email,
        supplier_phone: invoice.supplier_phone
      };
    } else {
      const supplierRecord = supplierMap[supplierKey];

      if (!supplierRecord.invoice_ids.includes(invoice.id)) {
        supplierRecord.invoice_ids.push(invoice.id);
      }

      if (!supplierRecord.matched_names.includes(invoice.supplier_name)) {
        supplierRecord.matched_names.push(invoice.supplier_name);
      }

      if (!supplierRecord.supplier_address && invoice.supplier_address) {
        supplierRecord.supplier_address = invoice.supplier_address;
      }
      if (!supplierRecord.supplier_email && invoice.supplier_email) {
        supplierRecord.supplier_email = invoice.supplier_email;
      }
      if (!supplierRecord.supplier_phone && invoice.supplier_phone) {
        supplierRecord.supplier_phone = invoice.supplier_phone;
      }
    }
  }

  // 3. Write results to Firestore into 'supplier' collection
  const batch = db.batch();
  const suppliersRef = db.collection('supplier');

  Object.values(supplierMap).forEach(supplier => {
    const cleanedSupplier = convertEmptyFieldsToEmptyString(supplier);
    const docRef = suppliersRef.doc();
    batch.set(docRef, cleanedSupplier);
  });

  await batch.commit();

  res.status(200).json({ message: 'Supplier canonical list has been built/updated successfully.' });
});

export const processInvoice = onDocumentCreated(
  {
    document: "email/{docId}",
  },
  async (event) => {
    const docId = event.params.docId;
    const data = event.data?.data();

    if (!data) {
      console.error(`No data found for docId: ${docId}`);
      return;
    }

    if (!data.attachments || data.attachments.length === 0) {
      console.log(`No attachments found for docId: ${docId}. Nothing to process.`);
      return;
    }

    const attachment = data.attachments[0];
    const fileUrl = attachment.url;

    if (attachment.mimeType !== "application/pdf") {
      console.log(`Attachment is not a PDF, skipping invoice processing for docId: ${docId}.`);
      return;
    }

    if (!fileUrl) {
      console.error(`No attachment URL found for docId: ${docId}`);
      return;
    }

    console.log(`Processing invoice for docId: ${docId} from URL: ${fileUrl}`);

    try {
      const ext = ".pdf";
      const tempFilePath = path.join(os.tmpdir(), uuidv4() + ext);

      const fetch = await import("node-fetch");
      const response = await fetch.default(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch the attachment file from: ${fileUrl}, status: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(tempFilePath, buffer);
      console.log(`Downloaded attachment to ${tempFilePath}`);

      const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

      const request = {
        name: name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: attachment.mimeType || "application/pdf"
        }
      };

      console.log("Sending document to Document AI for invoice parsing...");

      const [result] = await document_client.processDocument(request);
      console.log("Document AI processing complete.");

      const parsedDocument = result.document;
      if (!parsedDocument) {
        console.error("No parsed document returned from Document AI.");
        return;
      }

      const invoiceFields: Record<string, any> = {};
      const line_items: any[] = [];
      const fieldsConfidence: { field: string; confidence: number }[] = [];

      if (parsedDocument.entities) {
        let lineItemIndex = 0;
        for (const entity of parsedDocument.entities) {
          if (entity.type === "line_item") {
            const lineItem: Record<string, any> = {};
            if (entity.properties) {
              for (const prop of entity.properties) {
                if (prop.type && prop.mentionText) {
                  lineItem[prop.type] = prop.mentionText;
                  fieldsConfidence.push({
                    field: `line_item.${lineItemIndex}.${prop.type}`,
                    confidence: prop.confidence ?? 0,
                  });
                }
              }
            }
            line_items.push(lineItem);
            lineItemIndex++;
          } else if (entity.type && entity.mentionText) {
            invoiceFields[entity.type] = entity.mentionText;
            fieldsConfidence.push({
              field: entity.type,
              confidence: entity.confidence ?? 0,
            });
          }
        }
      }

      console.log("Extracted invoice fields:", invoiceFields);
      console.log("Extracted line_items:", line_items);
      console.log("Fields confidence mapping:", fieldsConfidence);

      let invoiceDoc = {
        emailDocId: docId,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        url: fileUrl, // Renamed from attachmentUrl to url
        file_name: attachment.filename, // New field: file name of the attachment
        folder_name: "attachments", // New field: hard-coded value
        labels: [], // New field: empty array
        organizationId: "00000001", // New field: hard-coded value

        ...invoiceFields,
        line_items,
        fieldsConfidence,

        // Include fields from the original email document
        from: data.from,
        messageId: data.messageId,
        receivedAt: data.receivedAt,
        snippet: data.snippet,
        subject: data.subject,
      };

      invoiceDoc = processJsonValue(invoiceDoc);
      await firestore.collection("invoice").add(invoiceDoc);
      console.log(`Saved parsed invoice data to "invoices" collection for docId: ${docId}`);

      // Cleanup temp file
      fs.unlinkSync(tempFilePath);

    } catch (error) {
      console.error(`Error processing invoice for docId: ${docId}`, error);
    }
  }
);



export const readInvoiceEmail = onSchedule(
  {
    schedule: "every 5 minutes",
  },
  async (event) => {
    console.log("readInvoiceEmail function triggered by scheduler.");
    console.log("test 4");
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
          await firestore.collection("email").doc(messageId).set(emailData);
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
      console.error("Error reading invoice email:", error);
      throw new Error("Failed to read invoice email.");
    }
  }
);
