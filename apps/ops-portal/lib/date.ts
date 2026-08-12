/**
 * Centralized Date Formatting & Parsing Utilities
 * Ensures browser locale date preferences are respected without UTC-to-local timezone day shifts.
 */

/**
 * Safely parses input into a JavaScript Date object, handling date-only ISO strings (YYYY-MM-DD)
 * in local time to avoid off-by-one timezone day shifts.
 */
export function parseLocalDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Handle YYYY-MM-DD date-only strings in local timezone to prevent UTC midnight day shifts
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyRegex.test(str)) {
    const [year, month, day] = str.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date string, number, or Date object according to the user's browser locale setting.
 * Uses `toLocaleDateString(undefined, options)` which respects `navigator.language`.
 */
export function formatLocalDate(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = '—'
): string {
  const date = parseLocalDate(input);
  if (!date) return fallback;
  return date.toLocaleDateString(undefined, options);
}

/**
 * Formats a date string, number, or Date object into a YYYY-MM-DD string required for HTML5 <input type="date">.
 * Prevents UTC timezone day shifts.
 */
export function toInputDateFormat(input: string | number | Date | null | undefined): string {
  const date = parseLocalDate(input);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
