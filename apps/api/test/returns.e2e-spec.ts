/**
 * E2E Tests — Sales Order Returns API
 *
 * These tests exercise the return endpoints on OrderReturnsController against
 * a real Postgres database (modbm_core schema). They verify the full return
 * lifecycle: create, update, add/update/remove lines, state transitions, and
 * RBAC enforcement.
 *
 * Run with: npm run test:e2e -- --testPathPatterns returns
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Sales Order Returns', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  let validCustomerId: string;
  let validProductId: string;
  let secondProductId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const db = app.get(DRIZZLE);
    await db.execute(sql`
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT sales_order_id FROM modbm_core.sales_orders WHERE name LIKE 'E2E-RET%'
          LOOP
              DELETE FROM modbm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.order_events WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.outbox WHERE aggregate_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_orders WHERE sales_order_id = r.sales_order_id;
          END LOOP;
      END $$;
    `);

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

    // Fetch real IDs
    const accounts = await request(app.getHttpServer())
      .get('/api/accounts?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validCustomerId = accounts.body.data[0].accountId;

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId = products.body.data[0].productId;
    secondProductId = products.body.data[1]?.productId ?? validProductId;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  /**
   * Helper: Create an order, advance to invoiced state, and return order + line IDs.
   * Returns require the order to be in 'invoiced' state.
   */
  async function createInvoicedOrder(): Promise<{
    orderId: string;
    lineIds: string[];
  }> {
    const res = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: validCustomerId,
        name: 'E2E-RET Test Order',
        lines: [
          {
            productId: validProductId,
            productDescription: 'Product A',
            quantity: '10',
            pricePerUnit: '25.00',
          },
          {
            productId: secondProductId,
            productDescription: 'Product B',
            quantity: '5',
            pricePerUnit: '50.00',
          },
        ],
      })
      .expect(201);

    const orderId = res.body.salesOrderId;

    // Advance: draft → quoted → confirmed → picking → shipped → invoiced
    for (const state of ['quoted', 'confirmed', 'picking']) {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: state })
        .expect(200);
    }

    // Pick all and ship
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/picking/pick-all`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    for (const state of ['shipped', 'invoiced']) {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: state })
        .expect(200);
    }

    // Get line IDs
    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}?source=app`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detail.body.lines.map((l: any) => l.salesOrderLineId);
    return { orderId, lineIds };
  }

  // =========================================================================
  // Full return lifecycle
  // =========================================================================

  describe('Full return lifecycle', () => {
    let orderId: string;
    let lineIds: string[];
    let returnId: string;
    let returnLineId: string;

    beforeAll(async () => {
      const result = await createInvoicedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('POST /returns — creates a return document', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Customer reported damage',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityReturned: '3',
              reason: 'Damaged in transit',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('returnId');
      expect(res.body).toHaveProperty('returnNumber');
      expect(res.body.stateCode).toBe('draft');

      returnId = res.body.returnId;
    });

    it('GET /returns — lists returns for the order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /returns/:returnId — retrieves return detail with lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.returnId).toBe(returnId);
      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0].quantityReturned).toBe('3');
    });

    it('PATCH /returns/:returnId — updates return notes', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated: confirmed damage on inspection' })
        .expect(200);

      expect(res.body.notes).toBe('Updated: confirmed damage on inspection');
    });

    it('POST /returns/:returnId/lines — adds a second return line', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns/${returnId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salesOrderLineId: lineIds[1],
          quantityReturned: '2',
          reason: 'Wrong item sent',
        })
        .expect(201);

      expect(res.body).toHaveProperty('returnLineId');
      returnLineId = res.body.returnLineId;
    });

    it('PATCH /returns/:returnId/lines/:lineId — updates return line', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/returns/${returnId}/lines/${returnLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityReturned: '4', reason: 'Updated reason' })
        .expect(200);

      expect(res.body.quantityReturned).toBe('4');
    });

    it('DELETE /returns/:returnId/lines/:lineId — removes a return line', async () => {
      await request(app.getHttpServer())
        .delete(
          `/api/sales-orders/${orderId}/returns/${returnId}/lines/${returnLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify return is back to 1 line
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.lines).toHaveLength(1);
    });

    it('PATCH /returns/:returnId/state — confirms then processes the return', async () => {
      // Return state machine: draft → confirmed → processed
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'confirmed' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'processed' })
        .expect(200);

      expect(res.body.stateCode).toBe('processed');
    });
  });

  // =========================================================================
  // RBAC — viewer cannot create returns
  // =========================================================================

  describe('RBAC — viewer cannot create returns', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createInvoicedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('viewer cannot create a return (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityReturned: '1' }],
        })
        .expect(403);
    });

    it('viewer CAN read returns (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });
  });
});
