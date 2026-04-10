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
    gstCategoryId: string | null;
    tax: string;
    totalAmount: string;
    unitOfMeasure: string;
    baseUom?: string;
    productUoms?: import('@modbm/shared').ProductUom[];
    fulfillmentLocationId?: string | null;
    isPostConfirmation?: boolean | null;
}

export interface GstCategory {
    gstCategoryId: string;
    code: string;
    title: string;
    type: string;
    rate: string;
    isDefault: boolean;
}

export function getGstLabel(category: GstCategory) {
    const pct = parseFloat(category.rate || '0');
    const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
    return `${category.title} (${formattedPct}%)`;
}

export interface OrderEvent {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
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
    currencyCode: string;
    notes: string | null;
    createdBy: string | null;
    createdOn: string;
    modifiedOn: string;
    lines: OrderLine[];
    events: OrderEvent[];
    parentId?: string | null;
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
    createdOn: string;
    createdBy: string;
    lines?: InvoiceLine[];
}
