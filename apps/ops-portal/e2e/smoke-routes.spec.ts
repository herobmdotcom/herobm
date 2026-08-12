import { test, expect } from '@playwright/test';

// A static list of top-level list views in the application.
// This ensures that even if the crawler misses a link on the dashboard,
// the primary routes are still smoke tested.
const ROUTES = [
  '/admin',
  '/customers',
  '/general-ledger',
  '/inventory',
  '/manufacturing/work-orders',
  '/manufacturing/work-orders/new',
  '/payments',
  '/products',
  '/purchase-orders',
  '/receiving',
  '/reconciliations',
  '/reporting',
  '/sales-credit-notes',
  '/sales-invoices',
  '/sales-quotes',
  '/sales-orders',
  '/shipments',
  '/supplier-invoices',
  '/suppliers'
];

test.describe('Static Route Smoke Tests', () => {
  for (const route of ROUTES) {
    test(`Smoke test for ${route}`, async ({ page }) => {
      // Go to the route and wait for network to settle
      await page.goto(route, { waitUntil: 'networkidle' });

      // Check for generic React Error Boundaries or Next.js error pages
      const errorBoundaryText = page.locator('text=Something went wrong').first();
      const appErrorText = page.locator('text=Application error: a client-side exception has occurred').first();
      
      await expect(errorBoundaryText).not.toBeVisible();
      await expect(appErrorText).not.toBeVisible();

      // If no Error Boundary or Next.js Client Error is visible, the page loaded successfully.
    });
  }
});
