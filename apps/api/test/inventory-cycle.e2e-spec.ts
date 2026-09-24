import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';
import { CUSTOMER_STATE } from '@herobm/shared';

/**
 * ==============================================================================
 * ⚠️ IMPORTANT NOTICE: INVENTORY LEDGER TESTING LIMITATIONS ⚠️
 * ==============================================================================
 *
 * This E2E test suite currently DOES NOT fully test the inventory ledger lifecycle.
 * Because the "Put-Away" (Invoice Creation / PO Allocation) workflow is not yet
 * fully implemented, goods received in this test remain trapped in the `RECEIVING`
 * dock bin, and items are picked directly from `RECEIVING` into the `SHIPPING`
 * dock bin.
 *
 * As a result, the items never enter a standard `storage` bin, and the
 * `inventory_levels` view (which correctly excludes receiving and staging bins)
 * evaluates the available quantity on hand to be 0 at all times during this cycle.
 *
 * ACTION REQUIRED:
 * Once PO Allocation and Invoice Creation (Put-Away) are handled, this test
 * MUST BE EXPANDED to properly verify stock movement into storage bins and to
 * assert correct > 0 availability totals across the `inventory_levels` view.
 * ==============================================================================
 */
describe('Inventory Cycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let productId: string;
  let productNumber: string;
  let customerId: string;
  let vendorId: string;
  let locationId: string;

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

    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    let targetLocation = locationsRes.body.find((l: any) => l.code === 'MAIN');
    if (!targetLocation && locationsRes.body.length > 0) {
      for (const loc of locationsRes.body) {
        const binsCheck = await request(app.getHttpServer())
          .get(
            `/api/inventory/locations/${loc.locationId}/bins?binType=storage`,
          )
          .set('Authorization', `Bearer ${adminToken}`);
        if (
          binsCheck.status === 200 &&
          Array.isArray(binsCheck.body) &&
          binsCheck.body.length > 0
        ) {
          targetLocation = loc;
          break;
        }
      }
    }
    locationId = (targetLocation || locationsRes.body[0]).locationId;

    // Create a fresh product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `INV-CYC-${Date.now()}`,
        name: 'Inventory Cycle Test Product',
        listPrice: '50.00',
        productType: 'inventory',
        baseUom: 'EA',
      })
      .expect(201);
    productId = productRes.body.productId;
    productNumber = productRes.body.productNumber;

    await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        isPreferred: true,
        costPrice: '15.00',
        minOrderQty: 1,
      })
      .expect(201);
  }, 120_000);

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
        deliveryLocationId: locationId,
        currencyCode: 'AUD',
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

    const grnRes = await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        locationId,
        purchaseOrderId: poId,
        packingSlipNumber: 'E2E-123',
        lines: [
          {
            productId,
            purchaseOrderLineId: poLineId,
            quantityReceived: '10',
          },
        ],
      });

    if (grnRes.status !== 201) {
      throw new Error('PO Reception failed: ' + JSON.stringify(grnRes.body));
    }
    expect(grnRes.status).toBe(201);

    // Find a pickable storage bin in locationId and put away the received stock
    const locBinsRes = await request(app.getHttpServer())
      .get(`/api/inventory/locations/${locationId}/bins?binType=storage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    let storageBin =
      (Array.isArray(locBinsRes.body) &&
        locBinsRes.body.find((b: any) => b.binType === 'storage')) ||
      (Array.isArray(locBinsRes.body) && locBinsRes.body[0]);

    if (!storageBin) {
      const topRes = await request(app.getHttpServer())
        .get('/api/inventory/topography')
        .set('Authorization', `Bearer ${adminToken}`);
      const locTop =
        Array.isArray(topRes.body) &&
        topRes.body.find((l: any) => l.locationId === locationId);
      let zoneId = locTop?.zones?.[0]?.zoneId;
      if (!zoneId) {
        const zoneRes = await request(app.getHttpServer())
          .post('/api/inventory/zones')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            locationId,
            code: `Z-${Date.now()}`,
            name: 'Test Storage Zone',
          })
          .expect(201);
        zoneId = zoneRes.body.zoneId;
      }
      const binRes = await request(app.getHttpServer())
        .post('/api/inventory/bins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          zoneId,
          binNumber: `BIN-${Date.now()}`,
          binType: 'storage',
        })
        .expect(201);
      storageBin = binRes.body;
    }
    const storageBinId = storageBin.binId;
    const grnLineId = grnRes.body.lines[0].goodsReceivedLineId;

    await request(app.getHttpServer())
      .post('/api/inventory/putaway')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        putaways: [
          {
            lineId: grnLineId,
            sourceType: 'goods_receipt',
            destinationBinId: storageBinId,
            quantity: '10',
          },
        ],
      })
      .expect(201);

    const invResAfter = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockAfter = invResAfter.body.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // 10 units are now put away into storage, so available QOH is 10
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(10);
  });

  it('Step 3: Sales Dispatch should update QOH', async () => {
    const soRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,

        customerId: customerId,
        name: 'SO Cycle Test',
        deliveryAddressLine1: 'Test Address',
        lines: [{ productId, quantity: '4', pricePerUnit: '50.00' }],
      });

    if (soRes.status !== 201) {
      console.log('Failed to create sales order, got status', soRes.status);
      console.log('Response Error Body:', soRes.body);
    }
    expect(soRes.status).toBe(201);
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
      .send({ stateCode: 'confirmed', generateBackorders: false })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'picking' })
      .expect(200);

    // Get bins for our specific product to ensure we pick from the pickable storage bin
    const binsRes = await request(app.getHttpServer())
      .get(`/api/inventory/bins?q=${productNumber}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const binData =
      binsRes.body.data.find(
        (b: any) => b.productId === productId && b.binType === 'storage',
      ) || binsRes.body.data.find((b: any) => b.productId === productId);
    const binId = binData?.binId;

    if (!binId) {
      throw new Error(`Could not find bin containing product ${productId}`);
    }

    const soDetail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const soLineId = soDetail.body.lines[0].salesOrderLineId;

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/picking/lines/${soLineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ binId, quantity: '4' })
      .expect(201);

    // Create shipment manually
    const shipCreateRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/shipments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [{ salesOrderLineId: soLineId, quantityShipped: '4' }],
      })
      .expect(201);

    const shipmentId = shipCreateRes.body.shipmentId;

    // Dispatching is now automatic on creation.

    // Create Invoice (Mandatory for returns)
    const invRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Full Invoice for E2E' });

    expect(invRes.status).toBe(201);

    const invResAfter = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockAfter = invResAfter.body.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // After shipping 4 out of 10 units, 6 remain available in storage
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(6);
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

    expect(retRes.status).toBe(201);
    const returnId = retRes.body.returnId;

    // Transition return state: draft -> confirmed -> processed
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/returns/${returnId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed', generateBackorders: false })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/returns/${returnId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'received', locationId })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/sales-credit-notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ returnId })
      .expect(201);

    const invResAfter = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockAfter = invResAfter.body.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // QOH remains 6 in storage because returns are received into the dock bin
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(6);
  });

  it('Step 5: Verify product inventory endpoint', async () => {
    // This endpoint powers the "Inventory" tab on the Product Details page.
    // It should return the list of locations where the product has stock.
    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(invRes.body).toBeDefined();
    expect(Array.isArray(invRes.body)).toBe(true);

    const totalQoh = invRes.body.reduce(
      (sum: number, row: any) => sum + parseFloat(row.quantityOnHand || '0'),
      0,
    );

    expect(totalQoh).toBe(6);
  });
});
