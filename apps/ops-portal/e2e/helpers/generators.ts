/**
 * Test Data Generator Utilities for Playwright E2E Tests
 */

/**
 * Generates a unique, timestamped test identifier with an optional prefix.
 * Example: `e2e_cust_1725178900123_a4b`
 */
export function uniqueId(prefix: string = 'e2e'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Generates a unique test email address.
 */
export function uniqueEmail(prefix: string = 'test'): string {
  return `${uniqueId(prefix)}@example.com`;
}

/**
 * Formats a number to currency string format (2 decimal places).
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}
