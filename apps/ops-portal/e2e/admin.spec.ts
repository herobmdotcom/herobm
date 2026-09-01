import { test, expect } from '@playwright/test';
import { waitForGrid } from './helpers/grid';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Admin', () => {
  test('Groups: Customer, Supplier, and Product Groups load', async ({ page }) => {
    await page.goto('/admin/customer-groups', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/admin/supplier-groups', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/admin/product-groups', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);
  });

  test('Settings: CRM, Financial, Integrations, License, PDF Hooks, and System settings load', async ({ page }) => {
    await page.goto('/admin/settings/system', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/crm', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/financial', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/integrations', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/license', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/pdf-hooks', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    await page.goto('/admin/settings/pdf-templates', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('Users & Access: Users list and Roles/Permissions matrix render', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await waitForGrid(page);

    await page.goto('/admin/users/roles', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
    await expect(page.getByRole('heading', { name: /roles/i }).first()).toBeVisible();
  });
});
