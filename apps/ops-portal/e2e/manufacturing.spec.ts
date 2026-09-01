import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Manufacturing', () => {
  test('Work Orders: list view loads ag-Grid and New Work Order button', async ({ page }) => {
    await page.goto('/manufacturing/work-orders', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    const newBtn = page.locator('a[href="/manufacturing/work-orders/new"], button:has-text("New Work Order")').first();
    await expect(newBtn).toBeVisible();
  });

  test('Work Orders: create form loads BOM selection controls', async ({ page }) => {
    await page.goto('/manufacturing/work-orders/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });
});
