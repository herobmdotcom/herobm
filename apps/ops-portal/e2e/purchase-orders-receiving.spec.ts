import { test, expect } from '@playwright/test';

test('page: /purchase-orders/receiving loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (exception) => {
    errors.push(exception.message);
  });

  // Navigate to the receiving page
  await page.goto('/purchase-orders/receiving');
  
  // Wait for network idle or hydration to complete
  await page.waitForLoadState('networkidle');

  // Verify that there is no Next.js error fallback or blank fatal crash state
  await expect(page.getByText('Error', { exact: true })).not.toBeVisible();
  
  // Verify that the core UI initialized
  await expect(page.locator('h3', { hasText: 'Scan Product' })).toBeVisible();
  await expect(page.locator('h3', { hasText: 'Reception Summary' })).toBeVisible();

  // Verify no unhandled javascript errors were emitted
  expect(errors).toHaveLength(0);
});
