/**
 * @module order-math.utils
 * Centralized, pure mathematical logic for calculating permitted quantities
 * across the fulfillment, invoicing, and return lifecycles.
 */

import Decimal from 'decimal.js';

/**
 * Calculates the maximum quantity that can still be invoiced for a sales order line.
 *
 * Invoicing is capped by what has been shipped, minus what has already been
 * billed, minus anything the customer returned for a refund (since we don't bill
 * for items they didn't keep).
 *
 * Note: Replacements are handled via zero-dollar orders and do not reduce the
 * invoiceable amount on the original order.
 */
export function getAvailableToInvoice(
  shippedQty: number,
  invoicedQty: number,
  refundedQty: number,
): number {
  return Math.max(
    0,
    new Decimal(shippedQty).minus(invoicedQty).minus(refundedQty).toNumber(),
  );
}

/**
 * Calculates the exact quantity that needs to be issued as a financial Credit Note.
 *
 * The system only owes a credit note if the customer has been billed for more
 * items than they ended up keeping.
 *
 * Kept = Shipped - Refunded
 * Overbilled = Invoiced - Kept
 *
 * @returns The quantity that should be placed on a new Credit Note right now.
 */
export function getAvailableToCredit(
  shippedQty: number,
  invoicedQty: number,
  refundedQty: number,
  previouslyCreditedQty: number,
): number {
  const keptQty = Math.max(
    0,
    new Decimal(shippedQty).minus(refundedQty).toNumber(),
  );

  // The total amount the customer has been billed for that they did not keep
  const requiredCreditQty = Math.max(
    0,
    new Decimal(invoicedQty).minus(keptQty).toNumber(),
  );

  // The amount we STILL owe them, after subtracting previous credit notes
  const pendingCredit = Math.max(
    0,
    new Decimal(requiredCreditQty).minus(previouslyCreditedQty).toNumber(),
  );

  return pendingCredit;
}
