import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Inventory Cycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let productId: string;
  let accountId: string;
  let vendorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = loginRes.body.access_token;

    // Fetch dependencies
    const accounts = await request(app.getHttpServer())
      .get('/api/accounts?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    accountId = accounts.body.data[0].accountId;

    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = suppliers.body.data[0].vendorId;

    // Create a fresh product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `INV-CYC-${Date.now()}`,
        name: 'Inventory Cycle Test Product',
        listPrice: '50.00',
      })
      .expect(201);
    productId = productRes.body.productId;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: Initial state should be zero', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(parseFloat(res.body.quantityOnHand || '0')).toBe(0);
    expect(parseFloat(res.body.weightedAverageCost || '0')).toBe(0);
  });

  it('Step 2: PO Reception should update QOH and WAC', async () => {
    const poRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `PO-CYC-${Date.now()}`,
        vendorId,
        currencyCode: 'EUR',
        lines: [
          {
            productId,
            quantity: '20',
            pricePerUnit: '15.00',
            unitOfMeasure: 'EA',
          },
        ],
      })
      .expect(201);
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
    const poLineId = poDetail.body.lines[0].purchaseOrderLineId;

    await request(app.getHttpServer())
      .post(`/api/purchase-orders/${poId}/receptions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchaseOrderId: poId,
        packingSlipNumber: 'E2E-123',
        lines: [{ purchaseOrderLineId: poLineId, quantityReceived: '10' }],
      })
      .expect(201);

    const productRes = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(parseFloat(productRes.body.quantityOnHand)).toBe(10);
    expect(parseFloat(productRes.body.weightedAverageCost)).toBe(15.0);
  });

  it('Step 3: Sales Dispatch should update QOH', async () => {
    const soRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: accountId,
        name: 'SO Cycle Test',
        lines: [{ productId, quantity: '4', pricePerUnit: '50.00' }],
      })
      .expect(201);
    const soId = soRes.body.salesOrderId;

    // Transition state strictly
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'picking' })
      .expect(200);

    // Pick all and create shipment
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/picking/pick-all`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const shipmentsRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}/shipments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(shipmentsRes.body.length).toBeGreaterThan(0);
    const shipmentId = shipmentsRes.body[0].shipmentId;

    // Dispatching the shipment auto-transitions the order to 'shipped'
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/shipments/${shipmentId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'dispatched' })
      .expect(200);

    // Create Invoice (Mandatory for returns)
    const invRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Full Invoice for E2E' });

    if (invRes.status !== 201) {
      console.error('Invoicing failed:', invRes.body);
    }
    expect(invRes.status).toBe(201);

    const productRes = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(parseFloat(productRes.body.quantityOnHand)).toBe(6);
  });

  it('Step 4: Sales Return should update QOH', async () => {
    // Find the order again to get line IDs
    const mySo = await request(app.getHttpServer())
      .get('/api/sales-orders')
      .query({ q: 'SO Cycle Test' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const soId = mySo.body.data[0].id;

    const mySoDetail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const soLineId = mySoDetail.body.lines[0].salesOrderLineId;

    // Create Return
    const retRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/returns`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'E2E Return Cycle',
        lines: [
          {
            salesOrderLineId: soLineId,
            quantityReturned: '2',
            reason: 'DEFECTIVE',
          },
        ],
      });

    if (retRes.status !== 201) {
      console.error('Create return failed:', retRes.body);
    }
    expect(retRes.status).toBe(201);
    const returnId = retRes.body.returnId;

    // Transition return state: draft -> confirmed -> processed
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/returns/${returnId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/returns/${returnId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'processed' })
      .expect(200);

    // Verify QOH: 6 + 2 = 8
    const productRes = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(parseFloat(productRes.body.quantityOnHand)).toBe(8);
  });
});
