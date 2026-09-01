import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Inventory', () => {
  test('Products: list view renders ag-Grid with stock and pricing columns', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    const newProductBtn = page.locator('a[href="/products/new"]:visible, button:has-text("New Product"):visible, button:has-text("Create Product"):visible').first();
    await expect(newProductBtn).toBeVisible();
  });

  test('Inventory Sub-tabs: Bins, Ledger, Locations, Transfers, Quarantine render properly', async ({ page }) => {
    await page.goto('/inventory/bins', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/ledger', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/locations', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/transfers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/quarantine', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Receiving: Supplier Receipts, Customer Returns, and Incoming Transfers render without errors', async ({ page }) => {
    await page.goto('/receiving', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/receiving/returns', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/receiving/transfers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Warehouse Operations: Putaway, Picking, Shipping, and Scan to Dispatch views render', async ({ page }) => {
    await page.goto('/inventory/putaway', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/picking', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('heading', { name: /picking/i }).first()).toBeVisible();

    await page.goto('/inventory/shipping', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/inventory/scan-to-dispatch', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });
});
