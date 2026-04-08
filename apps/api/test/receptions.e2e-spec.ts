/**
 * E2E Tests — Purchase Order Receptions API
 *
 * These tests exercise the receptions endpoints on ReceptionsController
 * against a real Postgres database (modbm_core schema). They verify
 * goods receipt creation, listing, detail retrieval, and RBAC enforcement.
 *
 * Run with: npm run test:e2e -- --testPathPatterns receptions
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Purchase Order Receptions', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  let validVendorId: string;
  let appProductId: string; // app-created product (core UUID)
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      })
      .expect(201);
    viewerToken = viewerLogin.body.access_token;

    // Create an app product (core UUID) for use in PO lines
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-REC-P-${Date.now()}`,
        name: 'E2E Reception Test Product',
        listPrice: '15.00',
      })
      .expect(201);
    appProductId = productRes.body.productId;

    // Fetch real supplier
    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validVendorId = suppliers.body.data[0].vendorId;

    // Fetch a base delivery location
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body.data[0].locationId;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  /**
   * Helper: Create a purchase order in 'ordered' state with an app-created product.
   */
  async function createOrderedPO(): Promise<{
    purchaseOrderId: string;
    lineIds: string[];
  }> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    const createRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `E2E-REC-PO-${today}-${rand}`,
        name: 'E2E Reception Test PO',
        vendorId: validVendorId,
        deliveryLocationId: validLocationId,
        currencyCode: 'EUR',
        lines: [
          {
            productId: appProductId,
            productDescription: 'Reception Test Product',
            quantity: '20',
            pricePerUnit: '15.00',
            unitOfMeasure: 'EA',
          },
        ],
      })
      .expect(201);

    const purchaseOrderId = createRes.body.purchaseOrderId;

    // Advance to ordered
    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${purchaseOrderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    // Get line IDs
    const detail = await request(app.getHttpServer())
      .get(`/api/purchase-orders/${purchaseOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detail.body.lines.map((l: any) => l.purchaseOrderLineId);

    return { purchaseOrderId, lineIds };
  }

  // =========================================================================
  // Goods receipt lifecycle
  // =========================================================================

  describe('Goods receipt lifecycle', () => {
    let purchaseOrderId: string;
    let lineIds: string[];
    let receptionId: string;

    beforeAll(async () => {
      const result = await createOrderedPO();
      purchaseOrderId = result.purchaseOrderId;
      lineIds = result.lineIds;
    });

    it('POST /receptions — creates a goods receipt', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${purchaseOrderId}/receptions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchaseOrderId,
          locationId: validLocationId,
          packingSlipNumber: 'PS-001',
          notes: 'First delivery',
          lines: [
            {
              purchaseOrderLineId: lineIds[0],
              quantityReceived: '10',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('receptionId');
      receptionId = res.body.receptionId;
    });

    it('GET /receptions — lists receipts for the PO', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${purchaseOrderId}/receptions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /receptions/:id — retrieves receipt detail', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/purchase-orders/${purchaseOrderId}/receptions/${receptionId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.receptionId).toBe(receptionId);
    });
  });

  // =========================================================================
  // RBAC — viewer cannot create receptions
  // =========================================================================

  describe('RBAC — viewer cannot create receptions', () => {
    let purchaseOrderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createOrderedPO();
      purchaseOrderId = result.purchaseOrderId;
      lineIds = result.lineIds;
    });

    it('viewer cannot create a reception (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${purchaseOrderId}/receptions`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          purchaseOrderId,
          locationId: validLocationId,
          lines: [{ purchaseOrderLineId: lineIds[0], quantityReceived: '5' }],
        })
        .expect(403);
    });

    it('viewer CAN read receptions (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/purchase-orders/${purchaseOrderId}/receptions`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });
  });
});
