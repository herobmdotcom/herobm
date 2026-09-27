import {
  parseLocalDate,
  formatLocalDate,
  formatLocalDateTime,
  formatReportDateTime,
  toInputDateFormat,
} from './date';

describe('Centralized Date Formatting & Parsing Utilities (@herobm/shared)', () => {
  describe('parseLocalDate', () => {
    it('returns null for null, undefined, or empty/whitespace string', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('')).toBeNull();
      expect(parseLocalDate('   ')).toBeNull();
    });

    it('parses YYYY-MM-DD in local time without timezone shift', () => {
      const parsed = parseLocalDate('2026-08-31');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(7); // 0-indexed, August is 7
      expect(parsed!.getDate()).toBe(31);
    });

    it('parses full ISO date-time strings correctly', () => {
      const parsed = parseLocalDate('2026-08-31T15:30:00.000Z');
      expect(parsed).not.toBeNull();
      expect(parsed!.getTime()).not.toBeNaN();
    });

    it('handles Date instances and timestamp numbers', () => {
      const now = new Date();
      expect(parseLocalDate(now)).toBe(now);

      const timestamp = 1700000000000;
      const parsed = parseLocalDate(timestamp);
      expect(parsed!.getTime()).toBe(timestamp);
    });

    it('parses international CSV formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)', () => {
      const d1 = parseLocalDate('31/08/2026');
      expect(d1).not.toBeNull();
      expect(d1!.getFullYear()).toBe(2026);
      expect(d1!.getMonth()).toBe(7);
      expect(d1!.getDate()).toBe(31);

      const d2 = parseLocalDate('15-05-2026');
      expect(d2).not.toBeNull();
      expect(d2!.getFullYear()).toBe(2026);
      expect(d2!.getMonth()).toBe(4); // May is 4
      expect(d2!.getDate()).toBe(15);

      const d3 = parseLocalDate('10.12.2026');
      expect(d3).not.toBeNull();
      expect(d3!.getFullYear()).toBe(2026);
      expect(d3!.getMonth()).toBe(11); // Dec is 11
      expect(d3!.getDate()).toBe(10);
    });

    it('defaults to DD/MM/YYYY when both day and month <= 12 and preferDayFirst is true', () => {
      const parsed = parseLocalDate('05/06/2026');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(5); // June is 5
      expect(parsed!.getDate()).toBe(5); // 5th of June
    });

    it('handles MM/DD/YYYY when month <= 12 and day > 12', () => {
      const parsed = parseLocalDate('05/25/2026');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(4); // May
      expect(parsed!.getDate()).toBe(25);
    });

    it('handles 2-digit years (DD/MM/YY)', () => {
      const parsed = parseLocalDate('15/05/26');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(4);
      expect(parsed!.getDate()).toBe(15);
    });

    it('handles Excel serial date numbers', () => {
      // 45427 is 2024-05-15
      const parsedNum = parseLocalDate(45427);
      expect(parsedNum).not.toBeNull();
      expect(parsedNum!.getFullYear()).toBe(2024);
      expect(parsedNum!.getMonth()).toBe(4);
      expect(parsedNum!.getDate()).toBe(15);

      const parsedStr = parseLocalDate('45427');
      expect(parsedStr).not.toBeNull();
      expect(parsedStr!.getFullYear()).toBe(2024);
      expect(parsedStr!.getMonth()).toBe(4);
      expect(parsedStr!.getDate()).toBe(15);
    });

    it('parses dates with timestamps', () => {
      const parsed = parseLocalDate('15/05/2026 14:30:45');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(4);
      expect(parsed!.getDate()).toBe(15);
      expect(parsed!.getHours()).toBe(14);
      expect(parsed!.getMinutes()).toBe(30);
      expect(parsed!.getSeconds()).toBe(45);
    });

    it('returns null for invalid Date objects or unparseable strings', () => {
      expect(parseLocalDate(new Date(NaN))).toBeNull();
      expect(parseLocalDate('not-a-valid-date')).toBeNull();
    });
  });

  describe('formatLocalDate', () => {
    it('returns fallback for invalid or empty inputs', () => {
      expect(formatLocalDate(null)).toBe('—');
      expect(formatLocalDate(undefined, undefined, '')).toBe('');
      expect(formatLocalDate('invalid-date', undefined, 'N/A')).toBe('N/A');
    });

    it('formats valid date string using specified locale', () => {
      const formatted = formatLocalDate('2026-08-31', undefined, '—', 'en-IE');
      expect(formatted).toMatch(/31\/0?8\/2026/);
    });

    it('formats valid date with options', () => {
      const formatted = formatLocalDate('2026-08-31', { month: 'short', year: 'numeric' }, '—', 'en-US');
      expect(formatted).toBe('Aug 2026');
    });
  });

  describe('formatLocalDateTime', () => {
    it('returns fallback for invalid or empty inputs', () => {
      expect(formatLocalDateTime(null)).toBe('—');
      expect(formatLocalDateTime(undefined, undefined, 'Missing')).toBe('Missing');
    });

    it('formats valid date and time string', () => {
      const d = new Date(2026, 7, 31, 14, 30);
      const formatted = formatLocalDateTime(d, undefined, '—', 'en-IE');
      expect(formatted).toContain('2026');
    });
  });

  describe('formatReportDateTime', () => {
    it('returns fallback for invalid inputs', () => {
      expect(formatReportDateTime('invalid-date')).toBe('—');
      expect(formatReportDateTime(null, 'en-IE', 'N/A')).toBe('N/A');
    });

    it('formats report timestamps in standard en-IE format', () => {
      const d = new Date(2026, 7, 31, 14, 30);
      const formatted = formatReportDateTime(d, 'en-IE');
      expect(formatted).toMatch(/31\/0?8\/2026 14:30/);
    });
  });

  describe('toInputDateFormat', () => {
    it('returns empty string for null or invalid inputs', () => {
      expect(toInputDateFormat(null)).toBe('');
      expect(toInputDateFormat('invalid')).toBe('');
    });

    it('formats dates as YYYY-MM-DD for HTML5 input elements', () => {
      expect(toInputDateFormat('2026-08-31')).toBe('2026-08-31');
      expect(toInputDateFormat(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });
});
