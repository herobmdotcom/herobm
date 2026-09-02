import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Reporting', () => {
  test('Reports Viewer: list view renders standard reports catalog', async ({ page }) => {
    await page.goto('/reporting', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Report Configuration: config list and report builder load', async ({ page }) => {
    await page.goto('/reporting/config', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/reporting/config/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });
});
