import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Finance', () => {
  test('General Ledger: Chart of Accounts, Trial Balance, and Cash Flow load', async ({ page }) => {
    await page.goto('/general-ledger', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/general-ledger/trial-balance', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/general-ledger/cash-flow', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Journal Entries: list and create double-entry form render', async ({ page }) => {
    await page.goto('/general-ledger/journal-entries', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/general-ledger/journal-entries/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /post journal entry|post entry|save/i }).first()).toBeVisible();
  });

  test('Balances: Customers, Suppliers, and Tax Balances render', async ({ page }) => {
    await page.goto('/balances/customers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/balances/suppliers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/balances/tax', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Payments & Bank Reconciliations: views load successfully', async ({ page }) => {
    await page.goto('/payments', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/reconciliations', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/reconciliations/profiles', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/reconciliations/rules', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Fiscal Periods: periods manager renders', async ({ page }) => {
    await page.goto('/fiscal-periods', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });
});
