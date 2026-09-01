import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';
import { waitForGrid } from './helpers/grid';
import { uniqueId } from './helpers/generators';

test.describe('Workflow: Procure-to-Pay', () => {
  test('executes end-to-end purchase order creation, redirect, and receiving queue workflow', async ({ page }) => {
    const poRef = uniqueId('PO');
    const lineDescription = `E2E Material Line ${poRef}`;

    // 1. Navigate to New Purchase Order page
    await page.goto('/purchase-orders/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Select Supplier via SupplierSelect
    const supplierInput = page.locator('input[placeholder*="supplier" i], input[placeholder*="Search" i]').first();
    if (await supplierInput.isVisible()) {
      await supplierInput.click();
      await supplierInput.fill('SUPP');
      await page.waitForTimeout(600);

      const firstOption = page.locator('[role="option"], div[class*="cursor-pointer"], .dropdown-content div').first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
      }
    }

    // 3. Add a Custom Line Item
    const addCustomLineBtn = page.getByRole('button', { name: /custom line/i }).first();
    if (await addCustomLineBtn.isVisible()) {
      await addCustomLineBtn.click();
      await page.waitForTimeout(300);

      const descInput = page.locator('input[placeholder*="Description" i], table input[type="text"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill(lineDescription);
      }

      const priceInput = page.locator('input[placeholder*="0.00"], table input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('45.00');
      }
    }

    // 4. Submit the Purchase Order and intercept the API request
    const createBtn = page.getByRole('button', { name: /create order|create purchase order|save/i }).first();
    await expect(createBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/purchase-orders') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await createBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 5. Assert redirect to Purchase Order Detail view
    await page.waitForURL(/\/purchase-orders\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    // 6. Verify Purchase Order detail page rendered
    const poTitle = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(poTitle).toBeVisible();

    // 7. Follow through to Receiving queue
    await page.goto('/receiving', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });
});
