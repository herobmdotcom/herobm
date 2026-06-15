export interface OrderLine {
    salesOrderLineId: string;
    lineNumber: number;
    productId: string;
    productNumber?: string;
    productType?: string;
    productDescription: string;
    quantity: string;
    pricePerUnit: string;
    discountPercentage: string;
    amount: string;
    taxCategoryId: string | null;
    tax: string;
    totalAmount: string;
    unitOfMeasure: string;
    baseUom?: string;
    productUoms?: import('@herobm/shared').ProductUom[];
    fulfillmentLocationId?: string | null;
    isPostConfirmation?: boolean | null;
}

export interface TaxCategory {
    taxCategoryId: string;
    code: string;
    title: string;
    type: string;
    rate: string;
    isDefault: boolean;
}

export function getTaxLabel(category: TaxCategory) {
    const pct = parseFloat(category.rate || '0');
    const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
    return `${category.title} (${formattedPct}%)`;
}

export interface OrderEvent {
    eventId: string;
    eventType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
    actor: string;
    createdOn: string;
}

export interface OrderDetail {
    salesOrderId: string | null;
    orderNumber: string;
    name: string | null;
    customerId: string | null;
    customerName: string | null;
    customerOrderNumber: string | null;
    fulfillmentLocationId?: string | null;
    stateCode: string;
    taxProvider?: string | null;
    currencyCode: string;
    notes: string | null;
    discrepanciesAcknowledged?: boolean;
    shippingNotes?: string | null;
    deliveryName?: string | null;
    deliveryPhone?: string | null;
    deliveryAddressLine1?: string | null;
    deliveryAddressLine2?: string | null;
    deliveryCity?: string | null;
    deliveryState?: string | null;
    deliveryPostalCode?: string | null;
    deliveryCountry?: string | null;
    createdBy: string | null;
    createdOn: string;
    modifiedOn: string;
    lines: OrderLine[];
    events: OrderEvent[];
    parentId?: string | null;
    customFields?: Record<string, unknown>;
    backorders?: {
        productId?: string;
        productNumber?: string;
        quantity?: string;
        stateCode: string;
        purchaseOrderId?: string;
        purchaseOrderNumber?: string;
        salesOrderId?: string;
        orderNumber?: string;
        name?: string;
        createdOn: string;
    }[];
}

export interface InventoryLevel {
    inventoryLevelId: string;
    productId: string;
    productNumber: string;
    productName: string;
    locationId: string;
    locationNo: string;
    locationName: string;
    quantityOnHand: string;
    quantityCommitted: string;
    quantityOnOrder: string;
    quantityAvailable: string;
    availableQuantity?: string | number; // For compatibility with shared utility
    quantityReserved: string;
}

export interface ReturnLine {
    returnLineId: string;
    salesOrderLineId: string;
    quantityReturned: string;
    reason: string | null;
    returnFee: string;
}

export interface OrderReturn {
    returnId: string;
    returnNumber: string;
    salesOrderId: string;
    stateCode: string;
    notes: string | null;
    createdBy: string | null;
    createdOn: string;
    modifiedOn: string;
    lines: ReturnLine[];
    creditNoteNumber?: string | null;
}

export interface CreditNoteLine {
    creditNoteLineId: string;
    creditNoteId: string;
    salesOrderLineId: string;
    quantityCredited: string;
    pricePerUnit: string;
    amount: string;
    taxAmount: string;
}

export interface CreditNote {
    creditNoteId: string;
    creditNoteNumber: string;
    returnId: string;
    salesOrderId: string;
    invoiceId: string | null;
    totalAmount: string;
    taxAmount: string;
    feeAmount: string;
    outstandingAmount: string;
    currencyCode: string;
    stateCode: string;
    notes: string | null;
    createdBy: string | null;
    createdOn: string;
    modifiedOn: string;
    lines?: CreditNoteLine[];
}

export interface InvoiceLine {
    lineId: string;
    salesOrderLineId: string;
    quantityInvoiced: string;
    pricePerUnit?: string;
    amount?: string;
    invoiceLineId?: string;
}

export interface SalesInvoice {
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: string;
    taxAmount: string;
    stateCode?: string;
    createdOn: string;
    createdBy: string;
    lines?: InvoiceLine[];
}
