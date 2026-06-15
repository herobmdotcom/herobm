import { CUSTOMER_STATE } from '@herobm/shared';
import { CreditAssessmentResult } from './credit-assessment.service';

export interface CustomerProfile {
  stateCode: string;
  isOnCreditHold: boolean;
  creditLimit: string | null;
  tradingTermsId: string | null;
}

export interface CustomerGroupProfile {
  stateCode: string;
  isOnCreditHold: boolean;
  creditLimit: string | null;
  tradingTermsId: string | null;
}

export interface ResolvedCustomerRiskProfile {
  isSalesBlocked: boolean;
  salesBlockReasons: string[];
  effectiveCreditLimit: string;
  effectiveTradingTermsId: string | null;
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
  };

  resolved.effectiveTradingTermsId =
    customer.tradingTermsId || (group ? group.tradingTermsId : null) || null;

  resolved.effectiveCreditLimit =
    customer.creditLimit ?? (group ? group.creditLimit : '0') ?? '0';

  if (customer.stateCode !== CUSTOMER_STATE.ACTIVE) {
    resolved.isSalesBlocked = true;
    resolved.salesBlockReasons.push(`customer_${customer.stateCode}`);
  }

  if (group && group.stateCode !== CUSTOMER_STATE.ACTIVE) {
    resolved.isSalesBlocked = true;
    resolved.salesBlockReasons.push(`group_${group.stateCode}`);
  }

  // Credit/Limit checks only block progression to quote or confirm
  const isProgression = operation === 'confirm' || operation === 'quote';

  if (customer.isOnCreditHold) {
    if (isProgression || operation === 'update') {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('customer_credit_hold');
    }
  } else if (group && group.isOnCreditHold) {
    if (isProgression || operation === 'update') {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('group_credit_hold');
    }
  }

  if (creditAssessment.isOverdue) {
    if (isProgression) {
      resolved.isSalesBlocked = true;
      resolved.salesBlockReasons.push('overdue_balance');
    }
  }

  const limitNum = parseFloat(resolved.effectiveCreditLimit);
  if (limitNum >= 0) {
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
