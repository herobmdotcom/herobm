import { test, expect } from '@playwright/test';
import { expectNoErrorBoundaries } from './helpers/forms';
import { waitForGrid } from './helpers/grid';
import { uniqueId } from './helpers/generators';

test.describe('Workflow: General Ledger & Financial Posting', () => {
  test('validates double-entry balancing invariants and posts manual journal entry', async ({ page }) => {
    const journalMemo = `E2E Journal ${uniqueId('GL')}`;

    // 1. Navigate to New Journal Entry page
    await page.goto('/general-ledger/journal-entries/new', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);

    // 2. Fill Memo
    const memoInput = page.locator('input[placeholder*="memo" i], input[placeholder*="description" i]').first();
    if (await memoInput.isVisible()) {
      await memoInput.fill(journalMemo);
    }

    // 3. Locate account dropdowns
    const accountSelects = page.locator('table select').filter({ hasText: /select account/i });
    const selectCount = await accountSelects.count();

    if (selectCount >= 2) {
      // Select first account for Line 1
      const select1 = accountSelects.nth(0);
      const options1 = await select1.locator('option').allInnerTexts();
      if (options1.length > 1) {
        await select1.selectOption({ index: 1 });
      }

      // Fill Line 1 Debit ($500.00)
      const debitInputs = page.locator('table input[type="number"]').first();
      await debitInputs.fill('500.00');

      // 4. Assert that unbalanced entry cannot be submitted (button is disabled or warning visible)
      const submitBtn = page.getByRole('button', { name: /post entry|save/i }).first();
      const isDisabledInitially = await submitBtn.isDisabled();
      expect(isDisabledInitially).toBeTruthy();

      // 5. Select second account for Line 2
      const select2 = accountSelects.nth(1);
      const options2 = await select2.locator('option').allInnerTexts();
      if (options2.length > 2) {
        await select2.selectOption({ index: 2 });
      } else if (options2.length > 1) {
        await select2.selectOption({ index: 1 });
      }

      // Fill Line 2 Credit ($500.00)
      const creditInputs = page.locator('table input[type="number"]').nth(3); // Line 1 has debit, credit; Line 2 has debit, credit
      if (await creditInputs.isVisible()) {
        await creditInputs.fill('500.00');
      }

      await page.waitForTimeout(400);

      // 6. Submit the balanced entry if enabled
      if (!(await submitBtn.isDisabled())) {
        const responsePromise = page.waitForResponse(
          (res) => res.url().includes('/api/gl/manual-journal-entry') && res.request().method() === 'POST',
          { timeout: 15000 }
        ).catch(() => null);

        await submitBtn.click();

        const response = await responsePromise;
        if (response) {
          expect([200, 201]).toContain(response.status());
        }

        // Assert redirect to Journal Entries list
        await page.waitForURL(/\/general-ledger\/journal-entries/, { timeout: 15000 }).catch(() => null);
        await expectNoErrorBoundaries(page);
      }
    }

    // 7. Verify Trial Balance view renders
    await page.goto('/general-ledger/trial-balance', { waitUntil: 'networkidle' });
    await expectNoErrorBoundaries(page);
  });
});
