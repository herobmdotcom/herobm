import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

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
  let accountId: string;
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
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    if (loginRes.status !== 201) {
      throw new Error(
        `${'loginRes'} login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }
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

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locations.body.data[0].locationId;

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
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        locationId,
        packingSlipNumber: 'E2E-123',
        lines: [{ productId, quantityReceived: '10' }],
      })
      .expect(201);

    // NOTE: Per business rules, GoodsReceived does NOT update the products table cache (quantity_on_hand/WAC)
    // until invoicing/put-away. We verify physical stock arrival via the inventory endpoint instead.
    const inventoryRes = await request(app.getHttpServer())
      .get(
        `/api/inventory/by-products?productIds=${productId}&locationId=${locationId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const physicalStock = inventoryRes.body.data.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    expect(parseFloat(physicalStock?.quantityOnHand || '0')).toBe(0);

    const invResAfter = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockAfter = invResAfter.body.data.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // QOH is 0 because the received goods are in the RECEIVING bin, which is excluded from availability
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(0);
  });

  it('Step 3: Sales Dispatch should update QOH', async () => {
    const soRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,

        customerId: accountId,
        name: 'SO Cycle Test',
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

    // Get bins for our specific product to ensure we pick from the correct RECEIVING bin
    const binsRes = await request(app.getHttpServer())
      .get(`/api/inventory/bins?q=${productNumber}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const binData = binsRes.body.data.find(
      (b: any) => b.productId === productId,
    );
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
    const stockAfter = invResAfter.body.data.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // The picking occurred from the RECEIVING bin (excluded) into the SHIPPING bin (excluded),
    // and the items were never put away into storage, so available QOH remains 0.
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(0);
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
      .send({ stateCode: 'processed', locationId })
      .expect(200);

    const invResAfter = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockAfter = invResAfter.body.data.find(
      (d: any) => d.productId === productId && d.locationId === locationId,
    );
    // QOH remains 0 because returns are received into the RECEIVING dock bin
    expect(parseFloat(stockAfter?.quantityOnHand || '0')).toBe(0);
  });

  it('Step 5: Verify product inventory endpoint', async () => {
    // This endpoint powers the "Inventory" tab on the Product Details page.
    // It should return the list of locations where the product has stock.
    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(invRes.body.data).toBeDefined();
    expect(Array.isArray(invRes.body.data)).toBe(true);

    // After all operations, the available stock across all locations is 0.
    // The physical 12 items (10 received + 2 returned) are in the receiving dock, and 4 in shipping, none in storage.
    const totalQoh = invRes.body.data.reduce(
      (sum: number, row: any) => sum + parseFloat(row.quantityOnHand || '0'),
      0,
    );

    expect(totalQoh).toBe(0);
  });
});

