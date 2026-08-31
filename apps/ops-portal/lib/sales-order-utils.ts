import type { OrderLine, SalesInvoice, OrderReturn } from '@/app/sales-orders/[id]/types';
import { isStockedProductLine } from '@herobm/shared';

/**
 * A picking line summary — shape mirrors the API response.
 */
export interface PickingLine {
    salesOrderLineId: string;
    quantityShipped?: string | null;
    quantityPicked?: string | null;
}

/**
 * Result for each order line's invoiceable quantity.
 */
export interface InvoiceableQty {
    salesOrderLineId: string;
    /** Maximum quantity that can be invoiced (shipped or ordered − already invoiced, clamped ≥ 0). */
    maxQty: number;
    /** Default quantity to pre-fill (equals maxQty when > 0, else ''). */
    defaultQty: string;
}

/**
 * Calculate how many units of each order line can still be invoiced.
 *
 *   For stocked inventory lines: maxQty = max(0, shippedQty − alreadyInvoicedQty − refundedQty)
 *   For non-stock / service / custom lines: maxQty = max(0, orderedQty − alreadyInvoicedQty − refundedQty)
 *
 * Only lines with maxQty > 0 are returned.
 */
export function calculateInvoiceableQuantities(
    orderLines: OrderLine[],
    invoices: SalesInvoice[],
    pickingLines: PickingLine[] | undefined | null,
    returns?: OrderReturn[],
): InvoiceableQty[] {
    return orderLines
        .map((line) => {
            // Sum already-invoiced across all invoices
            const invoicedQty = invoices.reduce((sum, inv) => {
                if (inv.stateCode === 'cancelled') return sum;
                const invLine = inv.lines?.find(
                    (il) => il.salesOrderLineId === line.salesOrderLineId,
                );
                return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
            }, 0);

            // Sum already-refunded across all processed returns
            const refundedQty = (returns || []).reduce((sum, ret) => {
                if (ret.stateCode !== 'processed') return sum;
                const retLine = ret.lines?.find(
                    (rl) => rl.salesOrderLineId === line.salesOrderLineId && rl.resolution === 'refund',
                );
                return sum + (retLine ? parseFloat(retLine.quantityReturned || '0') : 0);
            }, 0);

            const isStocked = isStockedProductLine({
                productId: line.productId,
                productType: line.productType,
            });

            let baseQty: number;
            if (isStocked) {
                // Tracked physical inventory items must be shipped before invoicing
                const pLine = pickingLines?.find(
                    (pl) => pl.salesOrderLineId === line.salesOrderLineId,
                );
                baseQty =
                    pLine && pLine.quantityShipped != null
                        ? parseFloat(pLine.quantityShipped)
                        : 0;
            } else {
                // Non-stock, service, and custom lines do not require picking/shipping
                baseQty = parseFloat(line.quantity || '0');
            }

            const maxQty = Math.max(0, baseQty - invoicedQty - refundedQty);

            return {
                salesOrderLineId: line.salesOrderLineId,
                maxQty,
                defaultQty: maxQty > 0 ? String(maxQty) : '',
            };
        })
        .filter((l) => l.maxQty > 0);
}

/**
 * Convert a return fee between absolute and percentage modes.
 *
 * @param currentFee  The current fee value (string, e.g. '10.00' or '5.5').
 * @param originalAmount  The original line amount used as the 100% base.
 * @param from  Current mode.
 * @param to  Target mode.
 * @returns The converted fee as a string.
 */
export function convertFeeMode(
    currentFee: string,
    originalAmount: number,
    from: 'absolute' | 'percentage',
    to: 'absolute' | 'percentage',
): string {
    if (from === to) return currentFee;

    const value = parseFloat(currentFee || '0');

    if (from === 'absolute' && to === 'percentage') {
        // absolute → percentage
        return originalAmount > 0
            ? ((value / originalAmount) * 100).toFixed(1)
            : '0';
    }

    // percentage → absolute
    return ((originalAmount * value) / 100).toFixed(2);
}
