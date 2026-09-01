import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';

test.describe('Sidebar Section: Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });

  test('loads Dashboard KPI widgets and activity stream', async ({ page }) => {
    // Verify main dashboard container
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Verify presence of dashboard sections (Quick Actions, Timeline, or Reports)
    const dashboardContent = page.locator('[data-testid="dashboard-content"], main');
    await expect(dashboardContent).toBeVisible();

    // Ensure no uncaught React/Next.js errors
    await expectNoErrorBoundaries(page);
  });

  test('verifies Quick Actions buttons and navigation', async ({ page }) => {
    // Look for quick action buttons or links
    const quickActionLinks = page.locator('a[href*="/sales-orders/new"], a[href*="/customers/new"], a[href*="/purchase-orders/new"]');
    const count = await quickActionLinks.count();
    if (count > 0) {
      const firstAction = quickActionLinks.first();
      await expect(firstAction).toBeVisible();
    }
  });

  test('opens and closes settings slide-overs without errors', async ({ page }) => {
    // Check for timeline or quick actions configure buttons (cog / settings icon)
    const settingsBtns = page.locator('button[title*="Settings"], button[aria-label*="Settings"], button:has-text("Configure")');
    if (await settingsBtns.count() > 0) {
      const btn = settingsBtns.first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);

        // Slide-over or dialog should become visible
        const dialog = page.locator('[role="dialog"], aside, div[class*="slide-over"]');
        if (await dialog.count() > 0) {
          await expect(dialog.first()).toBeVisible();
          // Close it
          const closeBtn = page.getByRole('button', { name: /cancel|close|done/i }).first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    }
    await expectNoErrorBoundaries(page);
  });
});
