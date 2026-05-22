export interface AccountCreditProfile {
  creditLimit: string | null;
  isOnCreditHold: boolean;
  tradingTermsId: string | null;
  accountGroup?: {
    creditLimit: string | null;
    isOnCreditHold: boolean;
    tradingTermsId: string | null;
  } | null;
}

/**
 * Resolves the effective credit hold status.
 * Logical OR gate: if either the customer OR the customer group is on hold, the resolve is true.
 */
export function resolveEffectiveCreditHold(
  customer: AccountCreditProfile,
): boolean {
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
 * Order of precedence: Customer term -> Group term -> null (Cash/COD defaults in system).
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
  return null;
}
