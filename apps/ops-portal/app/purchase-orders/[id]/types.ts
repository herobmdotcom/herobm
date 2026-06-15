import type { ProductUom } from '@herobm/shared';

export interface OrderLine {
  purchaseOrderLineId: string;
  lineNumber: number;
  productId: string;
  productNumber?: string;
  productDescription: string;
  quantity: string;
  quantityReceived?: string;
  pricePerUnit: string;
  discountPercentage: string;
  amount: string;
  taxCategoryId: string | null;
  tax: string;
  totalAmount: string;
  unitOfMeasure: string;
  baseUom?: string;
  productUoms?: ProductUom[];
}

export interface Allocation {
  id: string;
  salesOrderId: string;
  orderNumber: string | null;
  productId: string;
  productName: string | null;
  quantity: string;
  createdOn: string;
  purchaseOrderLineId: string | null;
}

export interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

export interface OrderEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actor: string;
  createdOn: string;
}

export interface OrderDetail {
  purchaseOrderId: string;
  orderNumber: string;
  name: string | null;
  vendorId: string | null;
  vendorName?: string | null;
  referenceNumber: string | null;
  stateCode: string;
  currencyCode: string;
  taxCategoryId: string | null;
  deliveryLocationId?: string | null;
  locationName?: string | null;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  expectedDate?: string | null;

  lines: OrderLine[];
  events: OrderEvent[];
}

export interface InventoryLevel {
  inventoryLevelId: string;
  productId: string;
  productNumber: string;
  productName: string;
  locationNo: string;
  locationName: string;
  quantityOnHand: string;
  quantityCommitted: string;
  quantityOnOrder: string;
  quantityAvailable: string;
  quantityReserved: string;
}

export interface ReturnLine {
  returnLineId: string;
  purchaseOrderLineId: string;
  quantityReturned: string;
  reason: string | null;
  returnFee: string;
}

export interface OrderReturn {
  returnId: string;
  returnNumber: string;
  purchaseOrderId: string;
  stateCode: string;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  lines: ReturnLine[];
}



export function getTaxLabel(category: TaxCategory) {
  if (category.type === 'exempt') return 'Exempt';
  if (category.type === 'zero_rated') return 'Zero Rated';
  const pct = parseFloat(category.rate || '0');
  const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
  return `${formattedPct}% GST`;
}
