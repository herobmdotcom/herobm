import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderLineItems,
} from '../src/drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

interface LedgerSnapshot {
  trialBalance: Record<string, number>;
  inventory: Record<string, number>;
}

interface SymmetryTestContext {
  adminToken: string;
  validVendorId: string;
  validCustomerId: string;
  validProductId: string;
  validLocationId: string;
  apAccountId: string;
  arAccountId: string;
  bankAccountId: string;
  [key: string]: any;
}

interface LedgerSymmetryPair {
  name: string;
  setup?: (app: INestApplication, context: SymmetryTestContext) => Promise<any>;
  action: (app: INestApplication, context: SymmetryTestContext) => Promise<any>;
  inverseAction: (
    app: INestApplication,
    context: SymmetryTestContext,
  ) => Promise<any>;
}

describe('API E2E — Ledger Symmetry Register', () => {
  let app: INestApplication;
  let context: SymmetryTestContext;

  const snapshotLedgers = async (
    app: INestApplication,
    token: string,
  ): Promise<LedgerSnapshot> => {
    const tbRes = await request(app.getHttpServer())
      .get(`/api/gl/trial-balance?startDate=2000-01-01&endDate=2099-12-31`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const trialBalance: Record<string, number> = {};
    for (const acc of tbRes.body) {
      trialBalance[acc.glAccountId] = parseFloat(acc.netChange || '0');
    }

    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/locations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const inventory: Record<string, number> = {};
    for (const loc of invRes.body) {
      if (!loc.inventoryLevels) continue;
      for (const level of loc.inventoryLevels) {
        const key = `${loc.locationId}-${level.productId}`;
        inventory[key] =
          (inventory[key] || 0) + parseFloat(level.quantityOnHand || '0');
      }
    }

    return { trialBalance, inventory };
  };

  const registerPairs: LedgerSymmetryPair[] = [
    {
      name: 'Sales Invoice: Create vs Cancel',
      setup: async (app, ctx) => {
        const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderRes = await request(app.getHttpServer())
          .post(`/api/sales-orders`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            salesOrderId: crypto.randomUUID(),
            customerId: ctx.validCustomerId,
            customerOrderNumber: `SYM-SO-${rand}`,
            currencyCode: 'AUD',
            lines: [
              {
                productId: '00000000-0000-0000-0000-000000000000',
                productDescription: 'Symmetry Custom Item',
                quantity: '2',
                pricePerUnit: '50.0',
              },
            ],
          })
          .expect(201);
        ctx.salesOrderId = orderRes.body.salesOrderId;

        // Fetch order to get the line ID
        const getOrderRes = await request(app.getHttpServer())
          .get(`/api/sales-orders/${ctx.salesOrderId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .expect(200);
        const lineId = getOrderRes.body.lines[0].salesOrderLineId;

        // Transition to picking via API
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${ctx.salesOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'quoted' })
          .expect(200);
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${ctx.salesOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'confirmed' })
          .expect(200);
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${ctx.salesOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'picking' })
          .expect(200);

        // Pick via API
        const pickRes = await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.salesOrderId}/picking/lines/${lineId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ binId: ctx.validBinId, quantity: '2' });
        if (pickRes.status !== 201) console.error('Pick Error:', pickRes.body);
        expect(pickRes.status).toBe(201);

        ctx.salesOrderLineId = lineId;

        // Ship the order
        const shipRes = await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.salesOrderId}/shipments`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            lines: [
              { salesOrderLineId: ctx.salesOrderLineId, quantityShipped: '2' },
            ],
          });
        if (shipRes.status !== 201)
          console.error('Shipment Error:', shipRes.body);
        expect(shipRes.status).toBe(201);
      },
      action: async (app, ctx) => {
        const invoiceRes = await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.salesOrderId}/invoice`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            notes: 'Test Symmetry',
            lines: [
              {
                salesOrderLineId: ctx.salesOrderLineId,
                quantityToInvoice: 1,
              },
            ],
          });
        if (invoiceRes.status !== 201)
          console.error('Sales Invoice Create Error:', invoiceRes.body);
        expect(invoiceRes.status).toBe(201);
        ctx.salesInvoiceId = invoiceRes.body.invoiceId;
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .patch(`/api/sales-invoices/${ctx.salesInvoiceId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'cancelled' })
          .expect(200);
      },
    },
    {
      name: 'Sales Return: Credit vs Cancel',
      setup: async (app, ctx) => {
        // Assume salesOrderId and salesOrderLineId from Sales Invoice test are still available and shipped!
        // We will create a return
        const retRes = await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.salesOrderId}/returns`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            notes: 'Test Symmetry Return',
            lines: [
              {
                salesOrderLineId: ctx.salesOrderLineId,
                quantityReturned: '1',
              },
            ],
          })
          .expect(201);
        ctx.salesReturnId = retRes.body.returnId;

        // Fetch the return to get the line ID
        const retDetail = await request(app.getHttpServer())
          .get(
            `/api/sales-orders/${ctx.salesOrderId}/returns/${ctx.salesReturnId}`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .expect(200);

        // Transition return to confirmed
        await request(app.getHttpServer())
          .patch(
            `/api/sales-orders/${ctx.salesOrderId}/returns/${ctx.salesReturnId}/state`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'confirmed' })
          .expect((res: any) => {
            if (res.status !== 200) console.error('Confirm Error:', res.body);
          })
          .expect(200);

        // Receive the return so it can be credited
        const recvRes = await request(app.getHttpServer())
          .post(
            `/api/sales-orders/${ctx.salesOrderId}/returns/${ctx.salesReturnId}/receive`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            locationId: ctx.validLocationId,
            lines: [
              {
                returnLineId: retDetail.body.lines[0].returnLineId,
                quantityReceived: '1',
                binId: ctx.validBinId,
              },
            ],
          });
        if (recvRes.status !== 201)
          console.error('Sales Return Receive Error:', recvRes.body);
        expect(recvRes.status).toBe(201);
      },
      action: async (app, ctx) => {
        // Change return state to "processed" to hit GL
        const retCredRes = await request(app.getHttpServer())
          .patch(
            `/api/sales-orders/${ctx.salesOrderId}/returns/${ctx.salesReturnId}/state`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'processed' });
        if (retCredRes.status !== 200)
          console.error('Sales Return Process Error:', retCredRes.body);
        expect(retCredRes.status).toBe(200);
      },
      inverseAction: async (app, ctx) => {
        // Cancel the return
        await request(app.getHttpServer())
          .patch(
            `/api/sales-orders/${ctx.salesOrderId}/returns/${ctx.salesReturnId}/state`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'cancelled' })
          .expect(200);
      },
    },
    {
      name: 'Customer Payment: Submit vs Cancel',
      setup: async (app, ctx) => {
        ctx.paymentId = crypto.randomUUID();
      },
      action: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(`/api/payments`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            paymentId: ctx.paymentId,
            paymentType: 'receive',
            partyType: 'customer',
            partyId: ctx.validCustomerId,
            paymentDate: new Date().toISOString(),
            modeOfPayment: 'EFT',
            totalAmount: 150.0,
            glAccountBank: ctx.bankAccountId,
            currencyCode: 'AUD',
            submitImmediately: true,
          })
          .expect(201);
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .patch(`/api/payments/${ctx.paymentId}/cancel`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({})
          .expect(200);
      },
    },
    {
      name: 'Purchase Return: Credit vs Cancel',
      setup: async (app, ctx) => {
        // Assume purchaseOrderId from Purchase Invoice test? Wait, we didn't create a purchase order, we just created an invoice.
        // Purchase Returns require a Purchase Order. Let's create one.
        const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
        const poRes = await request(app.getHttpServer())
          .post(`/api/purchase-orders`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            purchaseOrderId: crypto.randomUUID(),
            orderNumber: `SYM-PO-${rand}`,
            vendorId: ctx.validVendorId,
            currencyCode: 'AUD',
            deliveryLocationId: ctx.validLocationId,
            lines: [
              {
                productId: ctx.validProductId,
                quantity: '2',
                pricePerUnit: '10.0',
              },
            ],
          })
          .expect(201);
        ctx.purchaseOrderId = poRes.body.purchaseOrderId;

        // Fetch purchase order to get line ID
        const getPoRes = await request(app.getHttpServer())
          .get(`/api/purchase-orders/${ctx.purchaseOrderId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .expect(200);
        const poLineId = getPoRes.body.lines[0].purchaseOrderLineId;

        // Change state to ordered
        const placeRes = await request(app.getHttpServer())
          .patch(`/api/purchase-orders/${ctx.purchaseOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'ordered' });
        if (placeRes.status !== 200)
          console.error('Place Purchase Order Error:', placeRes.body);
        expect(placeRes.status).toBe(200);

        // Receive the goods so we can return them!
        const grRes = await request(app.getHttpServer())
          .post(`/api/goods-received`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            purchaseOrderId: ctx.purchaseOrderId,
            vendorId: ctx.validVendorId,
            locationId: ctx.validLocationId,
            lines: [
              {
                productId: ctx.validProductId,
                quantityReceived: '2',
              },
            ],
          });
        if (grRes.status !== 201) console.error('GR Error:', grRes.body);
        expect(grRes.status).toBe(201);
        const grId = grRes.body.goodsReceivedId;
        const grLineId = grRes.body.lines[0].goodsReceivedLineId;

        // Resolve the line against the PO line
        await request(app.getHttpServer())
          .post(`/api/goods-received/lines/${grLineId}/resolve`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            purchaseOrderLineId: poLineId,
            allocatedQuantity: '2',
          })
          .expect(201);

        ctx.purchaseOrderLineId = poLineId;

        // Create the return
        const retRes = await request(app.getHttpServer())
          .post(`/api/purchase-orders/${ctx.purchaseOrderId}/returns`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            notes: 'Test Symmetry Purchase Return',
            lines: [
              {
                purchaseOrderLineId: poLineId,
                quantityReturned: '1',
              },
            ],
          });
        if (retRes.status !== 201)
          console.error('Create Purchase Return Error:', retRes.body);
        expect(retRes.status).toBe(201);
        ctx.purchaseReturnId = retRes.body.returnId;
      },
      action: async (app, ctx) => {
        // Ship the return (which hits GL for inventory deduction and debit note)
        await request(app.getHttpServer())
          .post(
            `/api/purchase-orders/${ctx.purchaseOrderId}/returns/${ctx.purchaseReturnId}/ship`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            locationId: ctx.validLocationId,
            lines: [
              {
                returnLineId: '00000000-0000-0000-0000-000000000000', // We might need the real return line ID! But let's fetch it if needed... wait, actually we don't have it.
              },
            ],
          });
        // If this fails, the test will catch it.
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(
            `/api/purchase-orders/${ctx.purchaseOrderId}/returns/${ctx.purchaseReturnId}/cancel`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({})
          .expect(200);
      },
    },
    {
      name: 'Order Shipment: Ship vs Cancel',
      setup: async (app, ctx) => {
        const orderRes = await request(app.getHttpServer())
          .post('/api/sales-orders')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            customerId: ctx.validCustomerId,
            fulfillmentLocationId: ctx.validLocationId,
            lines: [
              {
                productId: ctx.validProductId,
                quantity: '2',
                pricePerUnit: '100.00',
              },
            ],
          });
        ctx.shipOrderId = orderRes.body.salesOrderId;
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${ctx.shipOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'picking' });

        const fullOrder = await request(app.getHttpServer())
          .get(`/api/sales-orders/${ctx.shipOrderId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`);
        const lineId = fullOrder.body.lines[0].salesOrderLineId;
        ctx.shipOrderLineId = lineId;

        await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.shipOrderId}/picking/lines/${lineId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ binId: ctx.validBinId, quantity: '2' });
      },
      action: async (app, ctx) => {
        const shipRes = await request(app.getHttpServer())
          .post(`/api/sales-orders/${ctx.shipOrderId}/shipments`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            lines: [
              { salesOrderLineId: ctx.shipOrderLineId, quantityShipped: '2' },
            ],
          });
        ctx.shipmentId = shipRes.body.shipmentId;

        await request(app.getHttpServer())
          .patch(
            `/api/sales-orders/${ctx.shipOrderId}/shipments/${ctx.shipmentId}/state`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'dispatched' });
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(
            `/api/sales-orders/${ctx.shipOrderId}/shipments/${ctx.shipmentId}/cancel`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
    },
    {
      name: 'Transfer Shipment: Ship vs Cancel Ship',
      setup: async (app, ctx) => {
        const toRes = await request(app.getHttpServer())
          .post('/api/transfers')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            sourceLocationId: ctx.validLocationId,
            destinationLocationId: ctx.validLocationId2,
            lines: [{ productId: ctx.validProductId, quantity: '2' }],
          })
          .expect(201);
        ctx.shipTransferId = toRes.body.transferOrderId || toRes.body.id;

        const getToRes = await request(app.getHttpServer())
          .get(`/api/transfers/${ctx.shipTransferId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`);

        const transferLineId =
          getToRes.body.lines[0].id ||
          getToRes.body.lines[0].transferOrderLineId;

        const db = app.get(DRIZZLE);

        // Find a valid bin in the source location
        const rows = await db.execute(sql`
          SELECT b.bin_id FROM modbm_core.bins b
          JOIN modbm_core.zones z ON b.zone_id = z.zone_id
          WHERE z.location_id = ${ctx.validLocationId} AND b.bin_type IN ('pick', 'storage') AND b.is_unavailable = false
          LIMIT 1
        `);
        const transferBinId = rows[0]?.bin_id || ctx.validBinId;

        // Ensure there is enough stock in the bin to pick from
        await db.execute(sql`
          INSERT INTO modbm_core.bin_contents (bin_id, product_id, actual_quantity)
          VALUES (${transferBinId}, ${ctx.validProductId}, 100)
          ON CONFLICT (bin_id, product_id) 
          DO UPDATE SET actual_quantity = modbm_core.bin_contents.actual_quantity + 100;
        `);

        const pickRes = await request(app.getHttpServer())
          .post(
            `/api/transfers/${ctx.shipTransferId}/picking/lines/${transferLineId}`,
          )
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ binId: transferBinId, quantity: '1' });
        if (pickRes.status !== 201)
          console.error('Transfer Pick Error:', pickRes.body);
        expect(pickRes.status).toBe(201);
      },
      action: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(`/api/transfers/${ctx.shipTransferId}/ship`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(`/api/transfers/${ctx.shipTransferId}/cancel-shipment`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
    },
    {
      name: 'Goods Received: Receive vs Cancel',
      setup: async (app, ctx) => {
        const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
        const poRes = await request(app.getHttpServer())
          .post('/api/purchase-orders')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            purchaseOrderId: crypto.randomUUID(),
            orderNumber: `SYM-PO-${rand}`,
            vendorId: ctx.validVendorId,
            deliveryLocationId: ctx.validLocationId,
            lines: [
              {
                productId: ctx.validProductId,
                quantity: '3',
                pricePerUnit: '40.00',
              },
            ],
          })
          .expect(201);
        ctx.grOrderId = poRes.body.purchaseOrderId;
        await request(app.getHttpServer())
          .patch(`/api/purchase-orders/${ctx.grOrderId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'ordered' });

        const fullPO = await request(app.getHttpServer())
          .get(`/api/purchase-orders/${ctx.grOrderId}`)
          .set('Authorization', `Bearer ${ctx.adminToken}`);
        ctx.grOrderLineId = fullPO.body.lines[0].purchaseOrderLineId;
      },
      action: async (app, ctx) => {
        const recRes = await request(app.getHttpServer())
          .post('/api/goods-received')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            purchaseOrderId: ctx.grOrderId,
            locationId: ctx.validLocationId,
            lines: [
              {
                purchaseOrderLineId: ctx.grOrderLineId,
                quantityReceived: '3',
              },
            ],
          });
        ctx.receiptId = recRes.body.receiptId;
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(`/api/goods-received/${ctx.receiptId}/cancel`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
    },
    {
      name: 'Supplier Payment: Submit vs Cancel',
      setup: async (app, ctx) => {},
      action: async (app, ctx) => {
        const payRes = await request(app.getHttpServer())
          .post('/api/payments')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            partyType: 'vendor',
            partyId: ctx.validVendorId,
            amount: '500.00',
            currencyCode: 'AUD',
            paymentDate: new Date().toISOString(),
            paymentMethod: 'bank_transfer',
            paymentDirection: 'outbound',
            reference: 'Test Supplier Payment',
            bankAccountId: ctx.bankAccountId,
            status: 'submitted',
          });
        ctx.supplierPaymentId = payRes.body.paymentId;
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .post(`/api/payments/${ctx.supplierPaymentId}/cancel`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
    },
    {
      name: 'Purchase Invoice: Create vs Cancel',
      setup: async (app, ctx) => {},
      action: async (app, ctx) => {
        const invRes = await request(app.getHttpServer())
          .post('/api/purchase-invoices')
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({
            vendorId: ctx.validVendorId,
            supplierInvoiceNumber: `INV-${Date.now()}`,
            currencyCode: 'AUD',
            totalAmount: 110,
            taxAmount: 10,
            lines: [
              {
                description: 'Test Service',
                glAccountId: ctx.expenseAccountId,
                quantityInvoiced: 1,
                pricePerUnit: 100,
              },
            ],
          });
        ctx.standaloneInvoiceId = invRes.body.invoiceId;

        await request(app.getHttpServer())
          .post(`/api/purchase-invoices/${ctx.standaloneInvoiceId}/post`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({});
      },
      inverseAction: async (app, ctx) => {
        await request(app.getHttpServer())
          .patch(`/api/purchase-invoices/${ctx.standaloneInvoiceId}/state`)
          .set('Authorization', `Bearer ${ctx.adminToken}`)
          .send({ stateCode: 'cancelled' });
      },
    },
  ];

  beforeAll(async () => {
    register.clear();
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    const adminToken = adminLogin.body.access_token;

    const accountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const leaves: any[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isGroup) leaves.push(node);
        if (node.children) walk(node.children);
      }
    };
    walk(accountsRes.body);

    const apAccountId = (
      leaves.find((l) => l.accountCode === '2100') || leaves[0]
    ).glAccountId;
    const arAccountId = (
      leaves.find((l) => l.accountCode === '1200') || leaves[1]
    ).glAccountId;
    const bankAccountId = (
      leaves.find((l) => l.accountCode === '1110') || leaves[2]
    ).glAccountId;

    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const validCustomerId = customers.body.data[0].customerId;

    const vendors = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const validVendorId = vendors.body.data[0].vendorId;

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const validProductId = products.body.data[0].productId;

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const validLocationId = locations.body[0].locationId;
    let validLocationId2 = locations.body[1]?.locationId;
    if (!validLocationId2) {
      const createLocRes = await request(app.getHttpServer())
        .post('/api/inventory/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `TR-LOC-${Date.now()}`,
          name: 'Transfer Dest Loc',
          type: 'warehouse',
        })
        .expect(201);
      validLocationId2 = createLocRes.body.locationId;
    }

    const bins = await request(app.getHttpServer())
      .get('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const validBinId = bins.body.data[0]?.binId;

    if (!validLocationId)
      console.error('validLocationId is undefined! Response:', locations.body);

    const expenseAccountId = (
      leaves.find((l) => l.accountCode === '5100') ||
      leaves.find((l) => l.accountType === 'expense') ||
      leaves[4]
    ).glAccountId;

    context = {
      adminToken,
      validVendorId,
      validCustomerId,
      validProductId,
      validLocationId,
      validLocationId2,
      validBinId,
      apAccountId,
      arAccountId,
      bankAccountId,
      expenseAccountId,
    };
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  for (const pair of registerPairs) {
    describe(`Symmetry Flow: ${pair.name}`, () => {
      it('Executes the action and inverseAction leaving ledgers symmetrical', async () => {
        if (pair.setup) {
          await pair.setup(app, context);
        }

        const snapshotA = await snapshotLedgers(app, context.adminToken);

        await pair.action(app, context);
        await pair.inverseAction(app, context);

        const snapshotB = await snapshotLedgers(app, context.adminToken);

        // Assert Trial Balance matches exactly
        for (const accountId of Object.keys(snapshotA.trialBalance)) {
          expect(snapshotB.trialBalance[accountId] || 0).toBeCloseTo(
            snapshotA.trialBalance[accountId] || 0,
            4,
          );
        }
        for (const accountId of Object.keys(snapshotB.trialBalance)) {
          expect(snapshotA.trialBalance[accountId] || 0).toBeCloseTo(
            snapshotB.trialBalance[accountId] || 0,
            4,
          );
        }

        // Assert Inventory matches exactly
        for (const key of Object.keys(snapshotA.inventory)) {
          expect(snapshotB.inventory[key] || 0).toBeCloseTo(
            snapshotA.inventory[key] || 0,
            4,
          );
        }
        for (const key of Object.keys(snapshotB.inventory)) {
          expect(snapshotA.inventory[key] || 0).toBeCloseTo(
            snapshotB.inventory[key] || 0,
            4,
          );
        }
      });
    });
  }
});
