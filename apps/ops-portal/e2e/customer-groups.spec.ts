import { test, expect } from '@playwright/test';

test('page: customer-groups loads without errors', async ({ page }) => {
  // Capture console errors
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('429') && !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (exception) => errors.push(exception.message));

  await page.goto('/admin/customer-groups');
  
  // Wait for network idle
  await page.waitForLoadState('networkidle');

  // Verify generic "Error" text is NOT visible (shallow smoke)
  await expect(page.getByText('Error', { exact: true })).not.toBeVisible();
  
  // Verify no hard crashes in console
  expect(errors).toHaveLength(0);
});
