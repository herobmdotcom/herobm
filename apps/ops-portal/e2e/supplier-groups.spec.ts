import { test, expect } from '@playwright/test';

test('page: supplier-groups loads without errors', async ({ page }) => {
  // Capture console errors
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (exception) => errors.push(exception.message));

  await page.goto('/admin/supplier-groups');
  
  // Wait for network idle or a specific selector (like ag-grid)
  await page.waitForLoadState('networkidle');

  // Verify generic "Error" text is NOT visible (shallow smoke)
  await expect(page.getByText('Error')).not.toBeVisible();
  
  // Verify no hard crashes in console
  expect(errors).toHaveLength(0);
});
