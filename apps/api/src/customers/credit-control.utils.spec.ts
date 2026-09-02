import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
  resolveEffectiveTradingTermsId,
  resolveEffectiveEarlyPaymentDiscount,
  CustomerCreditProfile,
} from './credit-control.utils';

describe('credit-control.utils', () => {
  describe('resolveEffectiveCreditHold', () => {
    it('returns true if customer is on hold', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: true,
        tradingTermsId: null,
      };
      expect(resolveEffectiveCreditHold(p)).toBe(true);
    });

    it('returns true if group is on hold, even if customer is false', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: true,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditHold(p)).toBe(true);
    });

    it('returns false if neither are on hold', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
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
      const p: CustomerCreditProfile = {
        creditLimit: '1000',
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: '500',
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('1000');
    });

    it('cascades to group limit when customer limit is null', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: '500',
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('500');
    });

    it('falls back to 0 if both are null', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: null,
        },
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('0');
    });

    it('handles missing group gracefully', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
      };
      expect(resolveEffectiveCreditLimit(p)).toBe('0');
    });
  });

  describe('resolveEffectiveTradingTermsId', () => {
    it('resolves customer terms when present', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: 'term_1',
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_2',
        },
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_1');
    });

    it('falls back to group term', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_2',
        },
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_2');
    });

    it('falls back to system default if customer and group terms are missing', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: null,
        },
        systemDefaultCustomerTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_system');
    });

    it('prioritizes group term over system default', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        customerGroup: {
          creditLimit: null,
          isOnCreditHold: false,
          tradingTermsId: 'term_group',
        },
        systemDefaultCustomerTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_group');
    });

    it('prioritizes customer term over system default', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: 'term_customer',
        customerGroup: null,
        systemDefaultCustomerTermsId: 'term_system',
      };
      expect(resolveEffectiveTradingTermsId(p)).toBe('term_customer');
    });

    it('returns null if all are missing', () => {
      const p: CustomerCreditProfile = {
        creditLimit: null,
        isOnCreditHold: false,
        tradingTermsId: null,
        systemDefaultCustomerTermsId: null,
      };
      expect(resolveEffectiveTradingTermsId(p)).toBeNull();
    });
  });

  describe('resolveEffectiveEarlyPaymentDiscount', () => {
    it('resolves customer early payment discount when present', () => {
      const p = {
        earlyPaymentDiscount: '2.50',
        earlyPaymentDiscountDays: 10,
        customerGroup: {
          earlyPaymentDiscount: '1.00',
          earlyPaymentDiscountDays: 5,
        },
      };
      const result = resolveEffectiveEarlyPaymentDiscount(p);
      expect(result.earlyPaymentDiscount).toBe('2.50');
      expect(result.earlyPaymentDiscountDays).toBe(10);
    });

    it('cascades to group early payment discount when customer discount is null', () => {
      const p = {
        earlyPaymentDiscount: null,
        earlyPaymentDiscountDays: null,
        customerGroup: {
          earlyPaymentDiscount: '1.00',
          earlyPaymentDiscountDays: 5,
        },
      };
      const result = resolveEffectiveEarlyPaymentDiscount(p);
      expect(result.earlyPaymentDiscount).toBe('1.00');
      expect(result.earlyPaymentDiscountDays).toBe(5);
    });

    it('returns null if both are null', () => {
      const p = {
        earlyPaymentDiscount: null,
        earlyPaymentDiscountDays: null,
        customerGroup: {
          earlyPaymentDiscount: null,
          earlyPaymentDiscountDays: null,
        },
      };
      const result = resolveEffectiveEarlyPaymentDiscount(p);
      expect(result.earlyPaymentDiscount).toBeNull();
      expect(result.earlyPaymentDiscountDays).toBeNull();
    });

    it('handles missing group gracefully', () => {
      const p = {
        earlyPaymentDiscount: null,
        earlyPaymentDiscountDays: null,
      };
      const result = resolveEffectiveEarlyPaymentDiscount(p);
      expect(result.earlyPaymentDiscount).toBeNull();
      expect(result.earlyPaymentDiscountDays).toBeNull();
    });
  });
});
