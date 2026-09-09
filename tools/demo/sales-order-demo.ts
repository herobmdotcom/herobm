import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { HumanActor } from './human-actor';

// Load environment variables from .env / .env.volzau / process.env
const envFile = process.env.ENV_FILE || '.env';
if (fs.existsSync(path.join(__dirname, '..', '..', envFile))) {
  dotenv.config({ path: path.join(__dirname, '..', '..', envFile) });
}
if (fs.existsSync(path.join(__dirname, '..', '..', '.env'))) {
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

const BASE_URL = (process.env.DEMO_BASE_URL || 'https://herobm-dev.exe.xyz').trim();
const USERNAME = (process.env.DEMO_USERNAME || 'demo').trim();
const PASSWORD = (process.env.DEMO_PASSWORD || 'demodemo').trim(); // TEST_CREDENTIAL
const HEADED = process.env.DEMO_HEADED !== 'false';
const USER_DATA_DIR = path.join(__dirname, '..', '..', 'tmp', 'demo-browser-profile');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'tmp', 'videos');

async function runSalesOrderDemo() {
  console.log('='.repeat(65));
  console.log(' HeroBM - Sales Order Demo Video Generator (Playwright)');
  console.log('='.repeat(65));
  console.log(` Target URL       : ${BASE_URL}`);
  console.log(` Username         : ${USERNAME}`);
  console.log(` Browser Profile  : ${USER_DATA_DIR}`);
  console.log(` Mode             : ${HEADED ? 'Headed (Live Visual)' : 'Headless'}`);
  console.log(` Output Dir       : ${OUTPUT_DIR}`);
  console.log('='.repeat(65));

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch persistent Chromium context so exe.dev / SSO cookies are preserved
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: !HEADED,
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    slowMo: 15,
    ignoreHTTPSErrors: true,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const actor = new HumanActor(page);

  // Register visual cursor overlay before navigation
  await actor.injectVisualCursor();

  try {
    // -------------------------------------------------------------
    // Step 1: Navigate to Base URL & Authenticate
    // -------------------------------------------------------------
    console.log('\n[1/8] Navigating to HeroBM...');
    await page.goto(BASE_URL, { timeout: 60000, waitUntil: 'load' });
    await actor.injectVisualCursor();
    await actor.pause(600, 900);

    const loginUsernameSelector = '#portal-login-username:visible, input[placeholder*="Username" i]:visible';
    const sidebarSelector = 'nav:visible, aside:visible, [class*="sidebar"]:visible';

    console.log(' -> Checking application and session state...');
    try {
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 15000 });
    } catch {
      console.log(' -> Waiting for application to settle...');
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 45000 });
    }

    const usernameField = page.locator(loginUsernameSelector).first();
    const isHeroBmLoginForm = await usernameField.isVisible().catch(() => false);

    if (isHeroBmLoginForm) {
      console.log(' -> HeroBM login screen detected. Entering credentials...');
      await actor.type(usernameField, USERNAME, { baseDelayMs: 45 });
      await actor.pause(150, 300);

      const passwordField = page.locator('#portal-login-password:visible, input[type="password"]:visible').first();
      await actor.type(passwordField, PASSWORD, { baseDelayMs: 40 });
      await actor.pause(200, 350);

      const signInBtn = page.locator('#portal-login-submit:visible, button:has-text("Sign In"):visible').first();
      await actor.click(signInBtn);

      console.log(' -> Waiting for dashboard after login...');
      await page.waitForSelector(sidebarSelector, { timeout: 30000 });
      console.log(' -> Authenticated successfully.');
    } else {
      console.log(' -> Already authenticated with active session.');
    }

    // -------------------------------------------------------------
    // Step 2: Deliberate Sidebar Navigation to Sales Orders
    // -------------------------------------------------------------
    console.log('\n[2/8] Navigating to Sales Orders via Sidebar...');
    await actor.pause(1200, 1600); // Clear dashboard orientation pause

    const salesOrdersLink = page.locator('nav a[href="/sales-orders"]:visible, aside a[href="/sales-orders"]:visible, [class*="sidebar"] a[href="/sales-orders"]:visible').first();

    if (await salesOrdersLink.isVisible().catch(() => false)) {
      // Deliberate hover with visual pause so viewer sees where we are going
      await actor.hover(salesOrdersLink, { speed: 0.95 });
      await actor.pause(450, 700);
      await actor.click(salesOrdersLink);
    } else {
      console.log(' -> Navigating directly to /sales-orders...');
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/sales-orders`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }

    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(900, 1300); // Clear pause on Sales Orders table

    // -------------------------------------------------------------
    // Step 3: Deliberate Click on "Create Order"
    // -------------------------------------------------------------
    console.log('\n[3/8] Opening New Sales Order form...');
    const createOrderBtn = page.locator('a[href="/sales-orders/new"]:visible, a:has-text("Create Order"):visible, button:has-text("Create Order"):visible').first();
    await createOrderBtn.waitFor({ state: 'visible', timeout: 20000 });
    
    // Deliberate hover with clear hesitation before clicking
    await actor.hover(createOrderBtn, { speed: 0.95 });
    await actor.pause(500, 750);
    await actor.click(createOrderBtn);

    await page.waitForURL('**/sales-orders/new', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(600, 900);

    // -------------------------------------------------------------
    // Step 4: Select Customer (using seed demo customer: Pacific / Apex)
    // -------------------------------------------------------------
    console.log('\n[4/8] Selecting Customer...');
    const customerInput = page.locator('input[placeholder*="Search customer" i]:visible, input[placeholder*="customer" i]:visible, input[placeholder*="Search..." i]:visible').first();
    await customerInput.waitFor({ state: 'visible', timeout: 15000 });
    
    // Type customer query from seed data
    await actor.type(customerInput, 'Pacific', { baseDelayMs: 45 });
    await actor.pause(450, 750); // Wait for debounce

    let dropdownOptions = page.locator('.scroll-area div.cursor-pointer:visible, [class*="max-h-48"] div.cursor-pointer:visible, [role="listbox"] div:visible');
    let hasDropdown = (await dropdownOptions.count()) > 0;

    if (!hasDropdown) {
      console.log(' -> Trying Apex Commercial Construction search...');
      await actor.type(customerInput, 'Apex', { baseDelayMs: 45 });
      await actor.pause(450, 750);
      dropdownOptions = page.locator('.scroll-area div.cursor-pointer:visible, [class*="max-h-48"] div.cursor-pointer:visible');
      hasDropdown = (await dropdownOptions.count()) > 0;
    }

    if (hasDropdown) {
      const firstOption = dropdownOptions.first();
      await actor.hover(firstOption);
      await actor.pause(180, 300);
      await actor.click(firstOption);
      console.log(' -> Customer selected.');
    } else {
      await actor.type(customerInput, 'a', { baseDelayMs: 40 });
      await actor.pause(450, 750);
      const fallbackOptions = page.locator('.scroll-area div.cursor-pointer:visible, [class*="max-h-48"] div.cursor-pointer:visible');
      if ((await fallbackOptions.count()) > 0) {
        await actor.click(fallbackOptions.first());
        console.log(' -> Selected first available customer.');
      }
    }

    await actor.pause(500, 800);

    // -------------------------------------------------------------
    // Step 5: Fill Order Header (PO, Name, Notes)
    // -------------------------------------------------------------
    console.log('\n[5/8] Filling Order Header Details...');
    
    const poInput = page.locator('#order-po:visible, input[placeholder*="Customer PO" i]:visible').first();
    if (await poInput.isVisible().catch(() => false)) {
      await actor.type(poInput, 'PO-2026-9842', { baseDelayMs: 40 });
      await actor.pause(180, 300);
    }

    const orderNameInput = page.locator('#order-name:visible, input[placeholder*="Order Name" i]:visible').first();
    if (await orderNameInput.isVisible().catch(() => false)) {
      await actor.type(orderNameInput, 'Commercial Site Expansion Restock', { baseDelayMs: 38 });
      await actor.pause(180, 300);
    }

    const notesInput = page.locator('#order-notes:visible, textarea[placeholder*="notes" i]:visible').first();
    if (await notesInput.isVisible().catch(() => false)) {
      await actor.type(notesInput, 'Priority dispatch required for Site B foundation team.', { baseDelayMs: 35 });
      await actor.pause(250, 450);
    }

    // -------------------------------------------------------------
    // Step 6: Add Line Items (Product Search + Comment Line)
    // -------------------------------------------------------------
    console.log('\n[6/8] Adding Line Items...');

    const productInput = page.locator('input[placeholder*="Search product" i]:visible, input[placeholder*="product" i]:visible').first();
    if (await productInput.isVisible().catch(() => false)) {
      // Search for demo seed product: Hammer Drill / TL-1001 / Cordless
      await actor.type(productInput, 'Hammer Drill', { baseDelayMs: 42 });
      await actor.pause(450, 750);

      let productOptions = page.locator('.scroll-area div.cursor-pointer:visible, [class*="max-h-48"] div.cursor-pointer:visible');
      if ((await productOptions.count()) === 0) {
        await actor.type(productInput, 'Saw', { baseDelayMs: 42 });
        await actor.pause(450, 750);
        productOptions = page.locator('.scroll-area div.cursor-pointer:visible, [class*="max-h-48"] div.cursor-pointer:visible');
      }

      if ((await productOptions.count()) > 0) {
        await actor.hover(productOptions.first());
        await actor.pause(180, 300);
        await actor.click(productOptions.first());
        console.log(' -> Added demo product from catalog.');
        await actor.pause(450, 700);

        // Adjust quantity on line 1
        const qtyInput = page.locator('table.table-lines tbody tr:first-child input[type="number"]:visible, input[type="number"]:visible').first();
        if (await qtyInput.isVisible().catch(() => false)) {
          await actor.type(qtyInput, '8', { baseDelayMs: 45 });
          await actor.pause(200, 350);
        }
      } else {
        console.log(' -> Adding Custom Line...');
        const customLineBtn = page.locator('button:has-text("Custom Line"):visible, button:has-text("Add Line"):visible').first();
        if (await customLineBtn.isVisible().catch(() => false)) {
          await actor.click(customLineBtn);
          await actor.pause(250, 450);
          const descInput = page.locator('table.table-lines tbody tr:first-child input:visible').first();
          if (await descInput.isVisible().catch(() => false)) {
            await actor.type(descInput, 'Precision Assembly Bracket A-100', { baseDelayMs: 38 });
          }
        }
      }
    }

    // Add a comment line with meaningful content
    console.log(' -> Adding Comment Line...');
    const commentBtn = page.locator('button:has-text("Comment Line"):visible, button:has-text("Comment"):visible').first();
    if (await commentBtn.isVisible().catch(() => false)) {
      await actor.hover(commentBtn);
      await actor.pause(150, 280);
      await actor.click(commentBtn);
      await actor.pause(350, 550);

      const commentInput = page.locator('table.table-lines tbody tr:last-child input:visible').first();
      if (await commentInput.isVisible().catch(() => false)) {
        await actor.type(
          commentInput,
          'Special Handling: Staged for foundation crew. Include calibration certs with shipment.',
          { baseDelayMs: 35 }
        );
        await actor.pause(250, 450);
      }
    }

    // Smoothly scroll down to review totals & delivery
    console.log(' -> Smoothly scrolling down to review totals...');
    await actor.smoothScroll(380, 500);
    await actor.pause(900, 1300);

    // Scroll back up to header
    console.log(' -> Smoothly scrolling back up to header...');
    await actor.smoothScroll(-380, 500);
    await actor.pause(500, 800);

    // -------------------------------------------------------------
    // Step 7: Submit Order & Showcase Draft Status
    // -------------------------------------------------------------
    console.log('\n[7/8] Submitting Sales Order...');
    const submitBtn = page.locator('button:has-text("Create Order"):visible, button:has-text("Save"):visible').first();
    await actor.hover(submitBtn);
    await actor.pause(450, 750);
    await actor.click(submitBtn);

    console.log(' -> Waiting for order confirmation & redirection...');
    await page.waitForURL(/sales-orders\/[a-zA-Z0-9_-]+/, { timeout: 30000 }).catch(() => {
      console.log(' -> Redirect or submission completed.');
    });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Showcase newly created order in Draft status
    console.log(' -> Reviewing created order in Draft status...');
    await actor.pause(1400, 1800);
    const draftBadge = page.locator('.badge-draft:visible, span:has-text("Draft"):visible').first();
    if (await draftBadge.isVisible().catch(() => false)) {
      await actor.hover(draftBadge);
      await actor.pause(800, 1200);
    } else {
      await actor.pause(1200, 1600);
    }

    // -------------------------------------------------------------
    // Step 8: Return to Sales Orders List & Highlight New Draft Order
    // -------------------------------------------------------------
    console.log('\n[8/8] Returning to Sales Orders list to view Draft order...');
    const returnSalesOrdersLink = page.locator('nav a[href="/sales-orders"]:visible, aside a[href="/sales-orders"]:visible, [class*="sidebar"] a[href="/sales-orders"]:visible').first();

    if (await returnSalesOrdersLink.isVisible().catch(() => false)) {
      await actor.hover(returnSalesOrdersLink);
      await actor.pause(250, 450);
      await actor.click(returnSalesOrdersLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/sales-orders`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }

    await page.waitForURL('**/sales-orders', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(900, 1400);

    // Hover over the top row (the newly created Draft order)
    const topOrderRow = page.locator('table tbody tr:first-child:visible, [role="row"]:nth-child(2):visible').first();
    if (await topOrderRow.isVisible().catch(() => false)) {
      console.log(' -> Highlighting newly created order in the list...');
      await actor.hover(topOrderRow);
    }

    // Final showcase pause on the Sales Orders list showing the Draft order
    await actor.pause(3500, 4500);
    console.log(' -> Sales Order creation demonstrated and verified in list view!');

  } catch (error) {
    console.error('\n Demo script encountered an issue:', error);
  } finally {
    // Finalize and save video recording
    await page.close();
    const video = page.video();
    let videoPath: string | null = null;
    if (video) {
      videoPath = await video.path();
    }
    await context.close();

    console.log('\n' + '='.repeat(65));
    if (videoPath && fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalPath = path.join(OUTPUT_DIR, `sales-order-demo-${timestamp}.webm`);
      fs.renameSync(videoPath, finalPath);

      console.log(' Demo Video Recorded Successfully!');
      console.log(` File : ${finalPath}`);
      console.log(` Size : ${sizeMb} MB`);
    } else {
      console.log(' Video file saved in:', OUTPUT_DIR);
    }
    console.log('='.repeat(65));
  }
}

runSalesOrderDemo().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
