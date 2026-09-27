/**
 * Centralised line-pricing logic.
 *
 * Every place in the system that needs to price an order/invoice line
 * MUST call this function rather than reimplementing the formula.
 */

import { Decimal } from 'decimal.js';

// Canonical Decimal configuration for financial operations
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 28,
});

/**
 * Safely converts an input into a high-precision Decimal, defaulting to 0 for null/undefined/NaN.
 */
export function toFinancialDecimal(
  value: Decimal | number | string | null | undefined,
): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value.isNaN() ? new Decimal(0) : value;
  }
  try {
    const d = new Decimal(value);
    return d.isNaN() ? new Decimal(0) : d;
  } catch {
    return new Decimal(0);
  }
}

export const toDecimal = toFinancialDecimal;

/**
 * Rounds a financial amount to specified decimals using Decimal.ROUND_HALF_UP (PostgreSQL numeric ROUND parity).
 */
export function roundMoney(
  value: Decimal | number | string | null | undefined,
  decimals = 2,
): Decimal {
  return toFinancialDecimal(value).toDecimalPlaces(
    decimals,
    Decimal.ROUND_HALF_UP,
  );
}

export function roundCurrency(
  value: Decimal | number | string | null | undefined,
  decimals = 2,
): number {
  return roundMoney(value, decimals).toNumber();
}

export function eqMoney(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
  decimals = 2,
): boolean {
  return roundMoney(a, decimals).equals(roundMoney(b, decimals));
}

/**
 * Rounds an exchange rate or unit cost to specified decimals (default 8).
 */
export function roundRate(
  value: Decimal | number | string | null | undefined,
  decimals = 8,
): Decimal {
  return toFinancialDecimal(value).toDecimalPlaces(
    decimals,
    Decimal.ROUND_HALF_UP,
  );
}

/**
 * Formats a monetary value to a canonical string with exact fixed decimal places.
 */
export function formatMoneyString(
  value: Decimal | number | string | null | undefined,
  decimals = 2,
): string {
  return roundMoney(value, decimals).toFixed(decimals);
}

export type DiscountCombinationMode = 'compounded' | 'additive';

export interface CompoundDiscountResult {
  /** Effective total discount percentage applied */
  effectiveDiscountPercentage: number;
  /** Final discounted unit price */
  discountedUnitPrice: number;
  /** Total discount amount per unit */
  discountAmountPerUnit: number;
}

/**
 * Calculates chained multi-tier discounts (e.g. tier discount + group discount + promo discount)
 * using single-stage Decimal precision before final rounding, preventing multi-stage precision loss.
 */
export function calculateCompoundDiscount(
  basePrice: Decimal | number | string,
  discounts: (number | string | Decimal | null | undefined)[],
  mode: DiscountCombinationMode = 'compounded',
): CompoundDiscountResult {
  const basePriceDec = toFinancialDecimal(basePrice);
  if (basePriceDec.lte(0) || !discounts || discounts.length === 0) {
    return {
      effectiveDiscountPercentage: 0,
      discountedUnitPrice: basePriceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      discountAmountPerUnit: 0,
    };
  }

  const validDiscounts = discounts
    .map((d) => toFinancialDecimal(d))
    .filter((d) => d.gt(0));

  if (validDiscounts.length === 0) {
    return {
      effectiveDiscountPercentage: 0,
      discountedUnitPrice: basePriceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      discountAmountPerUnit: 0,
    };
  }

  let effectiveMultiplierDec: Decimal;

  if (mode === 'additive') {
    const totalPercentageDec = validDiscounts.reduce(
      (sum, d) => sum.plus(d),
      new Decimal(0),
    );
    const clampedPercentage = Decimal.min(100, Decimal.max(0, totalPercentageDec));
    effectiveMultiplierDec = new Decimal(1).minus(clampedPercentage.div(100));
  } else {
    // Compounded mode: product of (1 - d_i/100)
    effectiveMultiplierDec = validDiscounts.reduce(
      (mult, d) => {
        const clamped = Decimal.min(100, Decimal.max(0, d));
        return mult.mul(new Decimal(1).minus(clamped.div(100)));
      },
      new Decimal(1),
    );
  }

  const effectiveDiscountPercentage = new Decimal(1)
    .minus(effectiveMultiplierDec)
    .mul(100)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toNumber();

  const discountedUnitPriceDec = basePriceDec
    .mul(effectiveMultiplierDec)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const discountAmountPerUnitDec = basePriceDec
    .minus(discountedUnitPriceDec)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    effectiveDiscountPercentage,
    discountedUnitPrice: discountedUnitPriceDec.toNumber(),
    discountAmountPerUnit: discountAmountPerUnitDec.toNumber(),
  };
}

/**
 * Evaluates whether an outstanding balance exceeds an authorized credit limit,
 * accounting for Decimal precision, currency scale, and tolerance.
 */
