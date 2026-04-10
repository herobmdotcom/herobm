/**
 * Playwright Auth Setup
 *
 * Authenticates once before all tests, saving the browser storageState
 * (localStorage JWT + any cookies) to a file that all test projects
 * inherit via `use: { storageState }` in playwright.config.ts.
 *
 * Credentials are read from environment variables:
 *   E2E_USERNAME  (default: admin)
 *   E2E_PASSWORD  (default: admin)
 *
 * @see https://playwright.dev/docs/auth
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '..', '.playwright', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to any page — AuthGate will show the login form
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Fill in the login form
  const username = process.env.E2E_USERNAME || 'admin';
  const password = process.env.E2E_PASSWORD || process.env.DEV_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('E2E_PASSWORD or DEV_ADMIN_PASSWORD must be defined for auth setup');
  }

  console.log(`Attempting login for user: "${username}"`);
  console.log(`Password length: ${password.length}`);
  console.log(`Password starts with: ${password.substring(0, 3)}... and ends with: ...${password.substring(password.length - 3)}`);
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  
  // Capture the login response
  const responsePromise = page.waitForResponse('/api/auth/login');
  await page.getByRole('button', { name: 'Sign In' }).click();
  const response = await responsePromise;

  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`Login failed with status ${response.status()}:`, errorData);
  }

  // Wait for authentication to succeed — the sidebar should become visible
  await expect(page.locator('nav, aside, [class*="sidebar"]').first()).toBeVisible({
    timeout: 15000,
  });

  // Persist the authenticated browser state for all subsequent tests
  await page.context().storageState({ path: authFile });
});
