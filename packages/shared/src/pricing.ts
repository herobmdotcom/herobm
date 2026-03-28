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
