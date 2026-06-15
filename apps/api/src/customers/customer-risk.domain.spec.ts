import { CUSTOMER_STATE } from '@herobm/shared';
import {
  CustomerProfile,
  CustomerGroupProfile,
  resolveCustomerRiskProfile,
} from './customer-risk.domain';
import { CreditAssessmentResult } from './credit-assessment.service';

describe('Customer Risk Domain', () => {
  const baseCustomer: CustomerProfile = {
    stateCode: CUSTOMER_STATE.ACTIVE,
    isOnCreditHold: false,
    creditLimit: '0',
    tradingTermsId: null,
  };

  const baseGroup: CustomerGroupProfile = {
    stateCode: CUSTOMER_STATE.ACTIVE,
    isOnCreditHold: false,
    creditLimit: '0',
    tradingTermsId: null,
  };

  const baseAssessment: CreditAssessmentResult = {
    totalArBalance: 0,
    overdueBalance: 0,
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

  it('should block sales if group is inactive', () => {
    const result = resolveCustomerRiskProfile(
      baseCustomer,
      { ...baseGroup, stateCode: CUSTOMER_STATE.INACTIVE },
      baseAssessment,
      0,
      'hard',
    );
    expect(result.isSalesBlocked).toBe(true);
    expect(result.salesBlockReasons).toContain('group_inactive');
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
      { ...baseAssessment, totalArBalance: 500 },
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
      { ...baseAssessment, totalArBalance: 500 },
      600, // 500 + 600 > 1000
      'soft',
    );
    expect(result.isSalesBlocked).toBe(false);
    expect(result.salesBlockReasons).not.toContain('credit_limit_exceeded');
  });
});
