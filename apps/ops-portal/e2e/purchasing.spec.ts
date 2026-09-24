import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Purchasing', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  });

  test('Suppliers: list view renders with New Supplier action', async ({ page }) => {
    await page.goto('/suppliers', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    const newSupplierBtn = page.locator('a[href="/suppliers/new"]:visible, button:has-text("New Supplier"):visible, button:has-text("Create Supplier"):visible').first();
    await expect(newSupplierBtn).toBeVisible();
  });

  test('Demand Analysis: stock demand workbench loads successfully', async ({ page }) => {
    await page.goto('/purchase-orders/demands', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Purchase Orders: list view loads and create form is accessible', async ({ page }) => {
    await page.goto('/purchase-orders', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/purchase-orders/new', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('Supplier Invoices: list and create views render', async ({ page }) => {
    await page.goto('/supplier-invoices', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/supplier-invoices/new', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Purchase Returns & Debit Notes: views render properly', async ({ page }) => {
    await page.goto('/purchase-orders/returns', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/purchase-debit-notes', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });
});
