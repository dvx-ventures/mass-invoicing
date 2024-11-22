const fs = require('fs-extra');
const path = require('path');
const OpenAIApi = require('openai');

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error(
    'Usage: node script.js <input_dir> <output_dir> <error_output_dir>'
  );
  process.exit(1);
}

const [inputDir, outputDir, errorOutputDir] = args;

require('dotenv').config();

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY, // Reads the API key from the .env file
});

// Define the required fields object
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

// Function to map JSON using GPT-4
async function mapJsonWithGPT(jsonData, requiredFields) {
  try {
    const prompt = `You are a helpful assistant that maps JSON data to a master JSON structure.
Given the following original JSON data:
${JSON.stringify(jsonData, null, 2)}

And the master JSON structure:
${JSON.stringify(requiredFields, null, 2)}

Please map the fields from the original JSON to match the master JSON structure.
Output the mapped JSON.
For any fields from the original JSON that couldn't be mapped, output them separately as a JSON object.
Provide your response in the following format:

Mapped JSON:
\`\`\`json
{...}
\`\`\`

Unmapped Fields:
\`\`\`json
{...}
\`\`\``;

    console.log('Sending request to OpenAI API...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        }
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in the API response');
    } else {
      console.log('Received response from OpenAI API');
    }

    const assistantMessage = response.choices[0].message.content;
    console.log('Message content:', assistantMessage);

    // Parse the assistant's response to extract mapped JSON and unmapped fields
    const mappedJsonMatch = assistantMessage.match(
      /Mapped JSON:\s*```json\s*([\s\S]*?)\s*```/
    );
    const unmappedFieldsMatch = assistantMessage.match(
      /Unmapped Fields:\s*```json\s*([\s\S]*?)\s*```/
    );

    let mappedJson = {};
    let unmappedFields = {};

    if (mappedJsonMatch) {
      const mappedJsonString = mappedJsonMatch[1];
      mappedJson = JSON.parse(mappedJsonString);
    } else {
      throw new Error('Mapped JSON not found in GPT response');
    }

    if (unmappedFieldsMatch) {
      const unmappedFieldsString = unmappedFieldsMatch[1];
      unmappedFields = JSON.parse(unmappedFieldsString);
    }

    return { mappedJson, unmappedFields };
  } catch (error) {
    console.error('Error in mapJsonWithGPT:', error);
    throw error;
  }
}

// Function to process directories and JSON files
async function processDirectory(inputPath, outputPath, errorOutputPath) {
  await fs.ensureDir(outputPath);
  await fs.ensureDir(errorOutputPath);

  const items = await fs.readdir(inputPath);
  for (const item of items) {
    const itemPath = path.join(inputPath, item);
    const outputItemPath = path.join(outputPath, item);
    const errorOutputItemPath = path.join(errorOutputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await processDirectory(itemPath, outputItemPath, errorOutputItemPath);
    } else if (path.extname(item).toLowerCase() === '.json') {
      console.log(`Processing JSON file: ${itemPath}`);
      const jsonData = await fs.readJson(itemPath);

      try {
        const { mappedJson, unmappedFields } = await mapJsonWithGPT(
          jsonData,
          requiredFields
        );
        await fs.writeJson(outputItemPath, mappedJson, { spaces: 2 });
        console.log(`Saved mapped JSON: ${outputItemPath}`);

        if (Object.keys(unmappedFields).length > 0) {
          await fs.writeJson(errorOutputItemPath, unmappedFields, { spaces: 2 });
          console.log(`Saved unmapped fields: ${errorOutputItemPath}`);
        }
      } catch (error) {
        console.error(`Error processing file ${itemPath}:`, error);
      }
    }
  }
}

// Start the process
(async () => {
  try {
    await processDirectory(inputDir, outputDir, errorOutputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing files:', error);
  }
})();
