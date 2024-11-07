const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const OpenAIApi = require('openai');
const pdf2pic = require('pdf2pic').fromPath; // You'll need the `pdf2pic` package

const inputDir = '../../../ocr';
const outputDir = '../../../output';

// Initialize OpenAI API with Configuration
const openai = new OpenAIApi({
    apiKey: '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', // Use environment variable for the API key
});

// Function to convert a PDF page to base64 encoded image
async function pdfPageToBase64(pdfPath, page = 1) {
    const convert = pdf2pic(pdfPath, {
        density: 72,
        saveFilename: "temp",
        savePath: outputDir,
        format: "jpeg",
    });

    // Convert the specified page to an image
    const result = await convert(page);
    const imageBuffer = await fs.readFile(result.path);
    return imageBuffer.toString('base64');
}

// Function to convert a PDF to JSON using the OpenAI API and base64 image
async function pdfToJson(pdfPath) {
    try {
        // Convert PDF's first page to base64 image
        const base64Image = await pdfPageToBase64(pdfPath, 1);
        const imageUrl = `data:image/jpeg;base64,${base64Image}`;

        console.log('Sending base64 encoded image to OpenAI API...');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: "user",
                    content: JSON.stringify([
                        {
                            type: "text",
                            text: "Extract structured data from this image",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ]),
                }
            ],
        });

        console.log('Received response from OpenAI API');
        
        if (!response.choices || response.choices.length === 0) {
            throw new Error('No choices in the API response');
        }

        let jsonString = response.choices[0].message.content.trim();
        console.log('Raw JSON string:', jsonString);

        jsonString = jsonString.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();

        console.log('Cleaned JSON string:', jsonString);

        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error in pdfToJson:', error);
        throw error;
    }
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
            const jsonData = await pdfToJson(itemPath);

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
