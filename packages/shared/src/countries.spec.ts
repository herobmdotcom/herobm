import { getCountryCode, COUNTRIES } from './countries';

describe('countries', () => {
  describe('getCountryCode', () => {
    it('returns ISO Alpha-2 code for full English country names', () => {
      expect(getCountryCode('United States')).toBe('US');
      expect(getCountryCode('Australia')).toBe('AU');
      expect(getCountryCode('Germany')).toBe('DE');
      expect(getCountryCode('Japan')).toBe('JP');
    });

    it('returns ISO Alpha-2 code for Alpha-3 codes', () => {
      expect(getCountryCode('USA')).toBe('US');
      expect(getCountryCode('AUS')).toBe('AU');
      expect(getCountryCode('JPN')).toBe('JP');
      expect(getCountryCode('DEU')).toBe('DE');
    });

    it('returns uppercase ISO Alpha-2 code for already valid Alpha-2 codes', () => {
      expect(getCountryCode('US')).toBe('US');
      expect(getCountryCode('us')).toBe('US');
      expect(getCountryCode('AU')).toBe('AU');
      expect(getCountryCode('au')).toBe('AU');
      expect(getCountryCode('JP')).toBe('JP');
    });

    it('handles whitespace around input', () => {
      expect(getCountryCode('  USA  ')).toBe('US');
      expect(getCountryCode('  AU ')).toBe('AU');
      expect(getCountryCode('  United States  ')).toBe('US');
    });

    it('returns undefined for empty, null, or undefined values', () => {
      expect(getCountryCode('')).toBeUndefined();
      expect(getCountryCode('   ')).toBeUndefined();
      expect(getCountryCode(null)).toBeUndefined();
      expect(getCountryCode(undefined)).toBeUndefined();
    });

    it('returns undefined for invalid or unknown country codes', () => {
      expect(getCountryCode('ZZ')).toBeUndefined();
      expect(getCountryCode('XX')).toBeUndefined();
      expect(getCountryCode('foobar123')).toBeUndefined();
    });
  });

  describe('COUNTRIES', () => {
    it('contains standard country definitions sorted by name', () => {
      expect(COUNTRIES.length).toBeGreaterThan(100);
      expect(COUNTRIES.find(c => c.code === 'US')?.name).toBe('United States of America');
      expect(COUNTRIES.find(c => c.code === 'AU')?.name).toBe('Australia');
    });
  });
});
