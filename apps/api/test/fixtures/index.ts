import { randomUUID as uuidv4 } from 'crypto';
import {
  customers,
  products,
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
  salesOrderShipments,
  salesOrderShipmentLines,
  purchaseOrders,
  purchaseOrderLineItems,
  glJournalEntries,
  salesInvoices,
  uomDictionary,
  actors,
} from '../../src/drizzle/schema';
import {
  SalesOrderState,
  ReturnState,
  PurchaseOrderState,
  SalesInvoiceState,
  ShipmentState,
  SALES_ORDER_STATE,
  RETURN_STATE,
  PURCHASE_ORDER_STATE,
  SALES_INVOICE_STATE,
  SHIPMENT_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  SUPPLIER_STATE,
} from '@herobm/shared';

// Ensures random order numbers during test isolation
let _sequence = 0;

export async function createTestCustomer(db: any, opts?: { name?: string }) {
  const customerId = uuidv4();
  const name = opts?.name || 'Test Customer';

  const [act] = await db
    .insert(actors)
    .values({
      name,
      country: 'AU',
      isTaxRegistered: false,
    })
    .returning();

  await db.insert(customers).values({
    actorId: act.actorId,
    customerId,
    customerNumber: `CUST-TEST-${++_sequence}`,
    currencyCode: 'AUD', // fixture
    stateCode: CUSTOMER_STATE.ACTIVE,
    source: 'app',
    createdBy: 'system',
  });
  return { customerId };
}

export async function createTestProduct(
  db: any,
  opts?: {
    type?: 'inventory' | 'non-stock' | 'service' | 'kit';
    productType?: 'inventory' | 'non-stock' | 'service' | 'kit';
    structureType?: 'standard' | 'kit';
    name?: string;
    standardCost?: string;
    weightedAverageCost?: string;
    listPrice?: string;
    salesTaxCategoryId?: string;
  },
) {
  const productId = uuidv4();
  const resolvedProductType = opts?.productType || opts?.type || 'inventory';
  const resolvedStructureType =
    opts?.structureType || (resolvedProductType === 'kit' ? 'kit' : 'standard');
  const finalProductType =
    resolvedProductType === 'kit' ? 'inventory' : resolvedProductType;

  await db.insert(products).values({
    productId,
    productNumber: `PROD-TEST-${++_sequence}`,
    name: opts?.name || 'Test Product',
    productType: finalProductType,
    structureType: resolvedStructureType,
    baseUom: 'EA',
    standardCost: opts?.standardCost || '10.00',
    weightedAverageCost: opts?.weightedAverageCost || '10.00',
    listPrice: opts?.listPrice || '0.00',
    salesTaxCategoryId: opts?.salesTaxCategoryId,
    stateCode: PRODUCT_STATE.ACTIVE,
    source: 'app',
    createdBy: 'system',
  });
  return { productId };
}

export async function createTestSalesOrder(
  db: any,
  opts: {
    customerId: string;
    locationId: string;
    state?: SalesOrderState;
  },
) {
  const salesOrderId = uuidv4();
  const orderNumber = `ORD-TEST-${++_sequence}`;

  await db.insert(salesOrders).values({
    salesOrderId,
    orderNumber,
    customerId: opts.customerId,
    fulfillmentLocationId: opts.locationId,
    stateCode: opts.state || SALES_ORDER_STATE.DRAFT,
    deliveryAddressLine1: 'Test Address 123',
    currencyCode: 'AUD', // fixture
    source: 'app',
    baseTotalAmount: '0',
    exchangeRate: '1',
    discrepanciesAcknowledged: false,
    createdBy: 'system',
  });

  return { salesOrderId, orderNumber };
}

export async function createTestSalesOrderLine(
  db: any,
  opts: {
    salesOrderId: string;
    productId: string;
    taxCategoryId: string;
    quantity: number;
    price: number;
    lineNumber?: number;
  },
) {
  const salesOrderLineId = uuidv4();

  await db.insert(salesOrderLineItems).values({
    salesOrderLineId,
    salesOrderId: opts.salesOrderId,
    lineNumber: opts.lineNumber || 1,
    productId: opts.productId,
    quantity: opts.quantity.toString(),
    pricePerUnit: opts.price.toString(),
    amount: (opts.quantity * opts.price).toString(),
    fulfillmentLocationId: '10000000-0000-4000-8000-000000000001', // Should ideally be passed in
    taxCategoryId: opts.taxCategoryId,
    discountPercentage: '0',
    tax: '0',
    quantityPicked: '0',
    isPostConfirmation: false,
  });

  return { salesOrderLineId };
}

