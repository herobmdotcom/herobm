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

const BASE_URL = process.env.DEMO_BASE_URL || 'https://herobm-dev.exe.xyz';
const USERNAME = process.env.DEMO_USERNAME || 'demo';
const PASSWORD = process.env.DEMO_PASSWORD || 'demodemo';
const HEADED = process.env.DEMO_HEADED !== 'false';
const USER_DATA_DIR = path.join(__dirname, '..', '..', 'tmp', 'demo-browser-profile');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'tmp', 'videos');

async function runCrmDemo() {
  console.log('='.repeat(65));
  console.log(' HeroBM - CRM Showcase Video Generator (Playwright - Dark Mode)');
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
    console.log('\n[1/8] Navigating to HeroBM in Dark Mode...');
    await page.goto(BASE_URL, { timeout: 60000, waitUntil: 'load' });
    await actor.injectVisualCursor();
    await actor.pause(700, 1000);

    const loginUsernameSelector = '#portal-login-username:visible, input[placeholder*="Username" i]:visible';
    const sidebarSelector = 'nav:visible, aside:visible, [class*="sidebar"]:visible';

    console.log(' -> Checking authentication status...');
    try {
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 15000 });
    } catch {
      console.log(' -> Waiting for application layout to settle...');
      await page.waitForSelector(`${loginUsernameSelector}, ${sidebarSelector}`, { timeout: 45000 });
    }

    const usernameField = page.locator(loginUsernameSelector).first();
    const isHeroBmLoginForm = await usernameField.isVisible().catch(() => false);

    if (isHeroBmLoginForm) {
      console.log(' -> HeroBM login screen detected. Authenticating in dark mode...');
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
      console.log(' -> Active session found.');
    }

    // Ensure dark mode DOM classes are applied
    await page.evaluate(() => {
      document.documentElement.classList.add('dark', 'herobm-dark');
      document.documentElement.classList.remove('herobm-light');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    });

    // -------------------------------------------------------------
    // Step 2: Sidebar Navigation to CRM -> Opportunities
    // -------------------------------------------------------------
    console.log('\n[2/8] Navigating to CRM Opportunities via Sidebar...');
    await actor.pause(1200, 1600); // Orientation pause

    const oppsLink = page
      .locator(
        'nav a[href="/crm/opportunities"]:visible, aside a[href="/crm/opportunities"]:visible, [class*="sidebar"] a[href="/crm/opportunities"]:visible',
      )
      .first();

    if (await oppsLink.isVisible().catch(() => false)) {
      await actor.hover(oppsLink, { speed: 0.95 });
      await actor.pause(450, 750);
      await actor.click(oppsLink);
    } else {
      console.log(' -> Navigating directly to /crm/opportunities...');
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/opportunities`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }

    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1000, 1500);

    // -------------------------------------------------------------
    // Step 3: Showcase Opportunities Kanban Board in Dark Mode
    // -------------------------------------------------------------
    console.log('\n[3/8] Showcasing Opportunities Kanban Board...');

    // Wait for columns and cards to load
    const kanbanColumn = page.locator('div:has(> div:has-text("Lead")), div:has(> div:has-text("Qualification")), div:has(> div:has-text("Proposal"))').first();
    await kanbanColumn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    // Hover over stage summary metrics in the board columns
    console.log(' -> Inspecting pipeline stages and deal totals...');
    const columnHeaders = page.locator('div.rounded-t-xl:visible, div:has(> span.font-semibold):visible');
    const headerCount = await columnHeaders.count();
    if (headerCount > 0) {
      await actor.hover(columnHeaders.first(), { speed: 0.9 });
      await actor.pause(500, 800);
      if (headerCount > 2) {
        await actor.hover(columnHeaders.nth(2), { speed: 0.9 });
        await actor.pause(450, 700);
      }
    }

    // Hover over an opportunity card
    const firstOppCard = page.locator('div.card[draggable="true"]:visible, div[draggable="true"]:visible').first();
    if (await firstOppCard.isVisible().catch(() => false)) {
      console.log(' -> Reviewing opportunity card in dark mode...');
      await actor.hover(firstOppCard);
      await actor.pause(700, 1100);

      // Demonstrate stage movement via the quick stage dropdown
      const quickStageSelect = firstOppCard.locator('select').first();
      if (await quickStageSelect.isVisible().catch(() => false) || (await quickStageSelect.count()) > 0) {
        console.log(' -> Progressing opportunity stage...');
        await quickStageSelect.evaluate((el: HTMLSelectElement) => {
          const options = Array.from(el.options);
          const nextOption = options.find((o) => o.value.toLowerCase().includes('proposal') || o.value.toLowerCase().includes('negotiation'));
          if (nextOption) {
            el.value = nextOption.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        await actor.pause(800, 1200);
      }
    }

    // -------------------------------------------------------------
    // Step 4: Toggle View: Kanban -> ag-Grid List View -> Kanban
    // -------------------------------------------------------------
    console.log('\n[4/8] Demonstrating View Modes (Kanban <-> ag-Grid List)...');
    const listViewBtn = page
      .locator('button:has-text("List"):visible, button:has(span:has-text("format_list_bulleted")):visible')
      .first();

    if (await listViewBtn.isVisible().catch(() => false)) {
      await actor.hover(listViewBtn, { speed: 0.95 });
      await actor.pause(350, 600);
      await actor.click(listViewBtn);
      console.log(' -> Switched to ag-Grid List View.');
      await page.waitForSelector('.ag-root:visible, .ag-body-viewport:visible', { timeout: 15000 }).catch(() => {});
      await actor.pause(1200, 1800);

      // Highlight a row in the list
      const firstRow = page.locator('.ag-row:first-child:visible, table tbody tr:first-child:visible').first();
      if (await firstRow.isVisible().catch(() => false)) {
        await actor.hover(firstRow);
        await actor.pause(600, 900);
      }

      // Switch back to Kanban
      const kanbanViewBtn = page
        .locator('button:has-text("Kanban"):visible, button:has(span:has-text("view_kanban")):visible')
        .first();
      if (await kanbanViewBtn.isVisible().catch(() => false)) {
        await actor.hover(kanbanViewBtn, { speed: 0.95 });
        await actor.pause(350, 550);
        await actor.click(kanbanViewBtn);
        console.log(' -> Switched back to Kanban Board.');
        await actor.pause(800, 1200);
      }
    }

    // -------------------------------------------------------------
    // Step 5: Click "New Opportunity" & Fill Deal Form
    // -------------------------------------------------------------
    console.log('\n[5/8] Creating New Commercial Opportunity...');
    const newOppBtn = page
      .locator(
        'a[href="/crm/opportunities/new"]:visible, a:has-text("New Opportunity"):visible, button:has-text("New Opportunity"):visible',
      )
      .first();
    await newOppBtn.waitFor({ state: 'visible', timeout: 15000 });
    await actor.hover(newOppBtn, { speed: 0.95 });
    await actor.pause(500, 750);
    await actor.click(newOppBtn);

    await page.waitForURL('**/crm/opportunities/new', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(700, 1000);

    // Fill Opportunity Name
    const nameInput = page.locator('input[placeholder*="Acme Corp" i]:visible, input.font-semibold:visible, input[type="text"]:visible').first();
    if (await nameInput.isVisible().catch(() => false)) {
      console.log(' -> Entering opportunity name...');
      await actor.type(nameInput, 'Apex Commercial - Automated Facade Systems Phase 2', { baseDelayMs: 38 });
      await actor.pause(250, 450);
    }

    // Select Pipeline Stage (Proposal)
    const stageSelect = page.locator('select:visible').first();
    if (await stageSelect.isVisible().catch(() => false)) {
      console.log(' -> Selecting pipeline stage: Proposal...');
      await stageSelect.selectOption({ label: 'Proposal' }).catch(async () => {
        const options = await stageSelect.locator('option').allInnerTexts();
        const propOpt = options.find((o) => o.toLowerCase().includes('proposal') || o.toLowerCase().includes('qual'));
        if (propOpt) await stageSelect.selectOption({ label: propOpt });
      });
      await actor.pause(200, 400);
    }

    // Enter Estimated Value
    const estValInput = page.locator('input[type="number"][placeholder*="150000" i]:visible, input[type="number"]:visible').first();
    if (await estValInput.isVisible().catch(() => false)) {
      console.log(' -> Entering estimated deal value: $320,000...');
      await actor.type(estValInput, '320000', { baseDelayMs: 45 });
      await actor.pause(200, 400);
    }

    // Set Win Probability slider to 75%
    const probSlider = page.locator('input[type="range"]:visible').first();
    if (await probSlider.isVisible().catch(() => false)) {
      console.log(' -> Adjusting Win Probability slider to 75%...');
      await actor.hover(probSlider);
      await probSlider.fill('75');
      await probSlider.dispatchEvent('input');
      await probSlider.dispatchEvent('change');
      await actor.pause(350, 600);
    }

    // Set Target Close Date
    const closeDateInput = page.locator('input[type="date"]:visible').first();
    if (await closeDateInput.isVisible().catch(() => false)) {
      await actor.type(closeDateInput, '2026-12-15', { baseDelayMs: 40 });
      await actor.pause(200, 350);
    }

    // Description
    const descTextarea = page.locator('textarea:visible').first();
    if (await descTextarea.isVisible().catch(() => false)) {
      console.log(' -> Entering strategic deal scope...');
      await actor.type(
        descTextarea,
        'Enterprise commercial facade automation and telemetry contract. Tied to Master Supply Agreement.',
        { baseDelayMs: 32 },
      );
      await actor.pause(300, 500);
    }

    // Submit Create Opportunity
    const createOppSubmit = page.locator('button:has-text("Create Opportunity"):visible').first();
    await actor.hover(createOppSubmit, { speed: 0.95 });
    await actor.pause(450, 750);
    await actor.click(createOppSubmit);

    console.log(' -> Waiting for opportunity creation & redirection...');
    await page.waitForURL(/crm\/opportunities\/[a-zA-Z0-9_-]+/, { timeout: 25000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1200, 1600);

    // -------------------------------------------------------------
    // Step 6: Opportunity Detail & CRM Activities / Tasks Flow
    // -------------------------------------------------------------
    console.log('\n[6/8] Showcasing Opportunity Detail, Activities & Tasks...');

    // Review Overview Forecast
    await actor.smoothScroll(220, 400);
    await actor.pause(700, 1100);
    await actor.smoothScroll(-220, 400);
    await actor.pause(500, 800);

    // Log a Call activity
    const logCallBtn = page.locator('button:has-text("Call"):visible').first();
    if (await logCallBtn.isVisible().catch(() => false)) {
      console.log(' -> Logging commercial discovery call...');
      await actor.hover(logCallBtn);
      await actor.pause(250, 450);
      await actor.click(logCallBtn);

      const slideOver = page.locator('[role="dialog"]:visible, div:has-text("Log Activity"):visible, div:has-text("Call"):visible').first();
      await slideOver.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await actor.pause(350, 550);

      const subjectInput = page.locator('input[placeholder*="subject" i]:visible, input[placeholder*="title" i]:visible, input[type="text"]:visible').last();
      if (await subjectInput.isVisible().catch(() => false)) {
        await actor.type(subjectInput, 'Executive Strategy Alignment with VP Engineering', { baseDelayMs: 36 });
        await actor.pause(200, 350);
      }

      const notesInput = page.locator('textarea:visible').last();
      if (await notesInput.isVisible().catch(() => false)) {
        await actor.type(
          notesInput,
          'Confirmed phase 2 scope and timeline. Pricing approved for engineering review.',
          { baseDelayMs: 32 },
        );
        await actor.pause(250, 450);
      }

      const saveActBtn = page.locator('button:has-text("Save"):visible, button:has-text("Log Activity"):visible, button[type="submit"]:visible').last();
      await actor.hover(saveActBtn);
      await actor.pause(250, 400);
      await actor.click(saveActBtn);
      await actor.pause(700, 1100);
    }

    // Log a Task with High Priority
    const logTaskBtn = page.locator('button:has-text("Task"):visible').first();
    if (await logTaskBtn.isVisible().catch(() => false)) {
      console.log(' -> Creating actionable CRM task...');
      await actor.hover(logTaskBtn);
      await actor.pause(250, 450);
      await actor.click(logTaskBtn);

      await actor.pause(350, 550);
      const subjectInput = page.locator('input[placeholder*="subject" i]:visible, input[placeholder*="title" i]:visible, input[type="text"]:visible').last();
      if (await subjectInput.isVisible().catch(() => false)) {
        await actor.type(subjectInput, 'Prepare & Dispatch Master Commercial Proposal', { baseDelayMs: 35 });
        await actor.pause(200, 350);
      }

      const prioritySelect = page.locator('select:has(option[value="high"]):visible').first();
      if (await prioritySelect.isVisible().catch(() => false)) {
        await prioritySelect.selectOption('high');
        await actor.pause(200, 350);
      }

      const saveTaskBtn = page.locator('button:has-text("Save"):visible, button:has-text("Log Activity"):visible, button[type="submit"]:visible').last();
      await actor.hover(saveTaskBtn);
      await actor.pause(250, 400);
      await actor.click(saveTaskBtn);
      await actor.pause(800, 1200);
    }

    // Toggle Task completion (Checkmark task)
    console.log(' -> Completing task on the activity timeline...');
    const taskCheckbox = page.locator('button:has(span:has-text("radio_button_unchecked")):visible, button[title*="complete" i]:visible').first();
    if (await taskCheckbox.isVisible().catch(() => false)) {
      await actor.hover(taskCheckbox);
      await actor.pause(400, 650);
      await actor.click(taskCheckbox);
      await actor.pause(800, 1200);
      console.log(' -> Task marked as completed with visual badge.');
    }

    // -------------------------------------------------------------
    // Step 7: Commercial Integration Tab (Live Revenue & Quotes)
    // -------------------------------------------------------------
    console.log('\n[7/8] Inspecting Commercial Integration (Live Quotes & Revenue)...');
    const commercialTab = page
      .locator(
        'button:has-text("Commercial"):visible, #tab-commercial:visible, a:has-text("Commercial"):visible',
      )
      .first();

    if (await commercialTab.isVisible().catch(() => false)) {
      await actor.hover(commercialTab, { speed: 0.95 });
      await actor.pause(350, 600);
      await actor.click(commercialTab);
      await actor.pause(1000, 1500);

      // Inspect Commercial KPI Card
      const revenueCard = page.locator('div:has-text("Live Deal Revenue"):visible, div:has-text("Commercial Documents"):visible').first();
      if (await revenueCard.isVisible().catch(() => false)) {
        await actor.hover(revenueCard);
        await actor.pause(600, 950);
      }
    }

    // -------------------------------------------------------------
    // Step 8: CRM Relationship Ecosystem Map & Finale
    // -------------------------------------------------------------
    console.log('\n[8/8] Navigating to CRM Ecosystem Map & Finale...');
    const crmMapLink = page
      .locator(
        'nav a[href="/crm/map"]:visible, aside a[href="/crm/map"]:visible, [class*="sidebar"] a[href="/crm/map"]:visible',
      )
      .first();

    if (await crmMapLink.isVisible().catch(() => false)) {
      await actor.hover(crmMapLink, { speed: 0.95 });
      await actor.pause(350, 600);
      await actor.click(crmMapLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/map`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }

    await page.waitForURL('**/crm/map', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await actor.pause(1200, 1800);

    // Pan across the dark ReactFlow relationship map
    console.log(' -> Showcasing Dark Mode Ecosystem Map nodes & connections...');
    const flowCanvas = page.locator('.react-flow__pane:visible, .react-flow:visible').first();
    if (await flowCanvas.isVisible().catch(() => false)) {
      await actor.hover(flowCanvas);
      await actor.pause(600, 1000);
      // Gentle pan
      await actor.smoothScroll(150, 500);
      await actor.pause(600, 900);
      await actor.smoothScroll(-150, 500);
      await actor.pause(500, 800);
    }

    // Return to CRM Opportunities Kanban for the grand finale
    console.log(' -> Returning to Opportunities Kanban board for finale showcase...');
    const returnOppsLink = page
      .locator(
        'nav a[href="/crm/opportunities"]:visible, aside a[href="/crm/opportunities"]:visible, [class*="sidebar"] a[href="/crm/opportunities"]:visible',
      )
      .first();

    if (await returnOppsLink.isVisible().catch(() => false)) {
      await actor.hover(returnOppsLink);
      await actor.pause(250, 450);
      await actor.click(returnOppsLink);
    } else {
      await page.goto(`${BASE_URL.replace(/\/$/, '')}/crm/opportunities`, { waitUntil: 'load' });
      await actor.injectVisualCursor();
    }

    await page.waitForURL('**/crm/opportunities', { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});

    // Final showcase pause on the complete Dark Mode Kanban board
    await actor.pause(3500, 4500);
    console.log(' -> CRM Dark Mode video sequence completed successfully!');

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
      const finalPath = path.join(OUTPUT_DIR, `crm-demo-${timestamp}.webm`);
      fs.renameSync(videoPath, finalPath);

      console.log(' CRM Demo Video Recorded Successfully!');
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
