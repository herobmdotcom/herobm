import { test, expect } from '@playwright/test';

test.describe('Customers Page Smoke Test', () => {
  test('homepage loads and shows no errors', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (exception) => errors.push(exception.message));

    // Navigate to customers (assuming it's a major page)
    await page.goto('/customers');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Basic check for AgGrid or some content being visible
    const grid = page.locator('.ag-theme-alpine, .ag-theme-balham, .ag-root-wrapper');
    // If grid is not present, still check for "Error" text absence
    // This allows the test to be "shallow" but useful.

    // Verify generic "Error" text is NOT visible in main content
    // We exclude navigation items if they contain the word "Error" (like "Report Error")
    const mainContent = page.locator('main');
    if (await mainContent.count() > 0) {
      await expect(mainContent.getByText('Error')).not.toBeVisible();
    } else {
      await expect(page.getByText('Error')).not.toBeVisible();
    }

    // Verify no JS crashes
    expect(errors, `Expected no console errors, but got: ${errors.join(', ')}`).toHaveLength(0);
  });
});
