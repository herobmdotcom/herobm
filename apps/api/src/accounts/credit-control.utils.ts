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
 * Logical OR gate: if either the account OR the account group is on hold, the resolve is true.
 */
export function resolveEffectiveCreditHold(
  account: AccountCreditProfile,
): boolean {
  if (account.isOnCreditHold) return true;
  if (account.accountGroup?.isOnCreditHold) return true;
  return false;
}

/**
 * Resolves the effective credit limit string.
 * Order of precedence: Account limit -> Group limit -> '0' (Cash Basis).
 */
export function resolveEffectiveCreditLimit(
  account: AccountCreditProfile,
): string {
  if (account.creditLimit !== null && account.creditLimit !== undefined) {
    return account.creditLimit;
  }
  if (
    account.accountGroup?.creditLimit !== null &&
    account.accountGroup?.creditLimit !== undefined
  ) {
    return account.accountGroup.creditLimit;
  }
  return '0'; // secure fallback: no credit
}

/**
 * Resolves the effective Trading Terms ID.
 * Order of precedence: Account term -> Group term -> null (Cash/COD defaults in system).
 */
export function resolveEffectiveTradingTermsId(
  account: AccountCreditProfile,
): string | null {
  if (account.tradingTermsId !== null && account.tradingTermsId !== undefined) {
    return account.tradingTermsId;
  }
  if (
    account.accountGroup?.tradingTermsId !== null &&
    account.accountGroup?.tradingTermsId !== undefined
  ) {
    return account.accountGroup.tradingTermsId;
  }
  return null;
}
