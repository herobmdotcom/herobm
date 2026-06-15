import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
  resolveEffectiveTradingTermsId,
  AccountCreditProfile,
} from './credit-control.utils';

describe('credit-control.utils', () => {
  describe('resolveEffectiveCreditHold', () => {
    it('returns true if customer is on hold', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: true,
        tradingTermsId: null,
      };
      expect(resolveEffectiveCreditHold(p)).toBe(true);
    });

    it('returns true if group is on hold, even if customer is false', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: true,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditHold(p)).toBe(true);
    });

    it('returns false if neither are on hold', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditHold(p)).toBe(false);
    });
  });

  describe('resolveEffectiveCreditLimit', () => {
    it('resolves customer limit when present', () => {
      const p: AccountCreditProfile = {
        creditLimit: '1000',
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: '500',
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('1000');
    });

    it('cascades to group limit when customer limit is null', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: '500',
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('500');
    });

    it('falls back to 0 if both are null', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('0');
    });

    it('handles missing group gracefully', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('0');
    });
  });

  describe('resolveEffectiveTradingTermsId', () => {
    it('resolves customer terms when present', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: 'term_1',
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_2',
        },
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_1');
    });

    it('falls back to group term', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_2',
        },
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_2');
    });

    it('falls back to system default if customer and group terms are missing', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: null,
        },
        systemDefaultTradingTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_system');
    });

    it('prioritizes group term over system default', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        accountGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_group',
        },
        systemDefaultTradingTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_group');
    });

    it('prioritizes customer term over system default', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: 'term_customer',
        accountGroup: null,
        systemDefaultTradingTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_customer');
    });

    it('returns null if all are missing', () => {
      const p: AccountCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        systemDefaultTradingTermsId: null,
      };
      expect(resolveEffectiveTradingTermsId(p)).toBeNull();
    });
  });
});
