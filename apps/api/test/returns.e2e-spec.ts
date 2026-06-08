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
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  RETURN_STATE,
  SALES_ORDER_STATE,
  SALES_CREDIT_NOTE_STATE,
} from '@modbm/shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Sales Order Returns', () => {
  let app: INestApplication;
  let adminToken: string;
  let locationId: string;
  let viewerToken: string;

  let validCustomerId: string;
  let validProductId: string;
  let secondProductId: string;
  let mainLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const db = app.get(DRIZZLE);
    if (process.env.USE_PGLITE !== 'true') {
      await db.execute(sql`
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT sales_order_id FROM modbm_core.sales_orders WHERE name LIKE 'E2E-RET%'
          LOOP
              DELETE FROM modbm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_picks WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.warehouse_events WHERE entity_id IN (SELECT shipment_id FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_invoice_lines WHERE invoice_id IN (SELECT invoice_id FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.backorders WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_picks WHERE sales_order_line_id IN (SELECT sales_order_line_id FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_events WHERE entity_id = r.sales_order_id;
              DELETE FROM modbm_core.outbox WHERE entity_id = r.sales_order_id;
          END LOOP;
      END $$;
    `);
    }

    // Login
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locRes.body[0].locationId;

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      })
      .expect(201);
    viewerToken = viewerLogin.body.access_token;

    // Fetch real IDs
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validCustomerId = customers.body.data[0].customerId;

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    mainLocationId = locations.body[0].locationId;

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId = products.body.data[0].productId;
    secondProductId = products.body.data[1]?.productId ?? validProductId;
  }, 120_000);

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
        fulfillmentLocationId: locationId,

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
    for (const state of [
      SALES_ORDER_STATE.QUOTED,
      SALES_ORDER_STATE.CONFIRMED,
      SALES_ORDER_STATE.PICKING,
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: state, generateBackorders: false })
        .expect(200);
    }

    // Pick all lines individually and create + dispatch shipment
    const binsRes = await request(app.getHttpServer())
      .get('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const binId =
      binsRes.body.data[0]?.binId || '40000000-0000-0000-0000-000000000003';

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const shipLines: any[] = [];
    for (const line of detail.body.lines) {
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${line.salesOrderLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: line.quantity })
        .expect(201);
      shipLines.push({
        salesOrderLineId: line.salesOrderLineId,
        quantityShipped: line.quantity,
      });
    }

    const shipRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/shipments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ lines: shipLines })
      .expect(201);

    // shipped state is auto-transitioned, now transition to invoiced
    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${orderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stateCode: SALES_ORDER_STATE.INVOICED,
        generateBackorders: false,
      })
      .expect(200);

    // Get line IDs
    const detailFinal = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detailFinal.body.lines.map((l: any) => l.salesOrderLineId);
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
      expect(res.body.stateCode).toBe(RETURN_STATE.DRAFT);

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
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.CONFIRMED, generateBackorders: false })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.RECEIVED, locationId: mainLocationId })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/sales-credit-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ returnId })
        .expect(201);

      expect(res.body.stateCode).toBe(SALES_CREDIT_NOTE_STATE.POSTED);

      // Verify return was marked PROCESSED automatically
      const retRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(retRes.body.stateCode).toBe(RETURN_STATE.PROCESSED);
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
