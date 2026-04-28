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
import { Test, TestingModule } from '@nestjs/testing';
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
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-GR-P-${Date.now()}`,
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
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body.data[0].locationId;
  }, 30_000);

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
    it('goods receipt INCREASES product QOH in RECV bin', async () => {
      // Get current inventory for the product
      const beforeRes = await request(app.getHttpServer())
        .get(`/api/inventory?q=E2E-GR-P`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const beforeQoh =
        beforeRes.body.data.find((r: any) => r.productId === appProductId)
          ?.quantityOnHand ?? '0';

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

      // Check QOH is increased
      const afterRes = await request(app.getHttpServer())
        .get(`/api/inventory?q=E2E-GR-P`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterQoh =
        afterRes.body.data.find((r: any) => r.productId === appProductId)
          ?.quantityOnHand ?? '0';

      expect(parseFloat(afterQoh)).toBe(parseFloat(beforeQoh) + 100);
    });
  });
});
