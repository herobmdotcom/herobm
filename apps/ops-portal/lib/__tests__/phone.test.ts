import { parseInitialPhone, toSupportedCountry } from '../phone';

describe('lib/phone', () => {
  describe('parseInitialPhone', () => {
    it('prepends + when missing and digits exist', () => {
      expect(parseInitialPhone('18005550244')).toBe('+18005550244');
      expect(parseInitialPhone('0412 345 678')).toBe('+0412345678');
    });

    it('keeps existing + prefix intact', () => {
      expect(parseInitialPhone('+1-800-555-0244')).toBe('+1-800-555-0244');
      expect(parseInitialPhone('+61412345678')).toBe('+61412345678');
    });

    it('returns empty string for empty or falsy inputs', () => {
      expect(parseInitialPhone('')).toBe('');
      expect(parseInitialPhone(null)).toBe('');
      expect(parseInitialPhone(undefined)).toBe('');
    });
  });

  describe('toSupportedCountry', () => {
    it('resolves 3-letter country codes like USA to valid 2-letter codes', () => {
      expect(toSupportedCountry('USA')).toBe('US');
      expect(toSupportedCountry('AUS')).toBe('AU');
      expect(toSupportedCountry('JPN')).toBe('JP');
    });

    it('preserves valid 2-letter country codes', () => {
      expect(toSupportedCountry('US')).toBe('US');
      expect(toSupportedCountry('AU')).toBe('AU');
      expect(toSupportedCountry('GB')).toBe('GB');
    });

    it('normalizes lowercase 2-letter codes', () => {
      expect(toSupportedCountry('us')).toBe('US');
      expect(toSupportedCountry('au')).toBe('AU');
    });

    it('resolves full country names', () => {
      expect(toSupportedCountry('United States')).toBe('US');
      expect(toSupportedCountry('United States of America')).toBe('US');
      expect(toSupportedCountry('Australia')).toBe('AU');
    });

    it('returns undefined for invalid or unsupported country strings', () => {
      expect(toSupportedCountry('ZZ')).toBeUndefined();
      expect(toSupportedCountry('XX')).toBeUndefined();
      expect(toSupportedCountry('UnknownCountry')).toBeUndefined();
      expect(toSupportedCountry('')).toBeUndefined();
      expect(toSupportedCountry(null)).toBeUndefined();
      expect(toSupportedCountry(undefined)).toBeUndefined();
    });
  });
});
