import type { OrderLine, SalesInvoice } from '@/app/sales-orders/[id]/types';

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
    /** Maximum quantity that can be invoiced (shipped − already invoiced, clamped ≥ 0). */
    maxQty: number;
    /** Default quantity to pre-fill (equals maxQty when > 0, else ''). */
    defaultQty: string;
}

/**
 * Calculate how many units of each order line can still be invoiced.
 *
 *   maxQty = max(0, shippedQty − alreadyInvoicedQty)
 *
 * Only lines with maxQty > 0 are returned.
 */
export function calculateInvoiceableQuantities(
    orderLines: OrderLine[],
    invoices: SalesInvoice[],
    pickingLines: PickingLine[] | undefined | null,
): InvoiceableQty[] {
    return orderLines
        .map((line) => {
            // Sum already-invoiced across all invoices
            const invoicedQty = invoices.reduce((sum, inv) => {
                const invLine = inv.lines?.find(
                    (il) => il.salesOrderLineId === line.salesOrderLineId,
                );
                return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
            }, 0);

            // Find shipped from picking
            const pLine = pickingLines?.find(
                (pl) => pl.salesOrderLineId === line.salesOrderLineId,
            );
            const shippedQty =
                pLine && pLine.quantityShipped != null
                    ? parseFloat(pLine.quantityShipped)
                    : 0;

            const maxQty = Math.max(0, shippedQty - invoicedQty);

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
