import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Finance', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  });

  test('General Ledger: Chart of Accounts, Trial Balance, and Cash Flow load', async ({ page }) => {
    await page.goto('/general-ledger', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/general-ledger/trial-balance', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/general-ledger/cash-flow', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Journal Entries: list and create double-entry form render', async ({ page }) => {
    await page.goto('/general-ledger/journal-entries', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/general-ledger/journal-entries/new', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /post journal entry|post entry|save/i }).first()).toBeVisible();
  });

  test('Balances: Customers, Suppliers, and Tax Balances render', async ({ page }) => {
    await page.goto('/balances/customers', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/balances/suppliers', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/balances/tax', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Payments & Bank Reconciliations: views load successfully', async ({ page }) => {
    await page.goto('/payments', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/reconciliations', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/reconciliations/profiles', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);

    await page.goto('/reconciliations/rules', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });

  test('Fiscal Periods: periods manager renders', async ({ page }) => {
    await page.goto('/fiscal-periods', { waitUntil: 'domcontentloaded' });
    await expectNoErrorBoundaries(page);
  });
});
