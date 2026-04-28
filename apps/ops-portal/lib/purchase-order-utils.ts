import type { OrderLine } from '@/app/purchase-orders/[id]/types';

export interface PurchaseInvoice {
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: string;
    taxAmount: string;
    currencyCode: string;
    stateCode: string;
    createdOn: string;
    createdBy?: string;
    lines?: PurchaseInvoiceLine[];
}

export interface PurchaseInvoiceLine {
    invoiceLineId: string;
    purchaseOrderLineId: string;
    quantityInvoiced: string;
    pricePerUnit: string;
    amount: string;
    goodsReceivedLineId?: string | null;
    quantityBilled?: string;
}

export interface PurchaseInvoiceableQty {
    purchaseOrderLineId: string;
    /** Maximum quantity that can be invoiced (received - already invoiced, clamped ≥ 0) */
    maxQty: number;
    /** Default quantity to pre-fill (equals maxQty when > 0, else '') */
    defaultQty: string;
}

/**
 * Calculate how many units of each order line can still be invoiced.
 * 
 *   maxQty = max(0, receivedQty - alreadyInvoicedQty)
 * 
 * Only lines with maxQty > 0 are returned.
 */
export function calculatePurchaseInvoiceableQuantities(
    orderLines: OrderLine[],
    invoices: PurchaseInvoice[]
): PurchaseInvoiceableQty[] {
    return orderLines
        .map((line) => {
            // Sum already-invoiced across all invoices
            const invoicedQty = invoices.reduce((sum, inv) => {
                const invLine = inv.lines?.find(
                    (il) => il.purchaseOrderLineId === line.purchaseOrderLineId
                );
                return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
            }, 0);

            // Purchase Order schema aggregates received quantity natively
            const receivedQty = parseFloat(line.quantityReceived || '0');

            const maxQty = Math.max(0, receivedQty - invoicedQty);

            return {
                purchaseOrderLineId: line.purchaseOrderLineId,
                maxQty,
                defaultQty: maxQty > 0 ? String(maxQty) : '',
            };
        })
        .filter((l) => l.maxQty > 0);
}