export function isCreditLimitExceeded(
  totalOutstanding: Decimal | number | string | null | undefined,
  creditLimit: Decimal | number | string | null | undefined,
  tolerance: Decimal | number | string = '0.001',
): boolean {
  if (creditLimit === null || creditLimit === undefined || creditLimit === '') {
    return false;
  }

  const limitDec = toFinancialDecimal(creditLimit);
  const outstandingDec = toFinancialDecimal(totalOutstanding);
  const toleranceDec = toFinancialDecimal(tolerance);

  if (limitDec.lte(0)) {
    // When credit limit is explicitly 0, any positive outstanding balance exceeds it
    return outstandingDec.gt(toleranceDec);
  }

  // Exceeded if outstanding > (limit + tolerance)
  return outstandingDec.gt(limitDec.plus(toleranceDec));
}

export interface LinePricingInput {
  quantity: number;
  pricePerUnit: number;
  /** Percentage discount, e.g. 10 for 10%.  Defaults to 0. */
  discountPercentage?: number;
  /** Tax rate as a percentage, e.g. 9 for 9% GST.  Defaults to 0. */
  taxRate?: number;
  /** Whether the pricePerUnit is inclusive of tax. Defaults to false. */
  isTaxInclusive?: boolean;
}

export interface LinePricingResult {
  /** Net line amount after discount:  qty × price × (1 − disc/100) */
  amount: number;
  /** Tax on the net amount:  amount × (taxRate / 100) or gross - net */
  tax: number;
  /** Gross total:  amount + tax */
  totalAmount: number;
}

/**
 * Compute the pricing breakdown for a single order / invoice line.
 *
 * This is a **pure function** — no side-effects, no DB calls.
 * All inputs must be resolved before calling (e.g. look up the GST rate
 * from the category, resolve the discount from the customer, etc.).
 */
