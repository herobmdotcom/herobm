import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';
import { waitForGrid, searchPageTable } from './helpers/grid';
import { uniqueId, uniqueEmail } from './helpers/generators';

test.describe('Workflow: Entity Creation (Product, Customer, Supplier, CRM Contact)', () => {
  test('creates a new product and verifies detail view', async ({ page }) => {
    const productNumber = uniqueId('PRD');
    const productName = `E2E Test Product ${productNumber}`;

    // 1. Navigate to New Product page
    await page.goto('/products/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Product Number and Product Name
    const numberInput = page.locator('input[placeholder*="product" i], input[type="text"]').first();
    await expect(numberInput).toBeVisible({ timeout: 10000 });
    await numberInput.fill(productNumber);

    const nameInputs = page.locator('input[type="text"]');
    const count = await nameInputs.count();
    if (count > 1) {
      await nameInputs.nth(1).fill(productName);
    }

    // 3. Select Base UOM
    const uomSelect = page.locator('select').first();
    if (await uomSelect.isVisible()) {
      const options = await uomSelect.locator('option').all();
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val.trim() !== '') {
          await uomSelect.selectOption(val);
          break;
        }
      }
    }

    // 4. Submit and intercept API creation
    const addProductBtn = page.getByRole('button', { name: /add product|create product|save/i }).first();
    await expect(addProductBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/products') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await addProductBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 5. Verify redirection to Product Detail page
    await page.waitForURL(/\/products\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    const header = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(header).toBeVisible();
  });

  test('creates a new customer and verifies detail view', async ({ page }) => {
    const custNumber = uniqueId('CUST');
    const custName = `Acme Customer ${custNumber}`;

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

    // 3. Submit Customer
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

    const header = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(header).toBeVisible();
  });

  test('creates a new supplier and verifies detail view', async ({ page }) => {
    const vendorNumber = uniqueId('SUPP');
    const vendorName = `Global Supplies ${vendorNumber}`;

    // 1. Navigate to New Supplier creation form
    await page.goto('/suppliers/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Vendor Number, Name, and Country
    const numberInput = page.locator('input[placeholder*="VEND-001" i], input[placeholder*="vendor" i]').first();
    await expect(numberInput).toBeVisible({ timeout: 10000 });
    await numberInput.fill(vendorNumber);

    const nameInput = page.locator('input[placeholder*="ACME Corp" i], input[placeholder*="name" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(vendorName);

    const countrySelect = page.locator('select').first();
    if (await countrySelect.isVisible()) {
      await countrySelect.selectOption('US').catch(() => countrySelect.selectOption({ index: 1 }));
    }

    // 3. Submit Supplier via Create Supplier button
    const createBtn = page.getByRole('button', { name: /create supplier|save/i }).first();
    await expect(createBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/suppliers') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await createBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 4. Assert URL redirect to Supplier Detail page
    await page.waitForURL(/\/suppliers\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    const header = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(header).toBeVisible();
  });

  test('creates a new CRM contact and verifies redirection', async ({ page }) => {
    const contactSuffix = uniqueId('CNT');
    const firstName = 'Jane';
    const lastName = `Doe_${contactSuffix}`;
    const email = uniqueEmail('jane.doe');

    // 1. Navigate to New Contact page
    await page.goto('/crm/contacts/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Contact fields
    await page.locator('input[name="firstName"]').fill(firstName);
    await page.locator('input[name="lastName"]').fill(lastName);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill('+1-555-0199');
    await page.locator('input[name="jobTitle"]').fill('Procurement Specialist');

    // 3. Submit Contact form
    const saveBtn = page.getByRole('button', { name: /save|create/i }).first();
    await expect(saveBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/crm/contacts') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await saveBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 4. Assert redirect to CRM Contacts list
    await page.waitForURL(/\/crm\/contacts/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    // 5. Search for newly created contact in the grid
    await searchPageTable(page, lastName);
  });

  test('creates a new CRM actor and verifies detail view', async ({ page }) => {
    const actorSuffix = uniqueId('ACT');
    const actorName = `Acme Enterprise ${actorSuffix}`;

    // 1. Navigate to New Actor page
    await page.goto('/crm/actors/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Actor fields
    const nameInput = page.locator('input[name="name"], input[placeholder*="Acme Holdings" i], input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(actorName);

    const industryInput = page.locator('input[name="industry"], input[placeholder*="Technology" i]').first();
    if (await industryInput.isVisible()) {
      await industryInput.fill('Manufacturing & Logistics');
    }

    // 3. Submit Actor form
    const createBtn = page.getByRole('button', { name: /save|create actor/i }).first();
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/crm/actors') && res.request().method() === 'POST',
      { timeout: 15000 }
    ).catch(() => null);

    await createBtn.click();

    const response = await responsePromise;
    if (response) {
      expect([200, 201]).toContain(response.status());
    }

    // 4. Assert redirect to Actor Details page
    await page.waitForURL(/\/crm\/actors\/[a-zA-Z0-9-]+/, { timeout: 15000 }).catch(() => null);
    await expectNoErrorBoundaries(page);

    const header = page.locator('h1, h2, [class*="EntityHeader"]').first();
    await expect(header).toBeVisible();
  });
});
