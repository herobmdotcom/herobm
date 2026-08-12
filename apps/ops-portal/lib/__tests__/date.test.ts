import { parseLocalDate, formatLocalDate, toInputDateFormat } from '../date';

describe('Date Formatting Utilities', () => {
  describe('parseLocalDate', () => {
    it('returns null for null, undefined, or empty string', () => {
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

    it('handles Date instances and numbers', () => {
      const now = new Date();
      expect(parseLocalDate(now)).toBe(now);

      const timestamp = 1700000000000;
      const parsed = parseLocalDate(timestamp);
      expect(parsed!.getTime()).toBe(timestamp);
    });
  });

  describe('formatLocalDate', () => {
    it('returns fallback for invalid or empty inputs', () => {
      expect(formatLocalDate(null)).toBe('—');
      expect(formatLocalDate(undefined, undefined, '')).toBe('');
      expect(formatLocalDate('invalid-date', undefined, 'N/A')).toBe('N/A');
    });

    it('formats valid date string using browser locale', () => {
      const formatted = formatLocalDate('2026-08-31');
      expect(formatted).not.toBe('—');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('toInputDateFormat', () => {
    it('returns empty string for null or invalid inputs', () => {
      expect(toInputDateFormat(null)).toBe('');
      expect(toInputDateFormat('invalid')).toBe('');
    });

    it('formats dates as YYYY-MM-DD for input elements', () => {
      expect(toInputDateFormat('2026-08-31')).toBe('2026-08-31');
      expect(toInputDateFormat(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });
});
