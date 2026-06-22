import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';

describe('Backorders Workflow (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let locationId: string;
  let productId: string;
  let customerId: string;
  let vendorId: string;

  beforeAll(async () => {
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
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locRes.body[0].locationId;

    // Fetch dependencies
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    customerId = customers.body.data[0].customerId;

    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = suppliers.body.data[0].vendorId;

    // 1. Create a fresh product (0 on hand)
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `BACKORDER-E2E-${Date.now()}`,
        name: 'Backorder E2E Test Product',
        productType: 'inventory',
        baseUom: 'EA',
      })
      .expect(201);
    productId = productRes.body.productId;

    // 2. Assign the preferred supplier to ensure a Draft PO can be generated
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should detect inventory gaps and subsequently generate backorders', async () => {
    const server = app.getHttpServer();

    // 3. Create a Sales Order
    const soRes = await request(server)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,
        customerId: customerId,
        orderNumber: `SO-BO-${Date.now()}`,
        deliveryAddressLine1: 'Test Address',
        lines: [],
      })
      .expect(201);

    const salesOrderId = soRes.body.salesOrderId;
    const salesOrderNumber = soRes.body.orderNumber;

    // 4. Add a Line Item (qty: 50, which is higher than the 0 on hand)
    await request(server)
      .post(`/api/sales-orders/${salesOrderId}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        quantity: 50,
        pricePerUnit: '100.00',
      })
      .expect(201);

    // 4.5 Move it forward in the State Machine properly to Quoted, before jumping to Confirmed
    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: 'quoted',
      })
      .expect(200);

    // 5. Try to confirm -> expect HTTP 409 Conflict with INVENTORY_GAP payload
    const conflictRes = await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: 'confirmed',
      });

    console.log(
      'Conflict Response Body:',
      JSON.stringify(conflictRes.body, null, 2),
    );

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.message).toBe('INVENTORY_GAP');
    expect(conflictRes.body.gaps).toBeDefined();
    expect(conflictRes.body.gaps).toHaveLength(1);
    expect(conflictRes.body.gaps[0].shortage).toBe(50);
    expect(conflictRes.body.gaps[0].productId).toBe(productId);

    // 6. Confirm WITH generateBackorders: true
    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: 'confirmed',
        generateBackorders: true,
      })
      .expect(200);

    // 7. Verify NO PO got generated (since auto-PO creation is disabled per USER REQUEST)
    // Best way in black-box integration is just querying the recently generated POs
    const posRes = await request(server)
      .get(`/api/purchase-orders?limit=10`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    let generatedPo = null;
    for (const poRow of posRes.body.data) {
      const detailRes = await request(server)
        .get(`/api/purchase-orders/${poRow.id ?? poRow.purchaseOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (
        detailRes.body.notes &&
        detailRes.body.notes.includes(salesOrderNumber)
      ) {
        generatedPo = detailRes.body;
        break;
      }
    }

    expect(generatedPo).toBeNull();
  });
});
