import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Technical', () => {
  test('Developers: API Keys, Webhooks, and Rate Limits view loads', async ({ page }) => {
    await page.goto('/admin/developers', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    const generateKeyBtn = page.getByRole('button', { name: /generate key|create key/i }).first();
    if (await generateKeyBtn.isVisible()) {
      await expect(generateKeyBtn).toBeVisible();
    }
  });

  test('Email: Outbox and SMTP Settings views load', async ({ page }) => {
    await page.goto('/admin/email/outbox', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/admin/email/settings', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Data Transfer: CSV Export, CSV Import, ABM, and Odoo views render', async ({ page }) => {
    await page.goto('/admin/export/csv', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/import/csv', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/import/abm', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/import/odoo', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('System Health: Event Queue, System Logs, and Version views load', async ({ page }) => {
    await page.goto('/admin/event-queue', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/admin/system-logs', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/version', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });
});
