import { resolveEffectiveDiscount, DiscountRule } from '@herobm/shared';

describe('Pricing Utils - resolveEffectiveDiscount (most-specific-wins)', () => {
  // Helper to build a rule array
  const rule = (
    ownerType: 'customer' | 'customer_group',
    productGroupId: string | null,
    discountPercentage: string | number,
  ): DiscountRule => ({
    ownerType,
    productGroupId,
    discountPercentage,
  });

  // ── Priority cascade ────────────────────────────────────────────────

  it('P1: customer × product_group wins over everything', () => {
    const rules = [
      rule('customer', 'pg-1', '5'),
      rule('customer_group', 'pg-1', '15'),
      rule('customer', null, '20'),
      rule('customer_group', null, '25'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('5');
  });

  it('P2: group × product_group wins when no customer × PG rule', () => {
    const rules = [
      rule('customer_group', 'pg-1', '12'),
      rule('customer', null, '20'),
      rule('customer_group', null, '25'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('12');
  });

  it('P3: customer wildcard wins when no product-group-specific rule', () => {
    const rules = [
      rule('customer', null, '8'),
      rule('customer_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('8');
  });

  it('P4: group wildcard is last fallback', () => {
    const rules = [rule('customer_group', null, '10')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('10');
  });

  it('P5: 0% when no rules match', () => {
    expect(resolveEffectiveDiscount([], 'pg-1')).toBe('0');
  });

  // ── Most-specific-wins semantics (not max!) ─────────────────────────

  it('should allow restriction: customer×PG = 5% overrides group×PG = 15%', () => {
    const rules = [
      rule('customer', 'pg-1', '5'),
      rule('customer_group', 'pg-1', '15'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('5');
  });

  it('should allow restriction: customer wildcard = 3% overrides group wildcard = 10%', () => {
    const rules = [
      rule('customer', null, '3'),
      rule('customer_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, null)).toBe('3');
  });

  // ── Null product group (product has no group) ───────────────────────

  it('should use customer wildcard when product has no group', () => {
    const rules = [
      rule('customer', 'pg-1', '15'),
      rule('customer', null, '5'),
      rule('customer_group', null, '10'),
    ];
    // productGroupId = null → only wildcard rules can match
    expect(resolveEffectiveDiscount(rules, null)).toBe('5');
  });

  it('should use group wildcard when product has no group and no customer wildcard', () => {
    const rules = [
      rule('customer', 'pg-1', '15'),
      rule('customer_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, null)).toBe('10');
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('should parse numeric discount values', () => {
    const rules = [rule('customer', null, 12.5)];
    expect(resolveEffectiveDiscount(rules, null)).toBe('12.5');
  });

  it('should treat empty string as 0', () => {
    const rules = [rule('customer', null, '')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should treat garbage strings as 0', () => {
    const rules = [rule('customer', null, 'abc')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should handle a 0% discount rule as a valid match', () => {
    const rules = [
      rule('customer', 'pg-1', '0'),
      rule('customer_group', null, '15'),
    ];
    // customer × pg-1 = 0% is more specific → wins over group wildcard 15%
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should clamp discount percentage > 100% to 100', () => {
    const rules = [rule('customer', null, '120')];
    expect(resolveEffectiveDiscount(rules, null)).toBe('100');
  });

  it('should clamp negative discount percentage to 0', () => {
    const rules = [rule('customer', null, '-10')];
    expect(resolveEffectiveDiscount(rules, null)).toBe('0');
  });
});
