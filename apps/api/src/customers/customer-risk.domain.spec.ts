import { CUSTOMER_STATE } from '@herobm/shared';
import { CreditAssessmentResult } from './credit-assessment.service';
import {
  CustomerGroupProfile,
  CustomerProfile,
  resolveCustomerRiskProfile,
} from './customer-risk.domain';

describe('Customer Risk Domain', () => {
  const baseCustomer: CustomerProfile = {
    stateCode: CUSTOMER_STATE.ACTIVE,
    isOnCreditHold: false,
    creditLimit: '0',
    tradingTermsId: null,
    overrideCreditHoldUntil: null,
  };

  const baseGroup: CustomerGroupProfile = {
    stateCode: CUSTOMER_STATE.ACTIVE,
    isOnCreditHold: false,
    creditLimit: '0',
    tradingTermsId: null,
  };

  const baseAssessment: CreditAssessmentResult = {
    totalInvoiceBalance: 0,
    overdueInvoiceBalance: 0,
    glBalance: 0,
    isOverdue: false,
  };

  it('should allow active customers with no holds or limits', () => {
    const result = resolveCustomerRiskProfile(
      baseCustomer,
      baseGroup,
      baseAssessment,
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(false);
    expect(result.salesBlockReasons).toEqual([]);
  });

  it('should block sales if customer is inactive', () => {
    const result = resolveCustomerRiskProfile(
      { ...baseCustomer, stateCode: CUSTOMER_STATE.INACTIVE },
      baseGroup,
      baseAssessment,
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('customer_inactive');
  });

  it('should block sales on customer credit hold', () => {
    const result = resolveCustomerRiskProfile(
      { ...baseCustomer, isOnCreditHold: true },
      baseGroup,
      baseAssessment,
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('customer_credit_hold');
  });

  it('should block sales on group credit hold', () => {
    const result = resolveCustomerRiskProfile(
      baseCustomer,
      { ...baseGroup, isOnCreditHold: true },
      baseAssessment,
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('group_credit_hold');
  });

  it('should block sales if overdue balance exists', () => {
    const result = resolveCustomerRiskProfile(
      baseCustomer,
      baseGroup,
      { ...baseAssessment, isOverdue: true },
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('overdue_balance');
  });

  it('should block sales on hard credit limit breach', () => {
    const result = resolveCustomerRiskProfile(
      { ...baseCustomer, creditLimit: '1000' },
      baseGroup,
      { ...baseAssessment, totalInvoiceBalance: 500 },
      600, // 500 + 600 > 1000
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('credit_limit_exceeded');
  });

  it('should not block sales on soft credit limit breach', () => {
    const result = resolveCustomerRiskProfile(
      { ...baseCustomer, creditLimit: '1000' },
      baseGroup,
      { ...baseAssessment, totalInvoiceBalance: 500 },
      600, // 500 + 600 > 1000
      'soft',
    );
    expect(result.isSalesBlocked).toBe(false);
    expect(result.salesBlockReasons).not.toContain('credit_limit_exceeded');
  });

  it('should inherit credit limit, terms, and discounts from group when customer fields are empty strings or null', () => {
    const result = resolveCustomerRiskProfile(
      {
        ...baseCustomer,
        creditLimit: '',
        tradingTermsId: '',
        earlyPaymentDiscount: '',
        earlyPaymentDiscountDays: undefined,
      },
      {
        ...baseGroup,
        creditLimit: '1000',
        tradingTermsId: 'terms_123',
        earlyPaymentDiscount: '2.50',
        earlyPaymentDiscountDays: 10,
      },
      baseAssessment,
      0,
      'hard',
    );
    expect(result.effectiveCreditLimit).toBe('1000');
    expect(result.effectiveTradingTermsId).toBe('terms_123');
    expect(result.earlyPaymentDiscount).toBe('2.50');
    expect(result.earlyPaymentDiscountDays).toBe(10);
  });
});
