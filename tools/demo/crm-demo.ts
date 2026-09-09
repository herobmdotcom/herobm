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

async function runCrmDemo() {
  console.log('='.repeat(65));
  console.log(' HeroBM - CRM Showcase: The Operations-Driven CRM');
  console.log('='.repeat(65));
  console.log(` Target URL       : ${BASE_URL}`);
  console.log(` Username         : ${USERNAME}`);
  console.log(` Browser Profile  : ${USER_DATA_DIR}`);
  console.log(` Mode             : ${HEADED ? 'Headed (Live Visual)' : 'Headless'}`);
  console.log(` Output Dir       : ${OUTPUT_DIR}`);
  console.log(' Theme            : Dark Mode (herobm-dark)');
  console.log('='.repeat(65));

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch persistent Chromium context with dark mode enforced
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: !HEADED,
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1920, height: 1080 },
    },
    slowMo: 15,
    ignoreHTTPSErrors: true,
  });

  // Inject user preference to ensure instant dark mode on every page load
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'herobm_user_prefs',
        JSON.stringify({ theme: 'dark', density: 'comfortable' }),
      );
      document.documentElement.classList.add('dark', 'herobm-dark');
      document.documentElement.classList.remove('herobm-light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } catch {
      // ignore
    }
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const actor = new HumanActor(page);

  // Register visual cursor overlay before navigation
  await actor.injectVisualCursor();

  try {
    // -------------------------------------------------------------
    // Step 1: Navigate to HeroBM & Authenticate (Dark Mode Entry)
    // -------------------------------------------------------------
    console.log('\n[1/6] Navigating to HeroBM in Dark Mode...');
    await page.goto(BASE_URL, { timeout: 60000, waitUntil: 'load' });
    await actor.injectVisualCursor();
    await actor.pause(700, 1000);

    const loginUsernameSelector = '#portal-login-username:visible, input[placeholder*="Username" i]:visible';
    const sidebarSelector = 'nav:visible, aside:visible, [class*="sidebar"]:visible';

    try {
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 15000 });
    } catch {
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 45000 });
    }

    const usernameField = page.locator(loginUsernameSelector).first();
    const isHeroBmLoginForm = await usernameField.isVisible().catch(() => false);

    if (isHeroBmLoginForm) {
      console.log(' -> Authenticating...');
      await actor.type(usernameField, USERNAME, { baseDelayMs: 45 });
      await actor.pause(150, 300);

      const passwordField = page.locator('#portal-login-password:visible, input[type="password"]:visible').first();
      await actor.type(passwordField, PASSWORD, { baseDelayMs: 40 });
      await actor.pause(200, 350);

      const signInBtn = page.locator('#portal-login-submit:visible, button:has-text("Sign In"):visible').first();
      await actor.click(signInBtn);
      await page.waitForSelector(sidebarSelector, { timeout: 30000 });
    }

    // Ensure dark mode DOM classes are applied
    await page.evaluate(() => {
      document.documentElement.classList.add('dark', 'herobm-dark');
      document.documentElement.classList.remove('herobm-light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    });

    // -------------------------------------------------------------
    // Step 2: The Unified Actor & Dual Commercial View
    // -------------------------------------------------------------
    console.log('\n[2/6] Differentiator 1 & 3: Unified Actor & Dual Commercial Accounts...');
    await actor.pause(1000, 1500);

    // Navigate to Organizations
    const actorsLink = page.locator('nav a[href="/crm/organizations"]:visible, aside a[href="/crm/organizations"]:visible').first();
    if (await actorsLink.isVisible().catch(() => false)) {
      await actor.hover(actorsLink);
      await actor.pause(450, 750);
      await actor.click(actorsLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/organizations`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }
    
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1200, 1600);

    // Type 'Home Hardware' in the quick filter to ensure we select our Unified Actor
    const searchInput = page.locator('input[placeholder*="Search" i]:visible').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await actor.type(searchInput, 'Home Hardware', { baseDelayMs: 40 });
      await actor.pause(1000, 1500);
    }

    // Click the first Actor in the filtered list to open its profile
    const firstActorRow = page.locator('.ag-row:first-child:visible, table tbody tr:first-child:visible').first();
    if (await firstActorRow.isVisible().catch(() => false)) {
      await actor.hover(firstActorRow);
      await actor.pause(400, 600);
      const rowLink = firstActorRow.locator('a').first();
      if (await rowLink.isVisible().catch(() => false)) {
        await actor.click(rowLink);
      } else {
        await actor.click(firstActorRow);
      }
    }
    
    await page.waitForURL(/crm\/organizations\/[a-zA-Z0-9_-]+/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1500, 2000);

    // Switch to Commercial Accounts tab
    const commercialTab = page.locator('button[role="tab"]:has-text("Commercial Accounts"), button:has-text("Commercial Accounts")').first();
    if (await commercialTab.isVisible().catch(() => false)) {
      console.log(' -> Showcasing Dual Commercial Accounts (Customer + Vendor)...');
      await actor.hover(commercialTab);
      await actor.click(commercialTab);
      await actor.pause(1500, 2000);

      // Smooth scroll to reveal both Customer (Sales Orders) and Vendor (Purchase Orders) grids
      await actor.smoothScroll(400, 600);
      await actor.pause(1500, 2000);
      await actor.smoothScroll(-400, 600);
      await actor.pause(500, 1000);
    }

    // -------------------------------------------------------------
    // Step 3: The Omniscient Timeline (System + Human Events)
    // -------------------------------------------------------------
    console.log('\n[3/6] Differentiator 2: The Omniscient Timeline...');
    
    // Switch to Overview/Timeline tab
    const overviewTab = page.locator('button[role="tab"]:has-text("Overview"), button:has-text("Overview")').first();
    if (await overviewTab.isVisible().catch(() => false)) {
      await actor.hover(overviewTab);
      await actor.click(overviewTab);
      await actor.pause(1000, 1500);
    }

    // Scroll down to the Activities Section
    await actor.smoothScroll(500, 700);
    await actor.pause(1500, 2000);

    // Toggle the "System Logs" filter to show intertwined ERP events
    const allActivityFilter = page.locator('button:has-text("All Activity"):visible').first();
    if (await allActivityFilter.isVisible().catch(() => false)) {
      console.log(' -> Toggling Activity Filters to show ERP events...');
      await actor.hover(allActivityFilter);
      await actor.click(allActivityFilter);
      await actor.pause(2500, 3500); // Let the viewer read the system events next to calls
    }

    // -------------------------------------------------------------
    // Step 4: Complex B2B Reality & Relationship Map
    // -------------------------------------------------------------
    console.log('\n[4/6] Differentiator 4: Interactive Relationship Map & Hierarchies...');

    // Switch to Corporate Hierarchy tab
    const hierarchyTab = page.locator('button[role="tab"]:has-text("Corporate Hierarchy"), button:has-text("Corporate Hierarchy")').first();
    if (await hierarchyTab.isVisible().catch(() => false)) {
      await actor.smoothScroll(-500, 700);
      await actor.hover(hierarchyTab);
      await actor.click(hierarchyTab);
      await actor.pause(2000, 2500);
      console.log(' -> Showcasing structural links (Parent/Subsidiary/Partner)...');
    }

    // Navigate to /crm/map
    const mapLink = page.locator('nav a[href="/crm/map"]:visible, aside a[href="/crm/map"]:visible').first();
    if (await mapLink.isVisible().catch(() => false)) {
      await actor.hover(mapLink);
      await actor.click(mapLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/map`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }
    
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1500, 2000);

    // Interact with the map
    const expandNodeBtn = page.locator('.react-flow__node button:has-text("+")').first();
    if (await expandNodeBtn.isVisible().catch(() => false)) {
      console.log(' -> Expanding nodes on the Relationship Graph...');
      await actor.hover(expandNodeBtn);
      await actor.pause(500, 800);
      await actor.click(expandNodeBtn);
      await actor.pause(2500, 3500); // Let the visual expansion sink in
    }

    // -------------------------------------------------------------
    // Step 5: Operationalized Contacts & Dispatch Routing
    // -------------------------------------------------------------
    console.log('\n[5/6] Differentiator 5: Operationalized Contacts (Dispatch Routing)...');
    
    // Navigate to /crm/contacts
    const contactsLink = page.locator('nav a[href="/crm/contacts"]:visible, aside a[href="/crm/contacts"]:visible').first();
    if (await contactsLink.isVisible().catch(() => false)) {
      await actor.hover(contactsLink);
      await actor.click(contactsLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/contacts`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }
    
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1200, 1600);

    // Click the first Contact
    const firstContactRow = page.locator('.ag-row:first-child:visible, table tbody tr:first-child:visible').first();
    if (await firstContactRow.isVisible().catch(() => false)) {
      await actor.hover(firstContactRow);
      await actor.pause(400, 600);
      await actor.click(firstContactRow.locator('a').first().or(firstContactRow));
    }
    
    await page.waitForURL(/crm\/contacts\/[a-zA-Z0-9_-]+/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1500, 2000);

    // Switch to Affiliated Companies Tab
    const affiliationsTab = page.locator('button[role="tab"]:has-text("Affiliated Companies"), button:has-text("Affiliated Companies")').first();
    if (await affiliationsTab.isVisible().catch(() => false)) {
      console.log(' -> Showcasing Multi-Company Affiliations and Dispatch Tags...');
      await actor.hover(affiliationsTab);
      await actor.click(affiliationsTab);
      await actor.pause(2000, 3000);
      
      // Look for badges like "Billing", "Shipping" to hover over
      const dispatchBadge = page.locator('.badge:has-text("billing"), .badge:has-text("shipping"), span:has-text("billing")').first();
      if (await dispatchBadge.isVisible().catch(() => false)) {
        await actor.hover(dispatchBadge);
        await actor.pause(1500, 2000);
      }
    }

    // -------------------------------------------------------------
    // Step 6: Live Deal Revenue Rollup in Opportunities
    // -------------------------------------------------------------
    console.log('\n[6/6] The Finale: Live Deal Revenue Rollup in Opportunities...');
    
    // Navigate to /crm/opportunities
    const oppsLink = page.locator('nav a[href="/crm/opportunities"]:visible, aside a[href="/crm/opportunities"]:visible').first();
    if (await oppsLink.isVisible().catch(() => false)) {
      await actor.hover(oppsLink);
      await actor.click(oppsLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/opportunities`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }
    
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1500, 2000);

    // Click the first Opportunity card
    const oppCard = page.locator('div.card[draggable="true"]:visible, div[draggable="true"]:visible').first();
    if (await oppCard.isVisible().catch(() => false)) {
      await actor.hover(oppCard);
      await actor.pause(500, 800);
      const cardLink = oppCard.locator('a').first();
      if (await cardLink.isVisible().catch(() => false)) {
        await actor.click(cardLink);
      } else {
        await actor.click(oppCard);
      }
    }
    
    await page.waitForURL(/crm\/opportunities\/[a-zA-Z0-9_-]+/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1500, 2000);

    // Switch to Commercial & Quotes Tab
    const oppCommercialTab = page.locator('button[role="tab"]:has-text("Commercial"), button:has-text("Commercial & Quotes")').first();
    if (await oppCommercialTab.isVisible().catch(() => false)) {
      console.log(' -> Showcasing the convergence of CRM Deal Value with real ERP Billed Revenue...');
      await actor.hover(oppCommercialTab);
      await actor.click(oppCommercialTab);
      await actor.pause(2000, 3000);

      // Hover over the "Convert to Order" or "Create Quote" buttons
      const convertToOrderBtn = page.locator('button:has-text("Convert to Order"), a:has-text("Convert to Order")').first();
      if (await convertToOrderBtn.isVisible().catch(() => false)) {
        console.log(' -> Highlighting 1-Click Deal Conversion...');
        await actor.hover(convertToOrderBtn);
        await actor.pause(3500, 4500); // Dramatic pause
      }
    }

    console.log('\n -> Story-driven CRM video sequence completed successfully!');

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
      const finalPath = path.join(OUTPUT_DIR, `crm-story-demo-${timestamp}.webm`);
      fs.renameSync(videoPath, finalPath);

      console.log(' CRM Story Demo Video Recorded Successfully!');
      console.log(` File : ${finalPath}`);
      console.log(` Size : ${sizeMb} MB`);
    } else {
      console.log(' Video saved in:', OUTPUT_DIR);
    }
    console.log('='.repeat(65));
  }
}

runCrmDemo().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
