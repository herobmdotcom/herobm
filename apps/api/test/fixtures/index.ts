import { PgliteDatabase } from 'drizzle-orm/pglite';
import { v4 as uuidv4 } from 'uuid';
import {
  accounts,
  products,
  salesOrders,
  salesOrderLineItems,
  salesOrderReturns,
  salesOrderReturnLines,
} from '../../src/drizzle/modbm-core-schema';
import { SalesOrderState, ReturnState } from '@modbm/shared';

// Ensures random order numbers during test isolation
let _sequence = 0;

export async function createTestCustomer(db: PgliteDatabase<any>, opts?: { name?: string }) {
  const accountId = uuidv4();
  await db.insert(accounts).values({
    accountId,
    accountNumber: `CUST-TEST-${++_sequence}`,
    name: opts?.name || 'Test Customer',
    currencyCode: 'AUD',
  });
  return { accountId };
}

export async function createTestProduct(db: PgliteDatabase<any>, opts?: { type?: 'inventory' | 'non-stock', name?: string }) {
  const productId = uuidv4();
  await db.insert(products).values({
    productId,
    productNumber: `PROD-TEST-${++_sequence}`,
    name: opts?.name || 'Test Product',
    productType: opts?.type || 'inventory',
    baseUom: 'EA',
  });
  return { productId };
}

export async function createTestSalesOrder(
  db: PgliteDatabase<any>,
  opts: {
    customerId: string;
    locationId: string;
    state?: SalesOrderState;
  }
) {
  const salesOrderId = uuidv4();
  const orderNumber = `ORD-TEST-${++_sequence}`;
  
  await db.insert(salesOrders).values({
    salesOrderId,
    orderNumber,
    customerId: opts.customerId,
    fulfillmentLocationId: opts.locationId,
    stateCode: opts.state || 'draft',
    currencyCode: 'AUD',
    source: 'app',
  });

  return { salesOrderId, orderNumber };
}

export async function createTestSalesOrderLine(
  db: PgliteDatabase<any>,
  opts: {
    salesOrderId: string;
    productId: string;
    taxCategoryId: string;
    quantity: number;
    price: number;
    lineNumber?: number;
  }
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
    fulfillmentLocationId: '10000000-0000-0000-0000-000000000001', // Should ideally be passed in
    taxCategoryId: opts.taxCategoryId,
  });

  return { salesOrderLineId };
}

export async function createTestReturn(
  db: PgliteDatabase<any>,
  opts: {
    salesOrderId: string;
    state?: ReturnState;
  }
) {
  const returnId = uuidv4();
  const returnNumber = `RET-TEST-${++_sequence}`;

  await db.insert(salesOrderReturns).values({
    returnId,
    returnNumber,
    salesOrderId: opts.salesOrderId,
    stateCode: opts.state || 'draft',
  });

  return { returnId, returnNumber };
}

export async function createTestReturnLine(
  db: PgliteDatabase<any>,
  opts: {
    returnId: string;
    salesOrderLineId: string;
    quantity: number;
    returnFee?: number;
  }
) {
  const returnLineId = uuidv4();

  await db.insert(salesOrderReturnLines).values({
    returnLineId,
    returnId: opts.returnId,
    salesOrderLineId: opts.salesOrderLineId,
    quantityReturned: opts.quantity.toString(),
    returnFee: (opts.returnFee || 0).toString(),
    reason: 'Defective',
  });

  return { returnLineId };
}
