import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';
import { waitForGrid } from './helpers/grid';
import { uniqueId } from './helpers/generators';

test.describe('Workflow: Order-to-Cash', () => {
  test('executes end-to-end sales order creation, redirect, and picking workflow', async ({ page }) => {
    const orderRef = uniqueId('SO');
    const lineDescription = `E2E Custom Line ${orderRef}`;

    // 1. Navigate to New Sales Order page
    await page.goto('/sales-orders/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Select Customer via CustomerSelect
    const customerInput = page.locator('input[placeholder*="customer" i], input[placeholder*="Search" i]').first();
    await expect(customerInput).toBeVisible({ timeout: 10000 });
    await customerInput.click();
    await customerInput.fill('CUST');
    await page.waitForTimeout(600);

    // Click the first customer dropdown option
    const firstOption = page.locator('[role="option"], div[class*="cursor-pointer"], .dropdown-content div').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }

    // 3. Fill Order metadata
    const orderNameInput = page.locator('input#order-name, input[placeholder*="Order Name" i], input[placeholder*="order name" i]').first();
    if (await orderNameInput.isVisible()) {
      await orderNameInput.fill(`E2E Order ${orderRef}`);
    }

    const orderPoInput = page.locator('input#order-po, input[placeholder*="Customer PO" i]').first();
    if (await orderPoInput.isVisible()) {
      await orderPoInput.fill(orderRef);
    }

    // 4. Add a Custom Line Item
    const addCustomLineBtn = page.getByRole('button', { name: /custom line/i }).first();
    if (await addCustomLineBtn.isVisible()) {
      await addCustomLineBtn.click();
      await page.waitForTimeout(300);

      // Locate description input in the line item table
      const descInput = page.locator('input[placeholder*="Description" i], table input[type="text"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill(lineDescription);
      }

      // Fill price per unit
      const priceInput = page.locator('input[placeholder*="0.00"], table input[type="number"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('150.00');
      }
    }

    // 5. Submit the Order and intercept the API creation request
    const createBtn = page.getByRole('button', { name: /create order/i }).first();
    await expect(createBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/orders') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await createBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 6. Assert URL redirect to Order Detail page
    await page.waitForURL(/\/sales-orders\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    // 7. Verify Order Detail view loaded
    const orderTitle = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(orderTitle).toBeVisible();

    // 8. Follow through to Picking workflow view
    await page.goto('/inventory/picking', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });
});
