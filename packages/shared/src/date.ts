/**
 * Centralized Date Formatting & Parsing Utilities
 * Ensures browser and server locale date preferences are respected without UTC-to-local timezone day shifts.
 */

export const DEFAULT_REPORT_LOCALE = 'en-IE';

/**
 * Safely parses input into a JavaScript Date object, handling:
 * - ISO date-only strings (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD) in local time
 * - International and European/Australian CSV formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
 * - 2-digit year formats (DD/MM/YY, DD-MM-YY, DD.MM.YY)
 * - Dates with timestamps (e.g. DD/MM/YYYY HH:mm:ss, ISO timestamps)
 * - Excel serial date numbers (e.g. 45427) and Unix epoch timestamps
 *
 * Avoids off-by-one UTC midnight day shifts.
 */
export function parseLocalDate(
  input: string | number | Date | null | undefined,
  preferDayFirst = true,
): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    if (isNaN(input)) return null;
    // Excel serial number (between 10000 and 90000 corresponds to years 1927 - 2146)
    if (input >= 10000 && input <= 90000 && Number.isInteger(input)) {
      const utcDays = input - 25569;
      const utcMs = Math.round(utcDays * 86400 * 1000);
      const d = new Date(utcMs);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    // Unix timestamp in seconds (e.g. 1700000000)
    if (input > 1e8 && input < 1e11) {
      const d = new Date(input * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Numeric Excel serial string (e.g., "45427")
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    const utcDays = num - 25569;
    const utcMs = Math.round(utcDays * 86400 * 1000);
    const d = new Date(utcMs);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  // Handle YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD date-only strings in local timezone
  const yearFirstRegex = /^(\d{4})[/\-. ](\d{1,2})[/\-. ](\d{1,2})$/;
  const yearFirstMatch = str.match(yearFirstRegex);
  if (yearFirstMatch) {
    const year = Number(yearFirstMatch[1]);
    const month = Number(yearFirstMatch[2]);
    const day = Number(yearFirstMatch[3]);
    const localDate = new Date(year, month - 1, day);
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY with optional time
  const dayMonthYearRegex = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const dmyMatch = str.match(dayMonthYearRegex);
  if (dmyMatch) {
    const p1 = Number(dmyMatch[1]);
    const p2 = Number(dmyMatch[2]);
    let rawYear = Number(dmyMatch[3]);
    if (rawYear < 100) {
      rawYear = rawYear >= 50 ? 1900 + rawYear : 2000 + rawYear;
    }
    const hours = dmyMatch[4] ? Number(dmyMatch[4]) : 0;
    const minutes = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
    const seconds = dmyMatch[6] ? Number(dmyMatch[6]) : 0;

    let day = p1;
    let month = p2;

    if (p1 > 12 && p2 <= 12) {
      // Must be DD/MM/YYYY
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // Must be MM/DD/YYYY
      month = p1;
      day = p2;
    } else if (!preferDayFirst) {
      month = p1;
      day = p2;
    }

    const localDate = new Date(rawYear, month - 1, day, hours, minutes, seconds);
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date string, number, or Date object according to locale settings.
 * If locale is omitted, uses environment default (browser locale in browser, runtime default in Node).
 */
export function formatLocalDate(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = '—',
  locale?: string,
): string {
  const date = parseLocalDate(input);
  if (!date) return fallback;
  return date.toLocaleDateString(locale || undefined, options);
}

/**
 * Formats a date string, number, or Date object for formal business reports and documents.
 * Defaults to the standardized system report locale (DEFAULT_REPORT_LOCALE = 'en-IE').
 */
export function formatReportDate(
  input: string | number | Date | null | undefined,
  locale: string = DEFAULT_REPORT_LOCALE,
  fallback: string = '—',
): string {
  return formatLocalDate(input, undefined, fallback, locale);
}

/**
 * Formats a date string, number, or Date object with time according to locale settings.
 */
export function formatLocalDateTime(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = '—',
  locale?: string,
): string {
  const date = parseLocalDate(input);
  if (!date) return fallback;
  return date.toLocaleString(locale || undefined, options);
}

/**
 * Formats a date string, number, or Date object into a standard report generated timestamp (e.g., DD/MM/YYYY HH:mm).
 */
export function formatReportDateTime(
  input: string | number | Date | null | undefined = new Date(),
  locale: string = DEFAULT_REPORT_LOCALE,
  fallback: string = '—',
): string {
  const date = parseLocalDate(input);
  if (!date) return fallback;
  const datePart = date.toLocaleDateString(locale);
  const timePart = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} ${timePart}`;
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
