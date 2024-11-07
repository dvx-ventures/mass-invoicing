const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const OpenAIApi = require('openai');

const inputDir = '../../../ocr';  // specify your input directory
const outputDir = '../../../Experiments'; // specify your output directory

// Initialize OpenAI API with Configuration
require('dotenv').config();

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY, // Reads the API key from the .env file
});

// Function to convert a PDF to JSON using the OpenAI API
async function pdfToJson(pdfBuffer) {
    try {
      const pdfText = (await pdfParse(pdfBuffer)).text;
      console.log(pdfText);
      console.log('Sending request to OpenAI API...');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: "system",
                content: "You are a data analyst that extracts information from PDF text and converts it into a structured JSON format."
            },
            {
                role: "user",
                content: `Please extract the relevant information from the following PDF text and create a JSON invoice for it.  Make sure quantities, prices, amounts and  are parsed as numbers. Do not include any code fences or additional text.**

                PDF Text:
                ${pdfText}`
                            }
                        ],
                        temperature: 0.1,
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
          console.error('Error in pdfToJson:', error);
          throw error;
      }
}

function customStringify(obj, space) {
const indent = ' '.repeat(space);
return JSON.stringify(obj, null, space)
    .replace(/\n/g, '\r\n')
    .replace(/^(\s*)(.*)(: \{|\[)$/gm, `$1$2$3\r\n${indent}`)
    .replace(/^(\s*)\}/gm, `\r\n$1}`)
    .replace(/^(\s*)\]/gm, `\r\n$1]`)
    .replace(/^\s*[\r\n]/gm, '');  // Remove empty lines
}

// Function to traverse directories and process PDFs
async function processDirectory(inputPath, outputPath) {
  await fs.ensureDir(outputPath);

  const items = await fs.readdir(inputPath);
  for (const item of items) {
    const itemPath = path.join(inputPath, item);
    const outputItemPath = path.join(outputPath, item);

    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await processDirectory(itemPath, outputItemPath);
    } else if (path.extname(item).toLowerCase() === '.pdf') {
      console.log(`Processing PDF: ${itemPath}`);
      const pdfBuffer = await fs.readFile(itemPath);
      const jsonData = await pdfToJson(pdfBuffer);

      const jsonFilePath = outputItemPath.replace(/\.pdf$/, '.json');
      await fs.writeFile(jsonFilePath, customStringify(jsonData, 2));
      console.log(`Saved JSON: ${jsonFilePath}`);
    }
  }
}

// Start the process
(async () => {
  try {
    await processDirectory(inputDir, outputDir);
    console.log('Processing complete.');
  } catch (error) {
    console.error('Error processing PDFs:', error);
  }
})();

