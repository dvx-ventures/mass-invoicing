const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

// Define header fields and items fields based on the Invoice Parser entities
const headerFields = ["filename", "invoice_id", "invoice_date", "due_date", "purchase_order", "payment_terms", "invoice_type", "currency", "supplier_name", "supplier_address", "supplier_phone", "supplier_email", "supplier_website", "supplier_tax_id", "supplier_remittance_address", "customer_name", "customer_address", "customer_phone", "customer_email", "receiver_name", "receiver_address", "ship_to_name", "ship_to_address", "carrier", "tracking_number", "shipping_amount", "delivery_date", "service_start_date", "service_end_date", "billing_address", "billing_name", "remit_to_name", "remit_to_address", "total_amount", "net_amount", "tax_amount", "tax_rate", "discount_amount", "adjustment_amount", "freight_amount", "amount_due", "terms", "notes", "reference_number", "order_id", "account_number", "customer_id", "payment_method", "subtotal", "balance", "vat_number", "excise_duty", "customs_declaration_number", "contact_person", "creation_date", "payment_date", "approval_date", "supplier_code", "customer_code", "contract_number", "project_code"];

const itemsFields = ["filename", "line_item/description", "line_item/quantity", "line_item/unit_price", "line_item/amount", "line_item/sku", "line_item/part_number", "line_item/date", "line_item/tax_amount", "line_item/discount_amount", "line_item/unit", "line_item/hsn_code", "line_item/po_number","line_item/product_code"];

// Helper function to get the value of a field
function getFieldValue(data, field) {
  if (data[field] && data[field]["value"] !== undefined) {
    return data[field]["value"];
  }
  return '';
}

// Process the header data
function processHeaderData(data, filename) {
  const headerData = { filename };
  headerFields.slice(1).forEach(field => { // Skip "filename" as it's added separately
    headerData[field] = getFieldValue(data, field);
  });
  return headerData;
}

// Process the items data
function processItemsData(data, filename) {
  const items = data["line_items"] || [];
  return items.map(item => {
    const itemData = { filename };
    itemsFields.slice(1).forEach(field => { // Skip "filename" as it's added separately
      itemData[field] = getFieldValue(item, field);
    });
    return itemData;
  });
}

// Traverse the directory and process each JSON file
function traverseDirectory(dir, headerData, itemsData) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      traverseDirectory(fullPath, headerData, itemsData); // Recursive call for subdirectories
    } else if (path.extname(fullPath).toLowerCase() === '.json') {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const filename = path.basename(fullPath);

      // Process header and items data from the JSON
      const headerRow = processHeaderData(data, filename);
      headerData.push(headerRow);

      const itemsRows = processItemsData(data, filename);
      itemsData.push(...itemsRows);
    }
  });
}

// Main function
function main(inputDir, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const headerData = [];
  const itemsData = [];

  // Traverse the input directory to gather data from JSON files
  traverseDirectory(inputDir, headerData, itemsData);

  // Write the aggregated data to CSV files
  const headerCSV = parse(headerData, { fields: headerFields });
  const itemsCSV = parse(itemsData, { fields: itemsFields });

  fs.writeFileSync(path.join(outputDir, 'header.csv'), headerCSV);
  fs.writeFileSync(path.join(outputDir, 'items.csv'), itemsCSV);

  console.log(`Generated header.csv and items.csv in ${outputDir}`);
}

// Run the script with input and output directory arguments
const inputDir = process.argv[2];
const outputDir = process.argv[3];
if (!inputDir || !outputDir) {
  console.error("Please provide input and output directory paths.");
  console.error("Usage: node script.js <inputDir> <outputDir>");
  process.exit(1);
}
main(inputDir, outputDir);
