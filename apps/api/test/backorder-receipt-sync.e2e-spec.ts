import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';

import request from 'supertest';

describe('E2E — Backorder Receipt Synchronization (ADV-085)', () => {
  let app: INestApplication;
  let adminToken: string;

  let validVendorId: string;
  let productId: string;
  let locationId: string;
  let customerId: string;

  beforeAll(async () => {
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

    expect(adminLogin.status).toBe(201);
    adminToken = adminLogin.body.access_token;

    // Use seeded setup data
    locationId = '10000000-0000-4000-8000-000000000001'; // MAIN
    customerId = '20000000-0000-4000-8000-000000000001'; // E2E Default Customer
    validVendorId = '20000000-0000-4000-8000-000000000002'; // Standard seed vendor

    console.log('Ensuring Location exists...');
    const createLocRes = await request(app.getHttpServer())
      .post('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `MAIN-${Date.now()}`,
        name: 'Main Warehouse',
        type: 'warehouse',
      });
    console.log('Location Creation Status:', createLocRes.status);
    console.log('Location Creation Body:', JSON.stringify(createLocRes.body));
    locationId = createLocRes.body.locationId || locationId;
    console.log('Final locationId:', locationId);

    const createCustRes = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber: `CUST-ADV085-${Date.now()}`,
        name: 'ADV-085 Test Customer',
        currencyCode: 'AUD',
      });
    customerId = createCustRes.body.customerId || customerId;
    console.log('Final customerId:', customerId);

    const createVendorRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address1Country: 'AU',
        vendorNumber: `VEND-ADV085-${Date.now()}`,
        name: 'ADV-085 Test Vendor',
        currencyCode: 'AUD',
      });
    validVendorId = createVendorRes.body.vendorId || validVendorId;
    console.log('Final vendorId:', validVendorId);

    console.log('Fetching Product...');
    // Create a fresh product (0 on hand)
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `ADV085-P-${Date.now()}`,
        name: 'ADV-085 Backorder Receipt Test Product',
        productType: 'inventory',
        baseUom: 'EA',
      });

    expect(productRes.status).toBe(201);
    productId = productRes.body.productId;

    // Assign supplier
    const suppRes = await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      });
    console.log('Supplier Assignment Status:', suppRes.status);
    expect(suppRes.status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('should transition backorder state from awaiting_receipt to received_reserved on Goods Receipt', async () => {
    const server = app.getHttpServer();

    // 1. Create a Sales Order that will trigger a backorder
    const soRes = await request(server)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,
        customerId: customerId,
        orderNumber: `SO-ADV085-${Date.now()}`,
        deliveryAddressLine1: 'Test Address',
        lines: [],
      });
    expect(soRes.status).toBe(201);

    const salesOrderId = soRes.body.salesOrderId;

    // Add line with shortage
    const solRes = await request(server)
      .post(`/api/sales-orders/${salesOrderId}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        quantity: 10,
        pricePerUnit: '100.00',
      });
    expect(solRes.status).toBe(201);

    // Transition to confirmed with backorders
    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: 'quoted',
      })
      .expect(200);

    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: 'confirmed',
        generateBackorders: true,
      })
      .expect(200);

    // 2. Verify backorder created in pending_supply
    const openDemandsRes = await request(server)
      .get('/api/allocations/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const backorder = openDemandsRes.body.find(
      (d: { salesOrderId: string; productId: string }) =>
        d.salesOrderId === salesOrderId && d.productId === productId,
    );
    expect(backorder).toBeDefined();
    const backorderId = backorder.id;

    // 3. Create a PO to fulfill the backorder
    const poRes = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `PO-ADV085-${Date.now()}`,
        vendorId: validVendorId,
        deliveryLocationId: locationId,
        currencyCode: 'AUD',
        lines: [
          {
            productId,
            quantity: 10,
            pricePerUnit: '10.00',
          },
        ],
      })
      .expect(201);

    const poId = poRes.body.purchaseOrderId;
    const poLineId = poRes.body.lines[0].purchaseOrderLineId;

    // 4. Link backorder to PO line
    await request(server)
      .post('/api/allocations/link-po')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        demandId: backorderId,
        purchaseOrderLineId: poLineId,
        quantity: 10,
      })
      .expect(201);

    // PO must be ordered to receive goods
    await request(server)
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    // 5. Create Goods Receipt
    await request(server)
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: locationId,
        packingSlipNumber: 'PS-ADV085',
        lines: [
          {
            productId,
            quantityReceived: 10,
          },
        ],
      })
      .expect(201);

    // 6. ASSERTION: Backorder should now be in received_reserved state
    const finalAllocRes = await request(server)
      .get(`/api/allocations/by-po/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const finalBackorder = finalAllocRes.body.find(
      (d: { id: string }) => d.id === backorderId,
    );

    expect(finalBackorder).toBeDefined();
    expect(finalBackorder.stateCode).toBe('received_reserved');
  });

  it('should split backorder record if Goods Receipt is partial', async () => {
    const server = app.getHttpServer();

    // 1. Setup new product and backorder for partial test
    const partialProductRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `ADV085-PARTIAL-${Date.now()}`,
        name: 'ADV-085 Partial Receipt Test Product',
        productType: 'inventory',
        baseUom: 'EA',
      })
      .expect(201);
    const pProductId = partialProductRes.body.productId;

    await request(server)
      .post(`/api/products/${pProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      })
      .expect(201);

    const soRes = await request(server)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,
        customerId: customerId,
        orderNumber: `SO-ADV085-P-${Date.now()}`,
        deliveryAddressLine1: 'Test Address',
        lines: [
          { productId: pProductId, quantity: 10, pricePerUnit: '100.00' },
        ],
      });
    expect(soRes.status).toBe(201);

    const salesOrderId = soRes.body.salesOrderId;

    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' })
      .expect(200);

    await request(server)
      .patch(`/api/sales-orders/${salesOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed', generateBackorders: true })
      .expect(200);

    const openDemandsRes = await request(server)
      .get('/api/allocations/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const backorder = openDemandsRes.body.find(
      (d: { productId: string }) => d.productId === pProductId,
    );
    const backorderId = backorder.id;

    const poRes = await request(server)
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `PO-ADV085-P-${Date.now()}`,
        vendorId: validVendorId,
        deliveryLocationId: locationId,
        currencyCode: 'AUD',
        lines: [{ productId: pProductId, quantity: 10, pricePerUnit: '10.00' }],
      })
      .expect(201);

    const poId = poRes.body.purchaseOrderId;
    const poLineId = poRes.body.lines[0].purchaseOrderLineId;

    await request(server)
      .post('/api/allocations/link-po')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        demandId: backorderId,
        purchaseOrderLineId: poLineId,
        quantity: 10,
      })
      .expect(201);

    await request(server)
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    // 2. Receive PARTIAL (4 units out of 10)
    await request(server)
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: locationId,
        packingSlipNumber: 'PS-ADV085-PARTIAL',
        lines: [{ productId: pProductId, quantityReceived: 4 }],
      })
      .expect(201);

    // 3. ASSERTION: Should have two backorder records now
    const finalAllocRes = await request(server)
      .get(`/api/allocations/by-po/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const receivedPart = finalAllocRes.body.find(
      (d: { stateCode: string }) => d.stateCode === 'received_reserved',
    );
    const awaitingPart = finalAllocRes.body.find(
      (d: { stateCode: string }) => d.stateCode === 'awaiting_receipt',
    );

    expect(receivedPart).toBeDefined();
    expect(receivedPart.quantity).toBe(4);

    expect(awaitingPart).toBeDefined();
    expect(awaitingPart.quantity).toBe(6);
  });
});
