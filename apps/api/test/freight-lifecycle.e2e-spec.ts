import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';
import { CUSTOMER_STATE } from '@herobm/shared';

describe('Freight and Non-Stock Lifecycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let physicalProductId: string;
  let freightProductId: string;
  let customerId: string;
  let vendorId: string;
  let soId: string;
  let locationId: string;

  beforeAll(async () => {
    // Force final invoice mode for predictable non-stock billing in E2E
    process.env.NON_STOCK_BILLING_MODE = 'final_invoice';
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    if (loginRes.status !== 201) {
      throw new Error(
        `${'loginRes'} login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }
    adminToken = loginRes.body.access_token;

    // Fetch dependencies
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeCustomer =
      customers.body.data.find(
        (c: any) => c.stateCode === CUSTOMER_STATE.ACTIVE,
      ) || customers.body.data[0];
    customerId = activeCustomer.customerId;

    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = suppliers.body.data[0].vendorId;

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locations.body[0].locationId;

    // Create a physical product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `PHY-${Date.now()}`,
        name: 'Physical Good',
        productType: 'inventory',
        listPrice: '100.00',
        baseUom: 'EA',
      })
      .expect(201);
    physicalProductId = productRes.body.productId;

    await request(app.getHttpServer())
      .post(`/api/products/${physicalProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        isPreferred: true,
        costPrice: '50.00',
        minOrderQty: 1,
      })
      .expect(201);

    // Create a freight (non-stock) product
    const freightRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `FRT-${Date.now()}`,
        name: 'Standard Courier Freight',
        productType: 'non-stock',
        listPrice: '15.00',
        baseUom: 'EA',
      })
      .expect(201);
    freightProductId = freightRes.body.productId;

    // Receive some stock so we can fulfill the physical item
    const poRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `PO-FRT-${Date.now()}`,
        vendorId,
        deliveryLocationId: locationId,
        currencyCode: 'AUD',
        lines: [
          {
            productId: physicalProductId,
            quantity: '10',
            pricePerUnit: '50.00',
          },
        ],
      });
    if (poRes.status !== 201)
      throw new Error('DEBUG 500 PO BODY: ' + JSON.stringify(poRes.body));
    expect(poRes.status).toBe(201);

    const poId = poRes.body.purchaseOrderId;
    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    const poDetail = await request(app.getHttpServer())
      .get(`/api/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        locationId,
        packingSlipNumber: 'RCV-FRT-123',
        lines: [
          {
            productId: physicalProductId,
            quantityReceived: '10',
          },
        ],
      })
      .expect(201);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: Order creation with mixed physical and non-stock lines', async () => {
    const soRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,

        customerId: customerId,
        name: 'Freight Test Order',
        deliveryAddressLine1: 'Test Address',
        lines: [
          {
            productId: physicalProductId,
            quantity: '2',
            pricePerUnit: '100.00',
          },
          { productId: freightProductId, quantity: '1', pricePerUnit: '15.00' },
        ],
      });

    expect(soRes.status).toBe(201);
    soId = soRes.body.salesOrderId;
  });

  it('Step 2: Transition through picking bypasses freight', async () => {
    // Quote
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' })
      .expect(200);

    // Confirm (Backorder logic should ignore Freight gap)
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed', generateBackorders: false })
      .expect(200);

    // Pick
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'picking' })
      .expect(200);

    // Try to get picking summary - Freight should be virtually marked as 100% picked and shipped
    const summaryRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}/picking`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const freightLine = summaryRes.body.lines.find(
      (l: any) => l.productId === freightProductId,
    );
    expect(freightLine).toBeDefined();
    expect(freightLine.isPhysical).toBe(false);
    expect(freightLine.quantityPicked).toBe('1'); // Virtual
    expect(freightLine.isFullyPicked).toBe(true);
  });

  it('Step 3: Pick physical line and dispatch shipment', async () => {
    // Get bins
    const binsRes = await request(app.getHttpServer())
      .get('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const binId = binsRes.body.data[0].binId;

    // Get order lines
    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Pick only the physical line
    const physicalLine = detail.body.lines.find(
      (l: any) => l.productId === physicalProductId,
    );
    await request(app.getHttpServer())
      .post(
        `/api/sales-orders/${soId}/picking/lines/${physicalLine.salesOrderLineId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ binId, quantity: physicalLine.quantity })
      .expect(201);

    // Create shipment with all lines (physical + freight)
    const shipLines = detail.body.lines.map((l: any) => ({
      salesOrderLineId: l.salesOrderLineId,
      quantityShipped: l.quantity,
    }));

    const shipRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/shipments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lines: shipLines })
      .expect(201);

    // Dispatch the shipment is automatic on creation.

    // The order should now be 'shipped' automatically
    const soDetail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(soDetail.body.stateCode).toBe('shipped');
  });

  it('Step 4: Full Invoice applies both physical stock and non-stock lines', async () => {
    // Generate Invoice
    const invRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Freight Invoice E2E' });

    expect(invRes.status).toBe(201);

    const invoicesRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(invoicesRes.body.length).toBeGreaterThan(0);
    const invoiceLineCount = invoicesRes.body[0].lines?.length || 0;

    if (invoiceLineCount !== 2) {
      console.log(
        'Invoice data:',
        JSON.stringify(invoicesRes.body[0], null, 2),
      );
    }

    // In final_invoice mode with fully shipped order, we expect both lines to be on the invoice
    expect(invoiceLineCount).toBe(2);
  });
});
