/**
 * E2E Tests — Purchase Order Returns API
 *
 * These tests exercise the purchase return endpoints on PurchaseReturnsController
 * against a real Postgres database (modbm_core schema). They verify
 * the return draft creation, fetching, actioning (which does inventory deduction),
 * and RBAC enforcement.
 *
 * Run with: npm run test:e2e -- --testPathPatterns purchase-returns
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Purchase Order Returns', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  let validVendorId: string;
  let appProductId: string;
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

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

    // Create an app product for use in PO lines
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-PRET-P-${Date.now()}`,
        name: 'E2E Purchase Return Test Product',
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

    await request(app.getHttpServer())
      .post(`/api/products/${appProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '15.00',
        minOrderQty: 1,
      })
      .expect(201);

    // Fetch a base delivery location
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body.data[0].locationId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  /**
   * Helper: Create a purchase order, advance to ordered, receive it to make it returnable.
   */
  async function createReceivedPO(): Promise<{
    purchaseOrderId: string;
    lineIds: string[];
  }> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    const createRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderNumber: `E2E-PRET-PO-${today}-${rand}`,
        name: 'E2E Purchase Return Test PO',
        vendorId: validVendorId,
        deliveryLocationId: validLocationId,
        currencyCode: 'EUR',
        lines: [
          {
            productId: appProductId,
            productDescription: 'Return Test Product',
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

    // Receive the items to ensure they are returnable
    await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        locationId: validLocationId,
        packingSlipNumber: 'PS-PRET',
        notes: 'Initial receipt for return test',
        lines: [
          {
            productId: appProductId,
            quantityReceived: '10',
          },
        ],
      })
      .expect(201);

    return { purchaseOrderId, lineIds };
  }

  // =========================================================================
  // Purchase Return lifecycle
  // =========================================================================

  describe('Purchase Return lifecycle', () => {
    let purchaseOrderId: string;
    let lineIds: string[];
    let returnId: string;

    beforeAll(async () => {
      const result = await createReceivedPO();
      purchaseOrderId = result.purchaseOrderId;
      lineIds = result.lineIds;
    });

    it('POST /returns — creates a draft return', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${purchaseOrderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Defective units returned',
          lines: [
            {
              purchaseOrderLineId: lineIds[0],
              quantityReturned: '3',
              returnFee: '15.00',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('returnId');
      expect(res.body).toHaveProperty('stateCode', 'draft');
      returnId = res.body.returnId;
    });

    it('GET /returns — lists returns for the PO', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${purchaseOrderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /returns/:id — retrieves return detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${purchaseOrderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.returnId).toBe(returnId);
      expect(res.body.notes).toBe('Defective units returned');
      expect(res.body.lines[0]).toHaveProperty('quantityReturned', '3');
    });

    it('POST /returns/:id/action — actions the return (deducts inventory)', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/purchase-orders/${purchaseOrderId}/returns/${returnId}/action`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.returnId).toBe(returnId);
      expect(res.body.stateCode).toBe('processed'); // Returns flow immediately marks it as processed
    });
  });

  // =========================================================================
  // RBAC — viewer cannot create returns
  // =========================================================================

  describe('RBAC — viewer cannot create purchase returns', () => {
    let purchaseOrderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createReceivedPO();
      purchaseOrderId = result.purchaseOrderId;
      lineIds = result.lineIds;
    });

    it('viewer cannot create a purchase return (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${purchaseOrderId}/returns`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          notes: 'viewer attempt',
          lines: [{ purchaseOrderLineId: lineIds[0], quantityReturned: '1' }],
        })
        .expect(403);
    });

    it('viewer CAN read purchase returns (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/purchase-orders/${purchaseOrderId}/returns`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });
  });
});