export function computeLinePrice(input: LinePricingInput): LinePricingResult {
  const qtyDec = new Decimal(input.quantity || 0);
  const priceDec = new Decimal(input.pricePerUnit || 0);
  const rawDisc = input.discountPercentage ?? 0;
  const disc = isNaN(Number(rawDisc)) ? 0 : Math.min(Math.max(Number(rawDisc), 0), 100);
  const discDec = new Decimal(disc);
  const taxRateDec = new Decimal(input.taxRate ?? 0);

  if (input.isTaxInclusive === true) {
    const grossDec = qtyDec
      .mul(priceDec)
      .mul(new Decimal(1).minus(discDec.div(100)))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const divisor = new Decimal(1).plus(taxRateDec.div(100));
    const amountDec = divisor.gt(0)
      ? grossDec.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : grossDec;
    const taxDec = grossDec.minus(amountDec);
    const totalAmountDec = grossDec;

    return {
      amount: amountDec.toNumber(),
      tax: taxDec.toNumber(),
      totalAmount: totalAmountDec.toNumber(),
    };
  }

  const amountDec = qtyDec
    .mul(priceDec)
    .mul(new Decimal(1).minus(discDec.div(100)))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const taxDec = amountDec.mul(taxRateDec.div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalAmountDec = amountDec.plus(taxDec);

  return {
    amount: amountDec.toNumber(),
    tax: taxDec.toNumber(),
    totalAmount: totalAmountDec.toNumber(),
  };
}

/**
 * Convenience wrapper that returns string values rounded to 2 decimal
 * places — matches the DB column types (numeric stored as text).
 */
export function computeLinePriceForStorage(
  input: LinePricingInput,
): { amount: string; tax: string; totalAmount: string } {
  const result = computeLinePrice(input);
  return {
    amount: result.amount.toFixed(2),
    tax: result.tax.toFixed(2),
    totalAmount: result.totalAmount.toFixed(2),
  };
}

export interface OrderTotalsResult {
  /** Sum of net line amounts */
  subtotal: number;
  /** Sum of line taxes */
  totalTax: number;
  /** Gross total: subtotal + totalTax */
  totalAmount: number;
}

/**
 * Compute aggregate order totals from a list of calculated lines.
 * This guarantees consistency between the frontend display and backend reports.
 */
export function computeOrderTotals(
  lines: Array<{ amount: number | string; tax: number | string }>,
): OrderTotalsResult {
  let subtotalDec = new Decimal(0);
  let totalTaxDec = new Decimal(0);

  for (const l of lines) {
    subtotalDec = subtotalDec.plus(l.amount || 0);
    totalTaxDec = totalTaxDec.plus(l.tax || 0);
  }

  const subtotal = subtotalDec.toDecimalPlaces(2).toNumber();
  const totalTax = totalTaxDec.toDecimalPlaces(2).toNumber();
  const totalAmount = subtotalDec.plus(totalTaxDec).toDecimalPlaces(2).toNumber();

  return {
    subtotal,
    totalTax,
    totalAmount,
  };
}

// ---------------------------------------------------------------------------
// Return Credit Summary
// ---------------------------------------------------------------------------

import { RETURN_RESOLUTION } from './state-machines';

export interface ReturnCreditLineInput {
  /** Quantity being returned */
  quantity: number;
  /** Original unit price from the sales order line */
  pricePerUnit: number;
  /** Discount percentage from the original order line. Defaults to 0. */
  discountPercentage?: number;
  /** Tax rate as a percentage, e.g. 10 for 10% GST. Defaults to 0. */
  taxRate?: number;
  /** Restocking / return fee for this line. Defaults to 0. */
  returnFee?: number;
  /** Resolution for this line (e.g. 'refund' or 'replacement') */
  resolution?: string;
}

export interface ReturnCreditSummary {
  /** Sum of net line amounts (after discount, before tax) */
  subtotal: number;
  /** Total tax across all return lines */
  totalTax: number;
  /** Total restocking / return fees across all lines */
  totalFees: number;
  /** Net credit to the customer: subtotal + totalTax − totalFees */
  netCredit: number;
}

/**
 * Compute aggregate credit totals for a sales return.
 *
 * This is a **pure function** — no side-effects, no DB calls.
 * All per-line inputs (price, discount, tax rate, fee) must be resolved
 * before calling.
 *
 * Formula:  netCredit = subtotal + totalTax − totalFees
 *
 * Uses `computeLinePrice` internally so per-line rounding is consistent
 * with invoices and order totals.
 */
export function computeReturnCreditSummary(
  lines: ReturnCreditLineInput[],
): ReturnCreditSummary {
  let subtotalDec = new Decimal(0);
  let totalTaxDec = new Decimal(0);
  let totalFeesDec = new Decimal(0);

  for (const line of lines) {
    const resolution = line.resolution ?? RETURN_RESOLUTION.REFUND;
    const isRefund = resolution === RETURN_RESOLUTION.REFUND;

    if (isRefund) {
      const pricing = computeLinePrice({
        quantity: line.quantity,
        pricePerUnit: line.pricePerUnit,
        discountPercentage: line.discountPercentage,
        taxRate: line.taxRate,
      });
      subtotalDec = subtotalDec.plus(pricing.amount);
      totalTaxDec = totalTaxDec.plus(pricing.tax);
    }

    totalFeesDec = totalFeesDec.plus(line.returnFee ?? 0);
  }

  const subtotal = subtotalDec.toDecimalPlaces(2).toNumber();
  const totalTax = totalTaxDec.toDecimalPlaces(2).toNumber();
  const totalFees = totalFeesDec.toDecimalPlaces(2).toNumber();
  const netCredit = subtotalDec.plus(totalTaxDec).minus(totalFeesDec).toDecimalPlaces(2).toNumber();

  return { subtotal, totalTax, totalFees, netCredit };
}


// ---------------------------------------------------------------------------
// Discount Matrix Resolution
// ---------------------------------------------------------------------------

export interface DiscountRule {
  /** 'customer' = customer-specific rule, 'customer_group' = group-level rule */
  ownerType: 'customer' | 'customer_group';
  /** null = wildcard (applies to all product groups) */
  productGroupId: string | null;
  /** The discount percentage */
  discountPercentage: string | number;
}

/**
 * Resolves the effective discount for a line item using most-specific-wins.
 *
 * Cascade (first match wins):
 *   1. customer × product_group
 *   2. customer_group × product_group
 *   3. customer × wildcard (null product_group)
 *   4. customer_group × wildcard (null product_group)
 *   5. 0%
 *
 * @param rules - All discount_matrix rows relevant to this customer + customer group
 * @param productGroupId - The product group of the line item (null if product has no group)
 */
export function resolveEffectiveDiscount(
  rules: DiscountRule[],
  productGroupId: string | null,
): string {
  const parse = (val: unknown): number => {
    if (val == null || val === '') return 0;
    const parsed = Number(val);
    if (isNaN(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), 100);
  };

  // Priority 1: customer × specific product group
  if (productGroupId) {
    const match = rules.find(
      r => r.ownerType === 'customer' && r.productGroupId === productGroupId,
    );
    if (match) return parse(match.discountPercentage).toString();
  }

  // Priority 2: customer_group × specific product group
  if (productGroupId) {
    const match = rules.find(
      r => r.ownerType === 'customer_group' && r.productGroupId === productGroupId,
    );
    if (match) return parse(match.discountPercentage).toString();
  }

  // Priority 3: customer × wildcard
  const customerWildcard = rules.find(
    r => r.ownerType === 'customer' && r.productGroupId === null,
  );
  if (customerWildcard) return parse(customerWildcard.discountPercentage).toString();

  // Priority 4: customer_group × wildcard
  const groupWildcard = rules.find(
    r => r.ownerType === 'customer_group' && r.productGroupId === null,
  );
  if (groupWildcard) return parse(groupWildcard.discountPercentage).toString();

  // Priority 5: no discount
  return '0';
}

// ---------------------------------------------------------------------------
// Tax Category Label Formatting
// ---------------------------------------------------------------------------

export interface TaxCategoryLabelInput {
  title?: string | null;
  code?: string | null;
  rate?: string | number | null;
}

/**
 * Standardised tax category label formatter for dropdowns and detail displays.
 * Format: `Title (Rate%)` e.g. "GST Standard (10%)" or "Zero Rated (0%)"
 */
export function getTaxLabel(category?: TaxCategoryLabelInput | null): string {
  if (!category) return '—';
  const rateDec = new Decimal(category.rate || '0');
  const pct = rateDec.isNaN() ? 0 : rateDec.toNumber();
  const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
  const title = category.title || category.code || 'Tax Category';
  return `${title} (${formattedPct}%)`;
}

// ---------------------------------------------------------------------------
// Proration & Remainder Absorption (Largest Remainder Method / Hare-Niemeyer)
// ---------------------------------------------------------------------------

export interface ProrationTarget<T> {
  item: T;
  weight: Decimal | number | string;
}

export interface ProrationResult<T> {
  item: T;
  allocatedAmount: Decimal;
  allocatedString: string;
}

/**
 * Distributes a lump-sum amount across line items using the Largest Remainder Method (Hare-Niemeyer).
 * Guarantees that: Sum(allocatedAmount) === totalAmount down to the last cent.
 */
export function distributeLumpSum<T>(
  totalAmount: Decimal | number | string,
  targets: ProrationTarget<T>[],
  decimals = 2,
): ProrationResult<T>[] {
  const totalDec = new Decimal(totalAmount || 0);
  if (targets.length === 0) return [];
  if (targets.length === 1) {
    return [
      {
        item: targets[0].item,
        allocatedAmount: totalDec,
        allocatedString: totalDec.toFixed(decimals),
      },
    ];
  }

  const weights = targets.map((t) => new Decimal(t.weight || 0));
  const totalWeight = weights.reduce((acc, w) => acc.plus(w), new Decimal(0));

  // If total weight is zero, distribute evenly across all lines
  const effectiveWeights = totalWeight.isZero()
    ? targets.map(() => new Decimal(1))
    : weights;
  const effectiveTotalWeight = totalWeight.isZero()
    ? new Decimal(targets.length)
    : totalWeight;

  const multiplier = new Decimal(10).pow(decimals);

  // Step 1 & 2: Calculate floored units and remainders
  const allocations = targets.map((target, idx) => {
    const weight = effectiveWeights[idx];
    const exactAlloc = totalDec.mul(weight).div(effectiveTotalWeight);
    const scaled = exactAlloc.mul(multiplier);
    const flooredUnits = scaled.floor();
    const remainder = scaled.minus(flooredUnits);

    return {
      index: idx,
      item: target.item,
      flooredUnits,
      remainder,
    };
  });

  // Step 3: Compute remaining units (cents) to allocate
  const sumFloored = allocations.reduce(
    (acc, a) => acc.plus(a.flooredUnits),
    new Decimal(0),
  );
  const totalUnits = totalDec.mul(multiplier).round();
  let remainingUnits = totalUnits.minus(sumFloored).toNumber();

  // Step 4: Sort indices by remainder descending (largest remainder gets extra cent)
  const sortedByRemainder = [...allocations].sort((a, b) => {
    const cmp = b.remainder.comparedTo(a.remainder);
    return cmp !== 0 ? cmp : a.index - b.index; // Stable tie-breaker
  });

  // Step 5: Distribute +1 cent to largest remainders
  const finalUnitsMap = new Map<number, Decimal>();
  for (const entry of sortedByRemainder) {
    let units = entry.flooredUnits;
    if (remainingUnits > 0) {
      units = units.plus(1);
      remainingUnits--;
    } else if (remainingUnits < 0) {
      units = units.minus(1);
      remainingUnits++;
    }
    finalUnitsMap.set(entry.index, units);
  }

  // Step 6: Format result matching original input order
  return targets.map((target, idx) => {
    const units = finalUnitsMap.get(idx)!;
    const finalAlloc = units.div(multiplier);
    return {
      item: target.item,
      allocatedAmount: finalAlloc,
      allocatedString: finalAlloc.toFixed(decimals),
    };
  });
}

/**
 * Convenience wrapper for distributing a total amount pro-rata across weighted targets.
 */
export function distributeProRata<T>(
  totalAmount: Decimal | number | string,
  targets: ProrationTarget<T>[],
  decimals = 2,
): ProrationResult<T>[] {
  return distributeLumpSum(totalAmount, targets, decimals);
}


