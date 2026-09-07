import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
const envFile = process.env.ENV_FILE || '.env';
if (fs.existsSync(path.join(__dirname, '..', '..', envFile))) {
  dotenv.config({ path: path.join(__dirname, '..', '..', envFile) });
}
if (fs.existsSync(path.join(__dirname, '..', '..', '.env'))) {
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

const BASE_URL = process.env.DEMO_BASE_URL || 'https://herobm-dev.exe.xyz';
const USER_DATA_DIR = path.join(__dirname, '..', '..', 'tmp', 'demo-browser-profile');

async function setupAuthSession() {
  console.log('='.repeat(65));
  console.log(' HeroBM - Browser Profile Auth Setup (exe.dev & SSO Login)');
  console.log('='.repeat(65));
  console.log(` Target URL       : ${BASE_URL}`);
  console.log(` Profile Storage  : ${USER_DATA_DIR}`);
  console.log('='.repeat(65));

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log('\nOpening persistent browser window...');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto(BASE_URL);

  console.log('\n>>> ACTION REQUIRED <<<');
  console.log('1. A Chrome browser window is now open.');
  console.log('2. Log in to exe.dev / HeroBM if prompted.');
  console.log('3. Once you see the HeroBM dashboard / app loaded, come back here and press ENTER to save the profile.');
  console.log('='.repeat(65));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('\nPress ENTER when you have finished logging in: ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('\nSaving browser profile and cookies...');
  await context.close();
  console.log('Browser profile saved successfully to:', USER_DATA_DIR);
  console.log('You can now run: make demo-sales-order\n');
}

setupAuthSession().catch((err) => {
  console.error('Failed to setup auth session:', err);
  process.exit(1);
});
