import { resolveEffectiveDiscount, DiscountRule } from '@modbm/shared';

describe('Pricing Utils - resolveEffectiveDiscount (most-specific-wins)', () => {
  // Helper to build a rule array
  const rule = (
    ownerType: 'account' | 'account_group',
    productGroupId: string | null,
    discountPercentage: string | number,
  ): DiscountRule => ({
    ownerType,
    productGroupId,
    discountPercentage,
  });

  // ── Priority cascade ────────────────────────────────────────────────

  it('P1: account × product_group wins over everything', () => {
    const rules = [
      rule('account', 'pg-1', '5'),
      rule('account_group', 'pg-1', '15'),
      rule('account', null, '20'),
      rule('account_group', null, '25'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('5');
  });

  it('P2: group × product_group wins when no account × PG rule', () => {
    const rules = [
      rule('account_group', 'pg-1', '12'),
      rule('account', null, '20'),
      rule('account_group', null, '25'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('12');
  });

  it('P3: account wildcard wins when no product-group-specific rule', () => {
    const rules = [
      rule('account', null, '8'),
      rule('account_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('8');
  });

  it('P4: group wildcard is last fallback', () => {
    const rules = [rule('account_group', null, '10')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('10');
  });

  it('P5: 0% when no rules match', () => {
    expect(resolveEffectiveDiscount([], 'pg-1')).toBe('0');
  });

  // ── Most-specific-wins semantics (not max!) ─────────────────────────

  it('should allow restriction: account×PG = 5% overrides group×PG = 15%', () => {
    const rules = [
      rule('account', 'pg-1', '5'),
      rule('account_group', 'pg-1', '15'),
    ];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('5');
  });

  it('should allow restriction: account wildcard = 3% overrides group wildcard = 10%', () => {
    const rules = [
      rule('account', null, '3'),
      rule('account_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, null)).toBe('3');
  });

  // ── Null product group (product has no group) ───────────────────────

  it('should use account wildcard when product has no group', () => {
    const rules = [
      rule('account', 'pg-1', '15'),
      rule('account', null, '5'),
      rule('account_group', null, '10'),
    ];
    // productGroupId = null → only wildcard rules can match
    expect(resolveEffectiveDiscount(rules, null)).toBe('5');
  });

  it('should use group wildcard when product has no group and no account wildcard', () => {
    const rules = [
      rule('account', 'pg-1', '15'),
      rule('account_group', null, '10'),
    ];
    expect(resolveEffectiveDiscount(rules, null)).toBe('10');
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('should parse numeric discount values', () => {
    const rules = [rule('account', null, 12.5)];
    expect(resolveEffectiveDiscount(rules, null)).toBe('12.5');
  });

  it('should treat empty string as 0', () => {
    const rules = [rule('account', null, '')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should treat garbage strings as 0', () => {
    const rules = [rule('account', null, 'abc')];
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should handle a 0% discount rule as a valid match', () => {
    const rules = [
      rule('account', 'pg-1', '0'),
      rule('account_group', null, '15'),
    ];
    // account × pg-1 = 0% is more specific → wins over group wildcard 15%
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('0');
  });

  it('should not match product-group rules for a different product group', () => {
    const rules = [
      rule('account', 'pg-2', '20'),
      rule('account_group', null, '5'),
    ];
    // pg-2 rule doesn't match pg-1 → falls through to group wildcard
    expect(resolveEffectiveDiscount(rules, 'pg-1')).toBe('5');
  });
});