export async function createTestReturn(
  db: any,
  opts: {
    salesOrderId: string;
    state?: ReturnState;
  },
) {
  const returnId = uuidv4();
  const returnNumber = `RET-TEST-${++_sequence}`;

  await db.insert(salesOrderReturns).values({
    returnId,
    returnNumber,
    salesOrderId: opts.salesOrderId,
    stateCode: opts.state || RETURN_STATE.DRAFT,
    createdBy: 'system',
  });

  return { returnId, returnNumber };
}

export async function createTestReturnLine(
  db: any,
  opts: {
    returnId: string;
    salesOrderLineId: string;
    quantity: number;
    returnFee?: number;
  },
) {
  const returnLineId = uuidv4();

  await db.insert(salesOrderReturnLines).values({
    returnLineId,
    returnId: opts.returnId,
    salesOrderLineId: opts.salesOrderLineId,
    quantityReturned: opts.quantity.toString(),
    returnFee: (opts.returnFee || 0).toString(),
    reason: 'Defective',
    resolution: 'refund',
    quantityReceived: '0',
    putawayStatus: 'pending',
  });

  return { returnLineId };
}

export async function createTestSupplier(db: any, opts?: { name?: string }) {
  // Uses the same `customers` table as customers, but conceptually a supplier.
  const customerId = uuidv4();
  const name = opts?.name || 'Test Supplier';

  const [act] = await db
    .insert(actors)
    .values({
      name,
      isTaxRegistered: false,
    })
    .returning();

  await db.insert(customers).values({
    actorId: act.actorId,
    customerId,
    customerNumber: `SUPP-TEST-${++_sequence}`,
    currencyCode: 'AUD', // fixture
    stateCode: SUPPLIER_STATE.ACTIVE,
    source: 'app',
    createdBy: 'system',
  });
  return { customerId };
}

export async function createTestPurchaseOrder(
  db: any,
  opts: {
    supplierId: string;
    locationId: string;
    state?: PurchaseOrderState;
  },
) {
  const purchaseOrderId = uuidv4();
  const orderNumber = `PO-TEST-${++_sequence}`;

  await db.insert(purchaseOrders).values({
    purchaseOrderId,
    orderNumber,
    vendorId: opts.supplierId,
    deliveryLocationId: opts.locationId,
    stateCode: opts.state || PURCHASE_ORDER_STATE.DRAFT,
    currencyCode: 'AUD', // fixture
    baseTotalAmount: '0',
    exchangeRate: '1',
    createdBy: 'system',
  });

  return { purchaseOrderId, orderNumber };
}

export async function createTestGlEntry(
  db: any,
  opts: {
    sourceId: string;
    sourceType: string;
  },
) {
  const journalEntryId = uuidv4();
  const entryNumber = `GL-TEST-${++_sequence}`;

  await db.insert(glJournalEntries).values({
    journalEntryId,
    entryNumber,
    sourceId: opts.sourceId,
    sourceType: opts.sourceType,
    entryDate: new Date().toISOString(),
    isReversed: false,
    createdBy: 'system',
  });

  return { journalEntryId };
}

export async function createTestInvoice(
  db: any,
  opts: {
    salesOrderId: string;
    state?: SalesInvoiceState;
  },
) {
  const invoiceId = uuidv4();
  const invoiceNumber = `INV-TEST-${++_sequence}`;

  await db.insert(salesInvoices).values({
    invoiceId,
    invoiceNumber,
    salesOrderId: opts.salesOrderId,
    stateCode: opts.state || SALES_INVOICE_STATE.DRAFT,
    totalAmount: '100.00',
    currencyCode: 'AUD', // fixture
    outstandingAmount: '0',
    taxAmount: '0',
    baseTotalAmount: '0',
    baseOutstandingAmount: '0',
    exchangeRate: '1',
    createdBy: 'system',
  });

  return { invoiceId };
}

export async function createTestShipment(
  db: any,
  opts: {
    salesOrderId: string;
    locationId?: string;
    state?: ShipmentState;
  },
) {
  const shipmentId = uuidv4();
  const shipmentNumber = `SHP-TEST-${++_sequence}`;

  await db.insert(salesOrderShipments).values({
    shipmentId,
    shipmentNumber,
    salesOrderId: opts.salesOrderId,
    stateCode: opts.state || SHIPMENT_STATE.DISPATCHED,
    fulfillmentLocationId:
      opts.locationId || '10000000-0000-4000-8000-000000000001',
    createdBy: 'system',
  });

  return { shipmentId, shipmentNumber };
}

export async function createTestShipmentLine(
  db: any,
  opts: {
    shipmentId: string;
    salesOrderLineId: string;
    quantityShipped: number;
  },
) {
  const shipmentLineId = uuidv4();

  await db.insert(salesOrderShipmentLines).values({
    shipmentLineId,
    shipmentId: opts.shipmentId,
    salesOrderLineId: opts.salesOrderLineId,
    quantityShipped: opts.quantityShipped.toString(),
  });

  return { shipmentLineId };
}
