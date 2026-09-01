import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: CRM', () => {
  test('Actors: list and create views load', async ({ page }) => {
    await page.goto('/crm/actors', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/crm/actors/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Projects: list and create views load', async ({ page }) => {
    await page.goto('/crm/projects', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/crm/projects/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Contacts: list and create views load', async ({ page }) => {
    await page.goto('/crm/contacts', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/crm/contacts/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('CRM Map: interactive geographic map renders', async ({ page }) => {
    await page.goto('/crm/map', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.locator('main')).toBeVisible();
  });
});
