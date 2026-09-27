import { Decimal } from 'decimal.js';
import { parseLocalDate } from './date';

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
  const discountPercentage = new Decimal(discountStr || 0).toNumber();

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

  const invoiceDate = parseLocalDate(input.invoiceDate) || new Date();
  const currentDate = parseLocalDate(input.currentDate) || new Date();

  // Strip time components for accurate day comparison
  const invoiceDay = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());
  const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const eligibleUntil = new Date(invoiceDay.getTime());
  eligibleUntil.setDate(eligibleUntil.getDate() + input.earlyPaymentDiscountDays);

  const isEligible = currentDay.getTime() <= eligibleUntil.getTime();

  const outstandingDec = new Decimal(input.outstandingAmount || 0);
  const discountAmountDec = outstandingDec.isNaN()
    ? new Decimal(0)
    : outstandingDec.mul(discountPercentage).div(100).toDecimalPlaces(2);

  return {
    isEligible,
    discountAmount: discountAmountDec.toNumber(),
    discountPercentage,
    eligibleUntil,
  };
}
