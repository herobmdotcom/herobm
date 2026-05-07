/**
 * E2E Tests — Goods Received API
 *
 * Exercises the new supplier-first goods reception endpoints on
 * GoodsReceivedController against a real Postgres database.
 * Verifies dock manifest creation, auto-matching, listing, detail
 * retrieval, and RBAC enforcement.
 *
 * Run with: npm run test:e2e -- --testPathPatterns goods-received
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Goods Received (Dock Manifest)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  let validVendorId: string;
  let appProductId: string;
  let validLocationId: string;
  let appProductNumber: string;

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
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Login as viewer
    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      })
      .expect(201);
    viewerToken = viewerLogin.body.access_token;

    // Create a test product
    appProductNumber = `E2E-GR-P-${Date.now()}`;
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: appProductNumber,
        name: 'E2E Goods Received Test Product',
        listPrice: '25.00',
      });

    if (productRes.status !== 201) {
      console.error(
        '❌ Product creation failed in E2E setup:',
        productRes.body,
      );
    }
    expect(productRes.status).toBe(201);
    appProductId = productRes.body.productId;

    // Fetch a real supplier
    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validVendorId = suppliers.body.data[0].vendorId;

    // Fetch a delivery location
    console.log('Fetching locations');
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    console.log('Setting location');
    validLocationId = locationsRes.body.data[0].locationId;

    // Create an open PO for the test product to enable auto-matching
    console.log('Creating PO');
    let poRes;
    try {
      poRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `PO-E2E-${Date.now()}`,
          vendorId: validVendorId,
          deliveryLocationId: validLocationId,
          currencyCode: 'EUR',
          lines: [
            {
              productId: appProductId,
              quantity: '1000',
              pricePerUnit: '10.00',
            },
          ],
        });
      console.log('PO Create Status:', poRes.status, poRes.body);
      expect(poRes.status).toBe(201);
    } catch (err) {
      console.error('PO CREATE ERROR:', err);
      throw err;
    }

    console.log('Patching PO');
    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${poRes.body.purchaseOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // Goods receipt lifecycle
  // =========================================================================

  describe('Goods receipt lifecycle', () => {
    let goodsReceivedId: string;

    it('POST /goods-received — creates a dock manifest', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          packingSlipNumber: 'PS-E2E-001',
          notes: 'E2E test delivery',
          lines: [
            {
              productId: appProductId,
              quantityReceived: '15',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('goodsReceivedId');
      expect(res.body).toHaveProperty('receiptNumber');
      expect(res.body.receiptNumber).toMatch(/^GR-/);
      expect(res.body.lines).toHaveLength(1);

      // Auto-match status should be one of the valid values
      const lineStatus = res.body.lines[0].matchStatus;
      expect(['matched', 'unmatched', 'ambiguous']).toContain(lineStatus);

      goodsReceivedId = res.body.goodsReceivedId;
    });

    it('GET /goods-received — lists receipts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Each row should have match count fields
      const row = res.body.data.find(
        (d: any) => d.goodsReceivedId === goodsReceivedId,
      );
      expect(row).toBeDefined();
      expect(row).toHaveProperty('totalLines');
      expect(row).toHaveProperty('matchedLines');
      expect(row).toHaveProperty('vendorName');
    });

    it('GET /goods-received/:id — retrieves receipt detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/goods-received/${goodsReceivedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.goodsReceivedId).toBe(goodsReceivedId);
      expect(res.body.packingSlipNumber).toBe('PS-E2E-001');
      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0].productId).toBe(appProductId);
      expect(res.body.lines[0].quantityReceived).toBe('15');
    });

    it('GET /goods-received/:id — returns 404 for nonexistent ID', async () => {
      await request(app.getHttpServer())
        .get('/api/goods-received/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  describe('Validation', () => {
    it('rejects invalid vendor ID (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: '00000000-0000-0000-0000-000000000000',
          locationId: validLocationId,
          lines: [{ productId: appProductId, quantityReceived: '5' }],
        })
        .expect(404);
    });

    it('rejects invalid location ID (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: '00000000-0000-0000-0000-000000000000',
          lines: [{ productId: appProductId, quantityReceived: '5' }],
        })
        .expect(404);
    });

    it('rejects invalid product ID (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          lines: [
            {
              productId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
              quantityReceived: '5',
            },
          ],
        })
        .expect(400);
    });
  });

  // =========================================================================
  // RBAC
  // =========================================================================

  describe('RBAC — viewer cannot create goods receipts', () => {
    it('viewer cannot POST (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          lines: [{ productId: appProductId, quantityReceived: '5' }],
        })
        .expect(403);
    });

    it('viewer CAN read goods receipts (200)', async () => {
      await request(app.getHttpServer())
        .get('/api/goods-received')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });
  });

  // =========================================================================
  // Inventory Impact
  // =========================================================================
  describe('Inventory Impact', () => {
    it('goods receipt into RECV bin does NOT increase available QOH', async () => {
      // Get current inventory for the product specifically
      const beforeRes = await request(app.getHttpServer())
        .get(`/api/inventory?q=${appProductNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const beforeQoh = beforeRes.body.data
        .filter((r: any) => r.productId === appProductId)
        .reduce((sum: number, r: any) => sum + parseFloat(r.quantityOnHand), 0);

      // Create another goods receipt
      await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          lines: [{ productId: appProductId, quantityReceived: '100' }],
        })
        .expect(201);

      // Goods received go into the RECEIVING dock bin, which is excluded
      // from the inventory_levels view. Available QOH should remain unchanged
      // until the goods are put away into a storage bin.
      const afterRes = await request(app.getHttpServer())
        .get(`/api/inventory?q=${appProductNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterQoh = afterRes.body.data
        .filter((r: any) => r.productId === appProductId)
        .reduce((sum: number, r: any) => sum + parseFloat(r.quantityOnHand), 0);

      // Available QOH should be unchanged — goods are in RECEIVING (excluded from availability)
      expect(afterQoh).toBe(beforeQoh);
    });
  });

  // =========================================================================
  // Putaway Lifecycle
  // =========================================================================
  describe('Putaway Lifecycle', () => {
    let putawayGoodsReceivedLineId: string;
    let destinationBinId: string;

    it('fetches pending putaway lines', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/goods-received/lines?putawayStatus=pending_putaway&locationId=${validLocationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);

      // Find the line created in the previous 'Inventory Impact' test (which received 100 units)
      const targetLine = res.body.data.find(
        (l: any) =>
          l.productId === appProductId &&
          parseFloat(l.quantityReceived) === 100,
      );
      expect(targetLine).toBeDefined();
      // Verify it was auto-matched to the PO we created in beforeAll
      expect(targetLine.matchStatus).toBe('matched');
      putawayGoodsReceivedLineId = targetLine.goodsReceivedLineId;
    });

    it('fetches putaway context', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/inventory/putaway-context?locationId=${validLocationId}&productId=${appProductId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('currentQuantity');
      expect(res.body).toHaveProperty('availableBins');
      expect(res.body.availableBins.length).toBeGreaterThan(0);

      // Pick a valid storage bin (must be visible to inventory_levels, e.g. storage, bulk, pick)
      const validBin = res.body.availableBins.find((b: any) =>
        ['storage', 'pick', 'bulk'].includes(b.binType),
      );

      if (!validBin) {
        throw new Error('No valid storage bin found for putaway test');
      }
      destinationBinId = validBin.binId;
    });

    it('executes putaway without discrepancy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/goods-received/putaway')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          putaways: [
            {
              lineId: putawayGoodsReceivedLineId,
              destinationBinId: destinationBinId,
              quantity: '100',
              newTotalQuantity: '100',
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('goods are now available in inventory', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/inventory/by-products?productIds=${appProductId}&locationId=${validLocationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const productStock = res.body.data.find(
        (p: any) => p.productId === appProductId,
      );
      expect(productStock).toBeDefined();
      expect(parseFloat(productStock.quantityOnHand)).toBeGreaterThanOrEqual(
        100,
      );
    });

    it('line is removed from pending putaway list', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/goods-received/lines?putawayStatus=pending_putaway&locationId=${validLocationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const targetLine = res.body.data.find(
        (l: any) => l.goodsReceivedLineId === putawayGoodsReceivedLineId,
      );
      expect(targetLine).toBeUndefined();
    });

    it('executes putaway WITH count discrepancy', async () => {
      // Create another receipt for 50 units (should also be auto-matched)
      const grRes = await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          lines: [{ productId: appProductId, quantityReceived: '50' }],
        })
        .expect(201);

      // Find the new pending line
      const linesRes = await request(app.getHttpServer())
        .get(
          `/api/goods-received/lines?putawayStatus=pending_putaway&locationId=${validLocationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const targetLine = linesRes.body.data.find(
        (l: any) => l.goodsReceivedId === grRes.body.goodsReceivedId,
      );
      expect(targetLine).toBeDefined();
      expect(targetLine.matchStatus).toBe('matched');

      const putawayRes = await request(app.getHttpServer())
        .post('/api/goods-received/putaway')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          putaways: [
            {
              lineId: targetLine.goodsReceivedLineId,
              destinationBinId: destinationBinId,
              quantity: '50',
              newTotalQuantity: '140',
            },
          ],
        })
        .expect(201);

      expect(putawayRes.body.success).toBe(true);

      const finalRes = await request(app.getHttpServer())
        .get(
          `/api/inventory/by-products?productIds=${appProductId}&locationId=${validLocationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const productStock = finalRes.body.data.find(
        (p: any) => p.productId === appProductId,
      );
      expect(productStock).toBeDefined();

      const binBalance = productStock.binBalances.find(
        (b: any) => b.binId === destinationBinId,
      );
      expect(binBalance).toBeDefined();
      expect(binBalance.quantityOnHand).toBe(140);
    });
  });

  // =========================================================================
  // Cancellation Workflow
  // =========================================================================
  describe('Cancellation Workflow', () => {
    let cancelPoId: string;
    let cancelGrId: string;
    let cancelProductId: string;

    it('creates a PO and receives against it', async () => {
      // 0. Create a fresh product so there is exactly 1 open PO for it (unambiguous match)
      const productRes = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productNumber: `E2E-GR-P-${Date.now()}-CAN`,
          name: 'E2E Goods Received Test Product - Cancel',
          listPrice: '25.00',
        })
        .expect(201);
      cancelProductId = productRes.body.productId;

      // 1. Create a PO
      const poRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `PO-CAN-${Date.now()}`,
          vendorId: validVendorId,
          deliveryLocationId: validLocationId,
          currencyCode: 'EUR',
          lines: [
            {
              productId: cancelProductId,
              quantity: '100',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);

      cancelPoId = poRes.body.purchaseOrderId;

      await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${cancelPoId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'ordered' })
        .expect(200);

      // 2. Receive 10 units against the PO
      const grRes = await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          packingSlipNumber: 'PS-CAN-001',
          lines: [{ productId: cancelProductId, quantityReceived: '10' }],
        })
        .expect(201);

      cancelGrId = grRes.body.goodsReceivedId;

      // Ensure it was matched
      expect(grRes.body.lines[0].matchStatus).toBe('matched');
      expect(grRes.body.lines[0].purchaseOrderId).toBe(cancelPoId);
    });

    it('validates PO is partially_received and quantity_received is 10', async () => {
      const poRes = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${cancelPoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(poRes.body.stateCode).toBe('partially_received');
      expect(poRes.body.lines[0].quantityReceived).toBe('10');
    });

    it('cancels the receipt', async () => {
      const cancelRes = await request(app.getHttpServer())
        .post(`/api/goods-received/${cancelGrId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (cancelRes.status !== 201) {
        console.error('CANCEL ERROR:', cancelRes.body);
      }
      expect(cancelRes.status).toBe(201);
    });

    it('validates PO state reverted to ordered and quantity_received is 0', async () => {
      const poRes = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${cancelPoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(poRes.body.stateCode).toBe('ordered');
      expect(poRes.body.lines[0].quantityReceived).toBe('0');
    });

    it('validates goods receipt state is cancelled', async () => {
      const grRes = await request(app.getHttpServer())
        .get(`/api/goods-received/${cancelGrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(grRes.body.stateCode).toBe('cancelled');
    });
  });
});
