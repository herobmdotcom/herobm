/**
 * E2E Tests — 3-Way Matching (PO -> Receipt -> Invoice)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — 3-Way Matching', () => {
  let app: INestApplication;
  let adminToken: string;
  let validVendorId: string;
  let validProductId: string;
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Create a vendor
    const vendorRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorNumber: `E2E-3WAY-VEND-${Date.now()}`,
        name: 'E2E 3-Way Matching Vendor',
      })
      .expect(201);
    validVendorId = vendorRes.body.vendorId;

    // Create a product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-3WAY-P-${Date.now()}`,
        name: 'E2E 3-Way Test Product',
        listPrice: '10.00',
      })
      .expect(201);
    validProductId = productRes.body.productId;

    // Fetch a location
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body.data[0].locationId;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it('performs a complete 3-way match: PO -> Receipt -> Invoice', async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. Create Purchase Order
    const poRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `E2E-3WAY-PO-${today}-${rand}`,
        vendorId: validVendorId,
        deliveryLocationId: validLocationId,
        currencyCode: 'AUD',
        lines: [
          { productId: validProductId, quantity: '10', pricePerUnit: '10.00' },
        ],
      })
      .expect(201);
    const poId = poRes.body.purchaseOrderId;
    const poLineId = poRes.body.lines[0].purchaseOrderLineId;

    // 2. Approve PO (move to ordered)
    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    // 3. Create Goods Receipt (partial - 4 units)
    const grRes = await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: validLocationId,
        packingSlipNumber: `PS-3WAY-${rand}-1`,
        lines: [{ productId: validProductId, quantityReceived: '4' }],
      })
      .expect(201);
    const grId = grRes.body.goodsReceivedId;
    const grLineId = grRes.body.lines[0].goodsReceivedLineId;

    // 4. Create Invoice linked to this receipt
    const invRes = await request(app.getHttpServer())
      .post(`/api/purchase-orders/${poId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierInvoiceNumber: `INV-3WAY-${rand}-1`,
        lines: [
          {
            purchaseOrderLineId: poLineId,
            quantityToInvoice: 4,
            goodsReceivedLineId: grLineId,
          },
        ],
      })
      .expect(201);
    const invoiceId = invRes.body.invoiceId;

    // 5. Verify the link
    const detailRes = await request(app.getHttpServer())
      .get(`/api/purchase-invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detailRes.body.lines[0].goodsReceivedLineId).toBe(grLineId);
    expect(parseFloat(detailRes.body.lines[0].quantityBilled)).toBe(4);

    // 6. Attempt to over-bill against the same receipt (should fail)
    await request(app.getHttpServer())
      .post(`/api/purchase-orders/${poId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierInvoiceNumber: `INV-3WAY-${rand}-2`,
        lines: [
          {
            purchaseOrderLineId: poLineId,
            quantityToInvoice: 1,
            goodsReceivedLineId: grLineId,
          },
        ],
      })
      .expect(400); // Already billed 4/4

    // 7. Create another receipt (6 units)
    const grRes2 = await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: validLocationId,
        packingSlipNumber: `PS-3WAY-${rand}-2`,
        lines: [{ productId: validProductId, quantityReceived: '6' }],
      })
      .expect(201);
    const grLineId2 = grRes2.body.lines[0].goodsReceivedLineId;

    // 8. Bill the remaining 6 units against the new receipt
    await request(app.getHttpServer())
      .post(`/api/purchase-orders/${poId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierInvoiceNumber: `INV-3WAY-${rand}-2`,
        lines: [
          {
            purchaseOrderLineId: poLineId,
            quantityToInvoice: 6,
            goodsReceivedLineId: grLineId2,
          },
        ],
      })
      .expect(201);

    // 9. Verify PO state is now 'invoiced'
    const finalPoRes = await request(app.getHttpServer())
      .get(`/api/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(finalPoRes.body.stateCode).toBe('invoiced');
  });
});
