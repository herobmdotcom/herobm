import { Page, expect } from '@playwright/test';

/**
 * ag-Grid Test Helpers for Playwright
 */

/**
 * Waits for ag-Grid to mount and render at least the wrapper and header.
 */
export async function waitForGrid(page: Page, timeout: number = 15000): Promise<void> {
  const gridWrapper = page.locator('.ag-root-wrapper, .ag-theme-alpine, .ag-theme-balham, table, [role="grid"], [role="table"]').first();
  await expect(gridWrapper).toBeVisible({ timeout });
}

/**
 * Gets the number of rendered rows in the ag-Grid table.
 */
export async function getGridRowCount(page: Page): Promise<number> {
  await waitForGrid(page);
  return await page.locator('.ag-center-cols-container .ag-row').count();
}

/**
 * Clicks the first row in the grid table.
 */
export async function clickFirstGridRow(page: Page): Promise<void> {
  await waitForGrid(page);
  const firstRow = page.locator('.ag-center-cols-container .ag-row').first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });
  await firstRow.click();
}

/**
 * Searches using the page-level search input (if present) and waits for debounce.
 */
export async function searchPageTable(page: Page, query: string): Promise<void> {
  const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(query);
    await page.waitForTimeout(800); // Allow debounce and API fetch
    await page.waitForLoadState('networkidle');
  }
}
