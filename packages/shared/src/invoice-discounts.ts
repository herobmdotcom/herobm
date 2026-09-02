export interface CalculateEarlyPaymentDiscountInput {
  invoiceDate: Date | string;
  outstandingAmount: string | number;
  earlyPaymentDiscount: string | number | null;
  earlyPaymentDiscountDays: number | null;
  /** The date to calculate eligibility against. Defaults to current date if omitted. */
  currentDate?: Date | string;
}

export interface EarlyPaymentDiscountResult {
  /** Whether the invoice is currently eligible for the discount based on the dates. */
  isEligible: boolean;
  /** The calculated monetary amount of the discount. */
  discountAmount: number;
  /** The percentage of the discount. */
  discountPercentage: number;
  /** The final date the discount is eligible until. */
  eligibleUntil: Date | null;
}

/**
 * Centralised logic for calculating the applicable early payment discount
 * for a given invoice at a specific date.
 */
export function calculateEarlyPaymentDiscount(
  input: CalculateEarlyPaymentDiscountInput,
): EarlyPaymentDiscountResult {
  const discountStr = String(input.earlyPaymentDiscount || '0');
  const discountPercentage = parseFloat(discountStr);

  if (
    discountPercentage <= 0 ||
    input.earlyPaymentDiscountDays === null ||
    input.earlyPaymentDiscountDays === undefined
  ) {
    return {
      isEligible: false,
      discountAmount: 0,
      discountPercentage: 0,
      eligibleUntil: null,
    };
  }


  if (isNaN(discountPercentage) || discountPercentage <= 0) {
    return {
      isEligible: false,
      discountAmount: 0,
      discountPercentage: 0,
      eligibleUntil: null,
    };
  }

  const invoiceDate = typeof input.invoiceDate === 'string' ? new Date(input.invoiceDate) : input.invoiceDate;
  const currentDate = input.currentDate 
    ? (typeof input.currentDate === 'string' ? new Date(input.currentDate) : input.currentDate)
    : new Date();

  // Strip time components for accurate day comparison
  const invoiceDay = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
  const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const eligibleUntil = new Date(invoiceDay.getTime());
  eligibleUntil.setDate(eligibleUntil.getDate() + input.earlyPaymentDiscountDays);

  const isEligible = currentDay.getTime() <= eligibleUntil.getTime();

  const outstanding = typeof input.outstandingAmount === 'string'
    ? parseFloat(input.outstandingAmount)
    : input.outstandingAmount;

  // Discount applies to the outstanding balance
  // E.g., $100.00 outstanding with 2% discount = $2.00
  const discountAmount = isNaN(outstanding) ? 0 : (outstanding * discountPercentage) / 100;

  return {
    isEligible,
    // Round to 2 decimal places to prevent floating point issues
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountPercentage,
    eligibleUntil,
  };
}
