/**
 * E2E Tests — 3-Way Matching (PO -> Receipt -> Invoice) via Standalone AP Flow
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { PURCHASE_ORDER_STATE, MATCH_STATUS } from '@herobm/shared';

import request from 'supertest';

describe('API E2E — 3-Way Matching (Standalone AP Flow)', () => {
  let app: INestApplication;
  let adminToken: string;
  let validVendorId: string;
  let validProductId: string;
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });

    if (adminLogin.status !== 201) {
      console.error(
        'ADMIN LOGIN FAIL:',
        adminLogin.status,
        adminLogin.body,
        'PASSWORD USED:',
        process.env.ADMIN_PASSWORD || 'password',
      );
    }
    expect(adminLogin.status).toBe(201);
    adminToken = adminLogin.body.access_token;

    // Create a vendor
    const vendorRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address1Country: 'AU',
        vendorNumber: `E2E-MATCH-VEND-${Date.now()}`,
        name: 'E2E 3-Way Matching Vendor',
      });
    if (vendorRes.status !== 201) {
      console.error('SUPPLIER CREATE FAIL:', vendorRes.status, vendorRes.body);
    }
    expect(vendorRes.status).toBe(201);
    validVendorId = vendorRes.body.vendorId;

    // Create a product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-MATCH-P-${Date.now()}`,
        name: 'E2E 3-Way Test Product',
        listPrice: '10.00',
        productType: 'inventory',
        baseUom: 'EA',
      })
      .expect(201);
    validProductId = productRes.body.productId;

    await request(app.getHttpServer())
      .post(`/api/products/${validProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      })
      .expect(201);

    // Fetch a location
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body[0].locationId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('performs a complete 3-way match using standalone AP invoice flow', async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. Create Purchase Order (10 units)
    const poRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `E2E-MATCH-PO-${today}-${rand}`,
        vendorId: validVendorId,
        deliveryLocationId: validLocationId,
        currencyCode: 'AUD',
        lines: [
          { productId: validProductId, quantity: '10', pricePerUnit: '10.00' },
        ],
      })
      .expect(201);
    const poId = poRes.body.purchaseOrderId;

    // 2. Approve PO (move to ordered)
    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: PURCHASE_ORDER_STATE.ORDERED })
      .expect(200);

    // Get line ID
    const detail = await request(app.getHttpServer())
      .get(`/api/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const poLineId = detail.body.lines[0].purchaseOrderLineId;

    // 3. Create Goods Receipt (partial - 4 units)
    await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: validLocationId,
        packingSlipNumber: `PS-MATCH-${rand}-1`,
        lines: [{ productId: validProductId, quantityReceived: '4' }],
      })
      .expect(201);

    // 4. Create Standalone Invoice linking to the PO line
    const invRes = await request(app.getHttpServer())
      .post('/api/purchase-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        supplierInvoiceNumber: `INV-MATCH-${rand}-1`,
        currencyCode: 'AUD',
        purchaseOrderId: poId,
        totalAmount: 40.0,
        taxAmount: 0,
        notes: 'Partial 3-Way Match',
        lines: [
          {
            description: 'E2E 3-Way Test Product',
            productId: validProductId,
            quantityInvoiced: 4,
            pricePerUnit: 10.0,
            purchaseOrderLineId: poLineId,
          },
        ],
      })
      .expect(201);
    const invoiceId = invRes.body.invoiceId;
    expect(invoiceId).toBeDefined();

    // 5. Verify Invoice linking via the GET endpoint
    const invDetail = await request(app.getHttpServer())
      .get(`/api/purchase-invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(invDetail.body.lines.length).toBe(1);
    expect(invDetail.body.lines[0].purchaseOrderLineId).toBe(poLineId);
    expect(invDetail.body.lines[0].matchStatus).toBe(MATCH_STATUS.MATCHED);

    // 6. Post the draft invoice
    await request(app.getHttpServer())
      .post(`/api/purchase-invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 7. Unlink the invoice line (testing flexibility of standalone AP)
    const invLineId = invDetail.body.lines[0].lineId;
    await request(app.getHttpServer())
      .post(`/api/purchase-invoices/lines/${invLineId}/unresolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify unlinked
    const unlinkedDetail = await request(app.getHttpServer())
      .get(`/api/purchase-invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(unlinkedDetail.body.lines[0].purchaseOrderLineId).toBeNull();
    expect(unlinkedDetail.body.lines[0].matchStatus).toBe(
      MATCH_STATUS.UNMATCHED,
    );

    // 8. Relink the invoice line
    await request(app.getHttpServer())
      .post(`/api/purchase-invoices/lines/${invLineId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ purchaseOrderLineId: poLineId })
      .expect(200);

    // Verify linked
    const relinkedDetail = await request(app.getHttpServer())
      .get(`/api/purchase-invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(relinkedDetail.body.lines[0].purchaseOrderLineId).toBe(poLineId);
    expect(relinkedDetail.body.lines[0].matchStatus).toBe(MATCH_STATUS.MATCHED);
  });
});
