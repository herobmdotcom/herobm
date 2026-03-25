/**
 * E2E Tests — Picking & Shipments API
 *
 * These tests exercise picking and shipment endpoints against a real
 * Postgres database. They verify the full picking lifecycle, shipment
 * documents, state gates, and RBAC.
 *
 * Run with: npm run test:e2e -- --testPathPatterns picking
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

describe('API E2E — Picking & Shipments', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  let validCustomerId: string;
  let validProductId: string;
  let secondProductId: string;
  let db: any;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    db = app.get(DRIZZLE);
    await db.execute(sql`
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT sales_order_id FROM modbm_core.sales_orders WHERE name LIKE 'E2E%'
          LOOP
              DELETE FROM modbm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id;
              DELETE FROM modbm_core.sales_invoice_lines WHERE invoice_id IN (SELECT invoice_id FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id);
              DELETE FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id;
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
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
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

    // Fetch real IDs from mart data
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
   * Helper: Create a fresh order and advance to picking state.
   * Returns orderId and line IDs.
   */
  async function createPickingOrder(opts?: {
    lineQtys?: string[];
  }): Promise<{ orderId: string; lineIds: string[] }> {
    const qty1 = opts?.lineQtys?.[0] ?? '10';
    const qty2 = opts?.lineQtys?.[1] ?? '5';

    const res = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: validCustomerId,
        name: 'E2E Picking Test Order',
        lines: [
          {
            productId: validProductId,
            productDescription: 'Product A',
            quantity: qty1,
            pricePerUnit: '25.00',
          },
          {
            productId: secondProductId,
            productDescription: 'Product B',
            quantity: qty2,
            pricePerUnit: '50.00',
          },
        ],
      })
      .expect(201);

    const orderId = res.body.salesOrderId;

    // Advance: draft → quoted → confirmed → picking
    for (const state of ['quoted', 'confirmed', 'picking']) {
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
  // Full picking lifecycle
  // =========================================================================

  describe('Full picking lifecycle', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('GET /api/sales-orders/:id/picking — shows unpicked summary', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalLines).toBe(2);
      expect(res.body.fullyPickedLines).toBe(0);
      expect(res.body.isFullyPicked).toBe(false);
      expect(res.body.lines[0].remaining).toBe('10');
    });

    it('PATCH picking/lines/:lineId — partial pick', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '7' })
        .expect(200);

      expect(res.body.quantityPicked).toBe('7');

      // Verify summary
      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.fullyPickedLines).toBe(0);
      expect(summary.body.lines[0].remaining).toBe('3');
    });

    it('picking → shipped BLOCKED when lines incomplete', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'shipped' })
        .expect(400);

      expect(res.body.message).toContain('not fully shipped');
    });

    it('POST picking/lines/:lineId/pick-all — pick remaining for line 1', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      // Verify line 1 is fully picked
      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.fullyPickedLines).toBe(1);
      expect(summary.body.lines[0].isFullyPicked).toBe(true);
    });

    it('pick line 2 fully', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[1]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '5' })
        .expect(200);

      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.isFullyPicked).toBe(true);
    });

    it('verifies ledger stock movement created for picking', async () => {
      // Direct DB assertion to verify the InventoryLedger entry was created
      const entries = await db.execute(sql`
        SELECT * FROM modbm_core.inventory_entries 
        WHERE source_id = ${orderId} AND source_type = 'SO_PICK'
      `);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].memo).toContain('Sales Order Pick');
    });

    it('picking → shipped ALLOWED when all lines picked and shipped', async () => {
      // Create shipments covering all quantities
      const shipRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            { salesOrderLineId: lineIds[0], quantityShipped: '10' },
            { salesOrderLineId: lineIds[1], quantityShipped: '5' },
          ],
        });

      expect(shipRes.status).toBe(201);
      expect(shipRes.body).toHaveProperty('shipmentId');

      // Dispatch the shipment — this may auto-transition the order to
      // 'shipped' via evaluateLifecycleRules if all lines are fully shipped.
      const dispatchRes = await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${shipRes.body.shipmentId}/state`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'dispatched' });

      expect(dispatchRes.status).toBe(200);

      // Verify the order is now in 'shipped' state (auto-transitioned)
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.stateCode).toBe('shipped');
    });

    it('shipped → invoiced completes lifecycle', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'invoiced' })
        .expect(200);
    });
  });

  // =========================================================================
  // Pick All Order
  // =========================================================================

  describe('Pick All Order (creates shipment)', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('POST picking/pick-all — picks all lines and creates shipment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/pick-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('shipmentId');
      expect(res.body).toHaveProperty('shipmentNumber');

      // Verify all lines picked
      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.isFullyPicked).toBe(true);

      // Verify shipment was created
      const shipments = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(shipments.body).toHaveLength(1);
      expect(shipments.body[0].lines).toHaveLength(2);
    });

    it('can now transition to shipped', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'shipped' })
        .expect(200);
    });
  });

  // =========================================================================
  // Pick All Order — with existing shipments
  // =========================================================================

  describe('Pick All Order (with prior partial shipment)', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('should ship only unshipped quantities when prior shipment exists', async () => {
      // Pick all lines first
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[1]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      // Create a partial shipment: 3 of line 1 only
      const firstShip = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Partial batch',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityShipped: '3',
            },
          ],
        })
        .expect(201);

      expect(firstShip.body).toHaveProperty('shipmentId');

      // Now pick-all-and-ship — should create shipment with remaining quantities
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/pick-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('shipmentId');

      // Fetch the new shipment and verify quantities
      const newShipment = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/shipments/${res.body.shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Line 1: ordered 10, already shipped 3 → should ship 7
      // Line 2: ordered 5, already shipped 0 → should ship 5
      const shipLines = newShipment.body.lines;
      expect(shipLines).toHaveLength(2);

      const line1 = shipLines.find(
        (l: any) => l.salesOrderLineId === lineIds[0],
      );
      const line2 = shipLines.find(
        (l: any) => l.salesOrderLineId === lineIds[1],
      );

      expect(line1).toBeDefined();
      expect(parseFloat(line1.quantityShipped)).toBe(7);

      expect(line2).toBeDefined();
      expect(parseFloat(line2.quantityShipped)).toBe(5);
    });
  });

  // =========================================================================
  // Shipment lifecycle
  // =========================================================================

  describe('Shipment document lifecycle', () => {
    let orderId: string;
    let lineIds: string[];
    let shipmentId: string;
    let shipmentLineId: string;

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;

      // Pick lines first — shipments are constrained by picked qty
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[1]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('POST /shipments — creates a shipment with lines', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'First batch delivery',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityShipped: '5',
            },
          ],
        })
        .expect(201);

      expect(res.body.stateCode).toBe('draft');
      expect(res.body).toHaveProperty('shipmentNumber');
      shipmentId = res.body.shipmentId;
    });

    it('GET /shipments/:id — returns shipment with lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0].quantityShipped).toBe('5');
      shipmentLineId = res.body.lines[0].shipmentLineId;
    });

    it('PATCH /shipments/:id — updates notes on draft', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(res.body.notes).toBe('Updated notes');
    });

    it('POST /shipments/:id/lines — adds a line', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments/${shipmentId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salesOrderLineId: lineIds[1],
          quantityShipped: '3',
        })
        .expect(201);

      expect(res.body).toHaveProperty('shipmentLineId');
    });

    it('PATCH /shipments/:id/lines/:lid — updates line quantity', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${shipmentId}/lines/${shipmentLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityShipped: '8' })
        .expect(200);

      expect(res.body.quantityShipped).toBe('8');
    });

    it('PATCH /shipments/:id/state → dispatched', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/shipments/${shipmentId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'dispatched' })
        .expect(200);

      expect(res.body.stateCode).toBe('dispatched');
    });

    it('rejects mutations on dispatched shipment', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Should fail' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments/${shipmentId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ salesOrderLineId: lineIds[0], quantityShipped: '1' })
        .expect(400);

      await request(app.getHttpServer())
        .delete(
          `/api/sales-orders/${orderId}/shipments/${shipmentId}/lines/${shipmentLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // =========================================================================
  // Cancelled shipment
  // =========================================================================

  describe('Cancelled shipment', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;

      // Pick lines first — shipments are constrained by picked qty
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${lineIds[1]}/pick-all`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('can cancel a draft shipment', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${createRes.body.shipmentId}/state`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(200);

      expect(res.body.stateCode).toBe('cancelled');
    });

    it('cannot transition dispatched → cancelled', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${createRes.body.shipmentId}/state`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'dispatched' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${createRes.body.shipmentId}/state`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(400);
    });
  });

  // =========================================================================
  // State machine guards
  // =========================================================================

  describe('State machine guards', () => {
    it('picking endpoints rejected when order not in picking state', async () => {
      // Create order but leave in draft
      const res = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: validProductId,
              quantity: '10',
              pricePerUnit: '25.00',
            },
          ],
        })
        .expect(201);

      const orderId = res.body.salesOrderId;
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lineId = detail.body.lines[0].salesOrderLineId;

      // Try to pick on a draft order
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '5' })
        .expect(400);

      // Try to create shipment
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [{ salesOrderLineId: lineId, quantityShipped: '5' }],
        })
        .expect(400);

      // Try pick-all order
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/pick-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('rejects quantity exceeding ordered', async () => {
      const { orderId, lineIds } = await createPickingOrder({
        lineQtys: ['3', '2'],
      });

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '5' })
        .expect(400);
    });

    it('rejects negative quantity', async () => {
      const { orderId, lineIds } = await createPickingOrder();

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '-1' })
        .expect(400);
    });

    it('rejects shipping more than picked', async () => {
      const { orderId, lineIds } = await createPickingOrder({
        lineQtys: ['10', '5'],
      });

      // Pick only 3 of line 1
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '3' })
        .expect(200);

      // Try to ship 5 — should fail (only 3 picked)
      const failRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
        })
        .expect(400);

      expect(failRes.body.message).toContain('only 3 available');

      // Ship 3 — should succeed
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '3' }],
        })
        .expect(201);
    });
  });

  // =========================================================================
  // RBAC
  // =========================================================================

  describe('RBAC — viewer cannot pick or ship', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createPickingOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('viewer cannot pick a line (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ quantityPicked: '5' })
        .expect(403);
    });

    it('viewer cannot pick-all (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/pick-all`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('viewer cannot create shipment (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
        })
        .expect(403);
    });

    it('viewer CAN read picking summary (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('viewer CAN read shipments (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });
  });
});
