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

  test('Opportunities: list and create views load', async ({ page }) => {
    await page.goto('/crm/opportunities', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();

    // Opportunities defaults to Kanban view; toggle to List view to verify ag-Grid renders
    const listBtn = page.getByRole('button', { name: /list/i }).filter({ visible: true }).first();
    await listBtn.click();
    await waitForGrid(page);

    await page.goto('/crm/opportunities/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Projects: legacy redirect to opportunities works', async ({ page }) => {
    await page.goto('/crm/projects', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/crm\/opportunities/);
    await expectNoErrorBoundaries(page);

    await page.goto('/crm/projects/new', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/crm\/opportunities\/new/);
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
