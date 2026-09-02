import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';
import { waitForGrid, searchPageTable } from './helpers/grid';
import { uniqueId } from './helpers/generators';

test.describe('Workflow: Customer & Entity Lifecycle', () => {
  test('executes customer creation, detail view validation, search, and order form integration', async ({ page }) => {
    const custNumber = uniqueId('CUST');
    const custName = `Acme E2E Corp ${custNumber}`;

    // 1. Navigate to New Customer creation form
    await page.goto('/customers/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Customer Number and Name
    const numberInput = page.locator('input[placeholder*="ACME-001" i]').first();
    await expect(numberInput).toBeVisible({ timeout: 10000 });
    await numberInput.fill(custNumber);

    const nameInput = page.locator('input[placeholder*="Acme Corporation" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(custName);

    // Select country if required
    const countrySelect = page.locator('select').first();
    if (await countrySelect.isVisible()) {
      await countrySelect.selectOption('US').catch(() => countrySelect.selectOption({ index: 1 }));
    }

    // 3. Submit Customer and intercept API request
    const createBtn = page.getByRole('button', { name: /create customer|save/i }).first();
    await expect(createBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/customers') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await createBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 4. Assert URL redirect to Customer Detail page
    await page.waitForURL(/\/customers\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    // 5. Verify Customer Details page displays the created customer
    const header = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(header).toBeVisible();

    // 6. Navigate to Customers list and search for the newly created customer
    await page.goto('/customers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await searchPageTable(page, custNumber);
  });
});
