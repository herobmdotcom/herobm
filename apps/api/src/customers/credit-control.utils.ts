export interface AccountCreditProfile {
  creditLimit: string | null;
  isOnCreditHold: boolean;
  tradingTermsId: string | null;
  accountGroup?: {
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
  customer: AccountCreditProfile,
): boolean {
  if (
    customer.overrideCreditHoldUntil &&
    customer.overrideCreditHoldUntil > new Date()
  ) {
    return false;
  }
  if (customer.isOnCreditHold) return true;
  if (customer.accountGroup?.isOnCreditHold) return true;
  return false;
}

/**
 * Resolves the effective credit limit string.
 * Order of precedence: Customer limit -> Group limit -> '0' (Cash Basis).
 */
export function resolveEffectiveCreditLimit(
  customer: AccountCreditProfile,
): string {
  if (customer.creditLimit !== null && customer.creditLimit !== undefined) {
    return customer.creditLimit;
  }
  if (
    customer.accountGroup?.creditLimit !== null &&
    customer.accountGroup?.creditLimit !== undefined
  ) {
    return customer.accountGroup.creditLimit;
  }
  return '0'; // secure fallback: no credit
}

/**
 * Resolves the effective Trading Terms ID.
 * Order of precedence: Customer term -> Group term -> System Default.
 */
export function resolveEffectiveTradingTermsId(
  customer: AccountCreditProfile,
): string | null {
  if (
    customer.tradingTermsId !== null &&
    customer.tradingTermsId !== undefined
  ) {
    return customer.tradingTermsId;
  }
  if (
    customer.accountGroup?.tradingTermsId !== null &&
    customer.accountGroup?.tradingTermsId !== undefined
  ) {
    return customer.accountGroup.tradingTermsId;
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
  accountGroup?: {
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
    customer.accountGroup?.earlyPaymentDiscount !== null &&
    customer.accountGroup?.earlyPaymentDiscount !== undefined
  ) {
    return {
      earlyPaymentDiscount: customer.accountGroup.earlyPaymentDiscount,
      earlyPaymentDiscountDays:
        customer.accountGroup.earlyPaymentDiscountDays ?? null,
    };
  }
  return {
    earlyPaymentDiscount: null,
    earlyPaymentDiscountDays: null,
  };
}
