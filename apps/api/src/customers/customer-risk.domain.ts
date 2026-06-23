import { CUSTOMER_STATE } from '@herobm/shared';
import { CreditAssessmentResult } from './credit-assessment.service';

export interface CustomerProfile {
  stateCode: string;
  isOnCreditHold: boolean;
  creditLimit: string | null;
  tradingTermsId: string | null;
  overrideCreditHoldUntil: Date | null;
  earlyPaymentDiscount?: string | null;
  earlyPaymentDiscountDays?: number | null;
}

export interface CustomerGroupProfile {
  stateCode: string;
  isOnCreditHold: boolean;
  creditLimit: string | null;
  tradingTermsId: string | null;
  earlyPaymentDiscount?: string | null;
  earlyPaymentDiscountDays?: number | null;
}

export interface ResolvedCustomerRiskProfile {
  isSalesBlocked: boolean;
  salesBlockReasons: string[];
  effectiveCreditLimit: string;
  effectiveTradingTermsId: string | null;
  earlyPaymentDiscount: string;
  earlyPaymentDiscountDays: number | null;
}

export function resolveCustomerRiskProfile(
  customer: CustomerProfile,
  group: CustomerGroupProfile | null,
  creditAssessment: CreditAssessmentResult,
  additionalExposure: number = 0,
  creditLimitBehavior: 'hard' | 'soft' = 'hard',
  operation: 'create' | 'update' | 'confirm' | 'quote' = 'confirm',
): ResolvedCustomerRiskProfile {
  const resolved: ResolvedCustomerRiskProfile = {
    isSalesBlocked: false,
    salesBlockReasons: [],
    effectiveCreditLimit: '0',
    effectiveTradingTermsId: null,
    earlyPaymentDiscount: '0',
    earlyPaymentDiscountDays: null,
  };

  resolved.effectiveTradingTermsId =
    customer.tradingTermsId || (group ? group.tradingTermsId : null) || null;

  resolved.effectiveCreditLimit =
    customer.creditLimit ?? (group ? group.creditLimit : '0') ?? '0';

  resolved.earlyPaymentDiscount =
    customer.earlyPaymentDiscount ??
    (group ? group.earlyPaymentDiscount : '0') ??
    '0';

  resolved.earlyPaymentDiscountDays =
    customer.earlyPaymentDiscountDays ??
    (group ? group.earlyPaymentDiscountDays : null) ??
    null;

  if (customer.stateCode !== CUSTOMER_STATE.ACTIVE) {
    resolved.isSalesBlocked = true;
    resolved.salesBlockReasons.push(`customer_${customer.stateCode}`);
  }

  // Credit/Limit checks only block progression to quote or confirm
  const isProgression = operation === 'confirm' || operation === 'quote';

  const overrideDate = customer.overrideCreditHoldUntil
    ? new Date(customer.overrideCreditHoldUntil)
    : null;
  const hasValidOverride = overrideDate && overrideDate > new Date();

  if (customer.isOnCreditHold && !hasValidOverride) {
    if (isProgression || operation === 'update') {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('customer_credit_hold');
    }
  } else if (group && group.isOnCreditHold && !hasValidOverride) {
    if (isProgression || operation === 'update') {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('group_credit_hold');
    }
  }

  if (creditAssessment.isOverdue && !hasValidOverride) {
    if (isProgression) {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('overdue_balance');
    }
  }

  const limitNum = parseFloat(resolved.effectiveCreditLimit);
  if (limitNum >= 0 && !hasValidOverride) {
    const totalExposure = creditAssessment.totalArBalance + additionalExposure;
    if (totalExposure > limitNum) {
      if (creditLimitBehavior === 'hard') {
        resolved.isSalesBlocked = true;
        resolved.salesBlockReasons.push('credit_limit_exceeded');
      }
    }
  }

  return resolved;
}
