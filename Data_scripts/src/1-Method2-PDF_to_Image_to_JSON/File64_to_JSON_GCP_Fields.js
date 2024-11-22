const fs = require('fs-extra');
const path = require('path');
const OpenAIApi = require('openai');
const pdfParse = require('pdf-parse');

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node script.js <base64_dir> <pdf_dir> <output_dir>');
  process.exit(1);
}

const [base64Dir, pdfDir, outputDir] = args;

// Initialize OpenAI API with your API key
require('dotenv').config();

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY
});

// Fields to request in the response JSON
const requiredFields = {
  invoice_id: "",
  invoice_date: "",
  due_date: "",
  purchase_order: "",
  payment_terms: "",
  invoice_type: "",
  currency: "",
  supplier_name: "",
  supplier_address: "",
  supplier_phone: "",
  supplier_email: "",
  supplier_website: "",
  supplier_tax_id: "",
  supplier_remittance_address: "",
  customer_name: "",
  customer_address: "",
  customer_phone: "",
  customer_email: "",
  receiver_name: "",
  receiver_address: "",
  ship_to_name: "",
  ship_to_address: "",
  carrier: "",
  tracking_number: "",
  shipping_amount: "",
  delivery_date: "",
  service_start_date: "",
  service_end_date: "",
  billing_address: "",
  billing_name: "",
  remit_to_name: "",
  remit_to_address: "",
  total_amount: "",
  net_amount: "",
  tax_amount: "",
  tax_rate: "",
  discount_amount: "",
  adjustment_amount: "",
  freight_amount: "",
  amount_due: "",
  terms: "",
  notes: "",
  reference_number: "",
  order_id: "",
  account_number: "",
  customer_id: "",
  payment_method: "",
  subtotal: "",
  balance: "",
  vat_number: "",
  excise_duty: "",
  customs_declaration_number: "",
  contact_person: "",
  creation_date: "",
  payment_date: "",
  approval_date: "",
  supplier_code: "",
  customer_code: "",
  contract_number: "",
  project_code: "",
  line_items: [
    {
      description: "",
      quantity: "",
      unit_price: "",
      amount: "",
      sku: "",
      part_number: "",
      date: "",
      tax_amount: "",
      discount_amount: "",
      unit: "",
      hsn_code: "",
      po_number: "",
      product_code: ""
    }
  ]
};

// Function to process a Base64 file and get the API response
async function base64ToJson(base64Data, pdfText) {
  try {
    console.log('Sending request to OpenAI API...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Please extract the information from this invoice image and populate the following fields in JSON format:\n\n${JSON.stringify(requiredFields)}\n\nAlso, use this raw text from the image as reference:\n${pdfText}`
        },
        {
          role: 'user',
          content: `data:image/png;base64,${base64Data}`
        }
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    console.log('Received response from OpenAI API');

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in the API response');
    }

    let jsonString = response.choices[0].message.content.trim();
    console.log('Raw JSON string:', jsonString);

    // Remove code fences if they exist
    jsonString = jsonString.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();

    console.log('Cleaned JSON string:', jsonString);

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in base64ToJson:', error);
    throw error;
  }
}

// Function to format JSON with custom settings
function customStringify(obj, space) {
  const indent = ' '.repeat(space);
  return JSON.stringify(obj, null, space)
    .replace(/\n/g, '\r\n')
    .replace(/^(\s*)(.*)(: \{|\[)$/gm, `$1$2$3\r\n${indent}`)
    .replace(/^(\s*)\}/gm, `\r\n$1}`)
    .replace(/^(\s*)\]/gm, `\r\n$1]`)
    .replace(/^\s*[\r\n]/gm, ''); // Remove empty lines
}

// Function to process Base64 files and corresponding PDFs
async function processDirectory(base64Path, pdfBasePath, outputPath) {
  await fs.ensureDir(outputPath);

  const items = await fs.readdir(base64Path);
  for (const item of items) {
    const itemPath = path.join(base64Path, item);
    const outputItemPath = path.join(outputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      const pdfSubPath = path.join(pdfBasePath, item);
      await processDirectory(itemPath, pdfSubPath, outputItemPath);
    } else if (path.extname(item).toLowerCase() === '.txt') {
      console.log(`Processing Base64 file: ${itemPath}`);
      const baseName = path.basename(item, '.jpg.txt'); // Assuming filenames end with '.jpg.txt'
      const base64Data = await fs.readFile(itemPath, 'utf8');

      // Find the corresponding PDF file
      const pdfFileName = `${baseName}.pdf`;
      const pdfFilePath = path.join(pdfBasePath, pdfFileName);

      let pdfText = '';
      try {
        const pdfBuffer = await fs.readFile(pdfFilePath);
        const pdfData = await pdfParse(pdfBuffer);
        pdfText = pdfData.text.trim();
        console.log(`Extracted text from PDF: ${pdfFilePath}`);
      } catch (error) {
        console.warn(`Warning: Could not read PDF file ${pdfFilePath}. Continuing without PDF text.`);
      }

      const jsonData = await base64ToJson(base64Data, pdfText);

      const jsonFilePath = outputItemPath.replace(/\.txt$/, '.json');
      await fs.writeFile(jsonFilePath, customStringify(jsonData, 2));
      console.log(`Saved JSON: ${jsonFilePath}`);
    }
  }
}

// Start the process
(async () => {
  try {
    await processDirectory(base64Dir, pdfDir, outputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing files:', error);
  }
})();
