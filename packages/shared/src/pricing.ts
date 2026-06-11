/**
 * Centralised line-pricing logic.
 *
 * Every place in the system that needs to price an order/invoice line
 * MUST call this function rather than reimplementing the formula.
 */

export interface LinePricingInput {
  quantity: number;
  pricePerUnit: number;
  /** Percentage discount, e.g. 10 for 10%.  Defaults to 0. */
  discountPercentage?: number;
  /** Tax rate as a percentage, e.g. 9 for 9% GST.  Defaults to 0. */
  taxRate?: number;
}

export interface LinePricingResult {
  /** Net line amount after discount:  qty × price × (1 − disc/100) */
  amount: number;
  /** Tax on the net amount:  amount × (taxRate / 100) */
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
  const qty = input.quantity;
  const price = input.pricePerUnit;
  const disc = input.discountPercentage ?? 0;
  const taxRate = input.taxRate ?? 0;

  const rawAmount = qty * price * (1 - disc / 100);
  const rawTax = rawAmount * (taxRate / 100);

  const amount = Number(Math.round(Number(rawAmount + 'e2')) + 'e-2');
  const tax = Number(Math.round(Number(rawTax + 'e2')) + 'e-2');

  return {
    amount,
    tax,
    totalAmount: amount + tax,
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
  const subtotalRaw = lines.reduce(
    (sum, l) => sum + Number(l.amount || 0),
    0,
  );
  const totalTaxRaw = lines.reduce(
    (sum, l) => sum + Number(l.tax || 0),
    0,
  );
  const totalAmountRaw = subtotalRaw + totalTaxRaw;

  return {
    subtotal: Number(Math.round(Number(subtotalRaw + 'e2')) + 'e-2'),
    totalTax: Number(Math.round(Number(totalTaxRaw + 'e2')) + 'e-2'),
    totalAmount: Number(Math.round(Number(totalAmountRaw + 'e2')) + 'e-2'),
  };
}

// ---------------------------------------------------------------------------
// Return Credit Summary
// ---------------------------------------------------------------------------

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
  let subtotalRaw = 0;
  let totalTaxRaw = 0;
  let totalFeesRaw = 0;

  for (const line of lines) {
    const pricing = computeLinePrice({
      quantity: line.quantity,
      pricePerUnit: line.pricePerUnit,
      discountPercentage: line.discountPercentage,
      taxRate: line.taxRate,
    });
    subtotalRaw += pricing.amount;
    totalTaxRaw += pricing.tax;
    totalFeesRaw += line.returnFee ?? 0;
  }

  const subtotal = Number(Math.round(Number(subtotalRaw + 'e2')) + 'e-2');
  const totalTax = Number(Math.round(Number(totalTaxRaw + 'e2')) + 'e-2');
  const totalFees = Number(Math.round(Number(totalFeesRaw + 'e2')) + 'e-2');
  const netCredit = Number(
    Math.round(Number((subtotal + totalTax - totalFees) + 'e2')) + 'e-2',
  );

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
    return isNaN(parsed) ? 0 : parsed;
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
