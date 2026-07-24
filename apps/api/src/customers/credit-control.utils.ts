export interface CustomerCreditProfile {
  creditLimit: string | null;
  isOnCreditHold: boolean;
  tradingTermsId: string | null;
  customerGroup?: {
    creditLimit: string | null;
    isOnCreditHold: boolean;
    tradingTermsId: string | null;
  } | null;
  systemDefaultCustomerTermsId?: string | null;
  overrideCreditHoldUntil?: Date | null;
}

/**
 * Resolves the effective credit hold status.
 * Logical OR gate: if either the customer OR the customer group is on hold, the resolve is true.
 */
export function resolveEffectiveCreditHold(
  customer: CustomerCreditProfile,
): boolean {
  if (
    customer.overrideCreditHoldUntil &&
    customer.overrideCreditHoldUntil > new Date()
  ) {
    return false;
  }
  if (customer.isOnCreditHold) return true;
  if (customer.customerGroup?.isOnCreditHold) return true;
  return false;
}

/**
 * Resolves the effective credit limit string.
 * Order of precedence: Customer limit -> Group limit -> '0' (Cash Basis).
 */
export function resolveEffectiveCreditLimit(
  customer: CustomerCreditProfile,
): string {
  if (customer.creditLimit !== null && customer.creditLimit !== undefined) {
    return customer.creditLimit;
  }
  if (
    customer.customerGroup?.creditLimit !== null &&
    customer.customerGroup?.creditLimit !== undefined
  ) {
    return customer.customerGroup.creditLimit;
  }
  return '0'; // secure fallback: no credit
}

/**
 * Resolves the effective Trading Terms ID.
 * Order of precedence: Customer term -> Group term -> System Default.
 */
export function resolveEffectiveTradingTermsId(
  customer: CustomerCreditProfile,
): string | null {
  if (
    customer.tradingTermsId !== null &&
    customer.tradingTermsId !== undefined
  ) {
    return customer.tradingTermsId;
  }
  if (
    customer.customerGroup?.tradingTermsId !== null &&
    customer.customerGroup?.tradingTermsId !== undefined
  ) {
    return customer.customerGroup.tradingTermsId;
  }
  if (
    customer.systemDefaultCustomerTermsId !== null &&
    customer.systemDefaultCustomerTermsId !== undefined
  ) {
    return customer.systemDefaultCustomerTermsId;
  }
  return null;
}

/**
 * Resolves the effective early payment discount.
 * Order of precedence: Customer -> Group -> null.
 */
export function resolveEffectiveEarlyPaymentDiscount(customer: {
  earlyPaymentDiscount?: string | null;
  earlyPaymentDiscountDays?: number | null;
  customerGroup?: {
    earlyPaymentDiscount?: string | null;
    earlyPaymentDiscountDays?: number | null;
  } | null;
}): {
  earlyPaymentDiscount: string | null;
  earlyPaymentDiscountDays: number | null;
} {
  if (
    customer.earlyPaymentDiscount !== null &&
    customer.earlyPaymentDiscount !== undefined
  ) {
    return {
      earlyPaymentDiscount: customer.earlyPaymentDiscount,
      earlyPaymentDiscountDays: customer.earlyPaymentDiscountDays ?? null,
    };
  }
  if (
    customer.customerGroup?.earlyPaymentDiscount !== null &&
    customer.customerGroup?.earlyPaymentDiscount !== undefined
  ) {
    return {
      earlyPaymentDiscount: customer.customerGroup.earlyPaymentDiscount,
      earlyPaymentDiscountDays:
        customer.customerGroup.earlyPaymentDiscountDays ?? null,
    };
  }
  return {
    earlyPaymentDiscount: null,
    earlyPaymentDiscountDays: null,
  };
}
