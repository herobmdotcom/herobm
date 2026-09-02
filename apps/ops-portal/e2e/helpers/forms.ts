import { Page, expect } from '@playwright/test';

/**
 * Form & UI Component Test Helpers for Playwright
 */

/**
 * Asserts that no React Error Boundaries or Next.js Client Crashes are visible on the page.
 */
export async function expectNoErrorBoundaries(page: Page): Promise<void> {
  const errorBoundary = page.locator('text=Something went wrong').first();
  const clientError = page.locator('text=Application error: a client-side exception has occurred').first();
  await expect(errorBoundary).not.toBeVisible();
  await expect(clientError).not.toBeVisible();
}

/**
 * Selects a customer from the CustomerSelect component.
 */
export async function selectCustomerInForm(page: Page, customerQuery: string = 'CUST'): Promise<void> {
  const customerInput = page.locator('input[placeholder*="Search customer"], input[placeholder*="search customer"], input[placeholder*="Select customer"]').first();
  if (await customerInput.isVisible()) {
    await customerInput.click();
    await customerInput.fill(customerQuery);
    await page.waitForTimeout(500);
    // Click the first dropdown result option
    const firstOption = page.locator('[role="option"], div[class*="cursor-pointer"]').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }
  }
}

/**
 * Selects a product from the ProductSearchInput component.
 */
export async function selectProductInForm(page: Page, productQuery: string = 'PRD'): Promise<void> {
  const productInput = page.locator('input[placeholder*="Search product"], input[placeholder*="search product"], input[placeholder*="Select product"]').first();
  if (await productInput.isVisible()) {
    await productInput.click();
    await productInput.fill(productQuery);
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"], div[class*="cursor-pointer"]').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    }
  }
}

/**
 * Submits a slide-over form by clicking its primary action button.
 */
export async function submitSlideOver(page: Page, buttonLabel: string = 'Save'): Promise<void> {
  const submitBtn = page.getByRole('button', { name: new RegExp(buttonLabel, 'i') }).first();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await submitBtn.click();
  await page.waitForTimeout(800);
}

/**
 * Closes a slide-over modal via the Cancel button or backdrop.
 */
export async function closeSlideOver(page: Page): Promise<void> {
  const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
  }
}
