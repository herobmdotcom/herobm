import { resolveEffectiveDiscount } from '@modbm/shared';

describe('Pricing Utils - resolveEffectiveDiscount', () => {
  it('should return the maximum of two numeric strings', () => {
    expect(resolveEffectiveDiscount('10', '15')).toBe('15');
    expect(resolveEffectiveDiscount('20.5', '10.2')).toBe('20.5');
  });

  it('should handle numbers rather than strings', () => {
    expect(resolveEffectiveDiscount(12, 18)).toBe('18');
  });

  it('should handle negative or zero values correctly', () => {
    expect(resolveEffectiveDiscount('0', '0')).toBe('0');
    expect(resolveEffectiveDiscount('-5', '0')).toBe('0');
  });

  it('should treat null or undefined or empty strings as 0', () => {
    expect(resolveEffectiveDiscount(null, '5')).toBe('5');
    expect(resolveEffectiveDiscount('10', undefined)).toBe('10');
    expect(resolveEffectiveDiscount('', '2')).toBe('2');
    expect(resolveEffectiveDiscount(null, null)).toBe('0');
  });

  it('should safely parse garbage strings as 0', () => {
    expect(resolveEffectiveDiscount('abc', '5')).toBe('5');
    expect(resolveEffectiveDiscount('10', 'garbage')).toBe('10');
    expect(resolveEffectiveDiscount('garbage1', 'garbage2')).toBe('0');
  });
});
