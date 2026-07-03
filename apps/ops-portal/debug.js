const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER_ERROR:', error));
  
  console.log('Navigating to login...');
  await page.goto('http://localhost:4301');
  
  console.log('Filling credentials...');
  // Find the username input which is the first input without type="password"
  const inputs = page.locator('.input');
  await inputs.nth(0).fill('admin');
  await inputs.nth(1).fill('oStpxWqVZm0GiSjBeGyN');
  
  // Click login
  await page.click('.btn-primary');
  
  console.log('Waiting for login to complete...');
  await page.waitForTimeout(2000);
  
  console.log('Navigating to product page...');
  await page.goto('http://localhost:4301/products/7c13d69f-2c8a-4cfd-aea4-b048fcfb09a6', { waitUntil: 'networkidle' });
  
  console.log('Waiting 3 seconds to catch errors...');
  await page.waitForTimeout(3000);
  
  await browser.close();
})();
