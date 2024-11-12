const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

// Define header fields and items fields based on your JSON structure
const headerFields = [
    "filename","additional_notes", "bill_to.address", "bill_to.city", "bill_to.name",
    "bill_to.state", "bill_to.zip", "company.address", "company.name", "company.phone",
    "contact.email", "customer_po", "customer_service_email", "date", "date_shipped", 
    "due_date", "freight_terms", "invoice.branchPlant", "invoice.invoiceDate", 
    "invoice.invoiceNumber", "invoice.salesOrderNumberType", "invoice.shipmentNumber", 
    "invoice.totalInvoice", "invoice_number", "order_date", "page", "paymentTerms.netDueDate", 
    "paymentTerms.terms", "pro_number", "remit_to.address", "remit_to.city", "remit_to.fax", 
    "remit_to.name", "remit_to.phone", "remit_to.state", "remit_to.zip", "sales_agent", 
    "shipTo.address", "shipTo.customerNumber", "shipTo.name", "ship_to.address", "ship_to.city", 
    "ship_to.name", "ship_to.state", "ship_to.zip", "shipped_via", "shipping.FOBDescription", 
    "shipping.POReleaseSalesAgentNumber", "shipping.customerPONumber", "shipping.shipVia", 
    "shipping_info.bill_of_lading", "shipping_info.freight_terms", "shipping_info.pro_number", 
    "shipping_info.shipped_via", "soldTo.address", "soldTo.customerNumber", "soldTo.name", 
    "taxInfo.salesTax", "taxInfo.taxRate", "terms", "totals.merchandise_total", 
    "totals.sales_tax", "totals.taxable_sales", "totals.total_due", "website"
];

const itemsFields = [
    "filename","items[].additionalInfo.DNR", "items[].additionalInfo.GW", "items[].additionalInfo.LotSN",
    "items[].additionalInfo.capacity", "items[].amount", "items[].description", 
    "items[].extendedPrice", "items[].itemNumber", "items[].item_code", "items[].lineNumber", 
    "items[].priceUOM", "items[].qtyShipped", "items[].tax", "items[].total_quantity", 
    "items[].transUOM", "items[].unitPrice", "items[].unit_price", "items[].units_ordered", 
    "items[].units_shipped", "items[].weightNetGross"
];

// Helper function to get the value of a nested field
function getFieldValue(data, fieldPath) {
    return fieldPath.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, data);
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
    const items = data.items || [];
    return items.map(item => {
      const itemData = { filename };
      itemsFields.slice(1).forEach(field => { // Skip "filename" as it's added separately
        const itemField = field.replace('items[].', '');
        itemData[field] = getFieldValue(item, itemField);
      });
      return itemData;
    });
  }
  
  // Convert JSON to CSV format and append to CSV data
  function appendCSVData(fields, rows, existingData) {
    const opts = { fields, header: existingData.length === 0 };
    const csv = parse(rows, opts);
    return existingData + csv + '\n';
  }
  
  // Traverse the directory and process each JSON file
  function traverseDirectory(dir, headerData, itemsData) {
    const files = fs.readdirSync(dir);
  
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
  
      if (stat.isDirectory()) {
        traverseDirectory(fullPath, headerData, itemsData); // Recursive call for subdirectories
      } else if (path.extname(fullPath) === '.json') {
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
    const headerCSV = appendCSVData(headerFields, headerData, '');
    const itemsCSV = appendCSVData(itemsFields, itemsData, '');
  
    fs.writeFileSync(path.join(outputDir, 'header.csv'), headerCSV);
    fs.writeFileSync(path.join(outputDir, 'items.csv'), itemsCSV);
  
    console.log(`Generated header.csv and items.csv in ${outputDir}`);
  }
  
  // Run the script with input and output directory arguments
  const inputDir = process.argv[2];
  const outputDir = process.argv[3];
  if (!inputDir || !outputDir) {
    console.error("Please provide input and output directory paths.");
    process.exit(1);
  }
  main(inputDir, outputDir);
