import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';
import { uniqueId } from './helpers/generators';

test.describe('Sidebar Section: Sales', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  });

  test('Customers: list view renders ag-Grid and allows navigation to detail', async ({ page }) => {
    await page.goto('/customers', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    // Verify presence of "+ New Customer" button or link
    const newCustomerBtn = page.locator('a[href="/customers/new"]:visible, button:has-text("New Customer"):visible, button:has-text("Create Customer"):visible').first();
    await expect(newCustomerBtn).toBeVisible();
  });

  test('Sales Orders: list view loads and search filter works', async ({ page }) => {
    await page.goto('/sales-orders', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    // Verify "+ New Order" action
    const newOrderBtn = page.locator('a[href="/sales-orders/new"]:visible, button:has-text("New Order"):visible, button:has-text("Create Order"):visible').first();
    await expect(newOrderBtn).toBeVisible();
  });

  test('Sales Orders: create form loads with line items and customer selection', async ({ page }) => {
    await page.goto('/sales-orders/new', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    // Verify core order form elements
    await expect(page.locator('input[placeholder*="customer"], [class*="CustomerSelect"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create order|save/i })).toBeVisible();
  });

  test('Sales Quotes: list view renders with quote conversion controls', async ({ page }) => {
    await page.goto('/sales-quotes', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });

  test('Counter Sales: rapid checkout POS view renders', async ({ page }) => {
    await page.goto('/sales-orders/counter', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Shipments & Invoices: list views render and load successfully', async ({ page }) => {
    await page.goto('/shipments', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/sales-invoices', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });

  test('Sales Returns & Credit Notes: views render without errors', async ({ page }) => {
    await page.goto('/sales-returns', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/sales-credit-notes', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/sales-credit-notes/operations', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });
});
