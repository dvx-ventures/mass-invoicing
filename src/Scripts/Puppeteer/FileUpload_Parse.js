require('dotenv').config(); // Load environment variables from .env file
const puppeteer = require('puppeteer');

(async () => {
  // Launch the browser
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to ChatGPT login page
  await page.goto('https://chat.openai.com/auth/login');

  // Fill in the email field
  await page.waitForSelector('input[name="username"]'); // Selector might need to be updated based on the actual login form
  await page.type('input[name="username"]', process.env.OPENAI_EMAIL);

  // Click the continue button
  await page.click('button[type="submit"]');

  // Wait for password input to load and fill it in
  await page.waitForSelector('input[name="password"]');
  await page.type('input[name="password"]', process.env.OPENAI_PASSWORD);

  // Submit the form
  await page.click('button[type="submit"]');

  console.log("If two-factor authentication is required, please complete it manually.");

  // Wait for the user to complete any manual authentication steps
  await page.waitForNavigation();

  console.log("Logged in successfully!");

  // Now you can navigate within the site as needed

  // Close the browser (optional)
  // await browser.close();
})();
