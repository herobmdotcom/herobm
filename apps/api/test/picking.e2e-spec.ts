/**
 * E2E Tests — Picking & Shipments API (Sub-Ledger Architecture)
 *
 * Exercises the new picking model where each pick is recorded in the
 * `sales_order_picks` sub-ledger with explicit bin-level tracking.
 *
 * Run with: npm run test:e2e -- --testPathPatterns picking
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Picking & Shipments (Sub-Ledger)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let locationId: string;
  let validCustomerId: string;
  let validProductId: string;
  let secondProductId: string;
  let db: any;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    db = app.get(DRIZZLE);

    // Clean up prior E2E data
    await db.execute(sql`
      DO $$ 
      DECLARE r RECORD;
      BEGIN
        FOR r IN SELECT sales_order_id FROM modbm_core.sales_orders WHERE name LIKE 'E2E%'
        LOOP
          DELETE FROM modbm_core.sales_order_picks WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
          DELETE FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
          DELETE FROM modbm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.sales_invoice_lines WHERE invoice_id IN (SELECT invoice_id FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id);
          DELETE FROM modbm_core.sales_invoices WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.backorders WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.order_events WHERE sales_order_id = r.sales_order_id;
          DELETE FROM modbm_core.outbox WHERE aggregate_id = r.sales_order_id;
          DELETE FROM modbm_core.sales_orders WHERE sales_order_id = r.sales_order_id;
        END LOOP;
      END $$;
    `);

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
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

    // Fetch location
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locRes.body.data[0].locationId;

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
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Create a fresh order in 'confirmed' state. */
  async function createConfirmedOrder(opts?: {
    lineQtys?: string[];
  }): Promise<{ orderId: string; lineIds: string[] }> {
    const qty1 = opts?.lineQtys?.[0] ?? '10';
    const qty2 = opts?.lineQtys?.[1] ?? '5';

    const res = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,
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
      .expect((r: any) => {
        if (r.status !== 201) console.error('Order creation failed:', r.body);
      })
      .expect(201);

    const orderId = res.body.salesOrderId;

    // Advance: draft → quoted → confirmed
    for (const state of ['quoted', 'confirmed']) {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: state, generateBackorders: false })
        .expect((r: any) => {
          if (r.status !== 200)
            console.error(`State change to ${state} failed:`, r.body);
        })
        .expect(200);
    }

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detail.body.lines.map((l: any) => l.salesOrderLineId);
    return { orderId, lineIds };
  }

  /** Resolve a bin ID for the first available bin at the default location. */
  async function getFirstBinId(): Promise<string> {
    const summary = await request(app.getHttpServer())
      .get('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return summary.body.data[0].binId;
  }

  /** Pick a line via the new POST endpoint. */
  async function pickLine(
    orderId: string,
    lineId: string,
    binId: string,
    quantity: string,
    expectStatus = 201,
  ) {
    return request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/picking/lines/${lineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ binId, quantity })
      .expect((r: any) => {
        if (r.status !== expectStatus) {
          console.error(
            `pickLine expected ${expectStatus}, got ${r.status}:`,
            r.body,
          );
        }
      })
      .expect(expectStatus);
  }

  // =========================================================================
  // Full picking lifecycle via sub-ledger
  // =========================================================================

  describe('Full picking lifecycle', () => {
    let orderId: string;
    let lineIds: string[];
    let binId: string;

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
      binId = await getFirstBinId();
    });

    it('GET /picking — shows unpicked summary on confirmed order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalLines).toBe(2);
      expect(res.body.fullyPickedLines).toBe(0);
      expect(res.body.isFullyPicked).toBe(false);
      expect(res.body.lines[0].remaining).toBe('10');
    });

    it('POST picking/lines/:lineId — partial pick creates sub-ledger record', async () => {
      const res = await pickLine(orderId, lineIds[0], binId, '7');

      expect(res.body).toHaveProperty('pickId');
      expect(res.body.quantity).toBe('7');

      // Verify summary updated
      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.fullyPickedLines).toBe(0);
      const line1 = summary.body.lines.find(
        (l: any) => l.salesOrderLineId === lineIds[0],
      );
      expect(line1.remaining).toBe('3');
      expect(line1.quantityPicked).toBe('7');
    });

    it('auto-transitions order from confirmed to picking on first pick', async () => {
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.stateCode).toBe('picking');
    });

    it('second pick on same line accumulates in sub-ledger', async () => {
      await pickLine(orderId, lineIds[0], binId, '3');

      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const line1 = summary.body.lines.find(
        (l: any) => l.salesOrderLineId === lineIds[0],
      );
      expect(line1.quantityPicked).toBe('10');
      expect(line1.remaining).toBe('0');
      expect(line1.isFullyPicked).toBe(true);
      expect(summary.body.fullyPickedLines).toBe(1);
    });

    it('pick line 2 fully', async () => {
      await pickLine(orderId, lineIds[1], binId, '5');

      const summary = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(summary.body.isFullyPicked).toBe(true);
      expect(summary.body.fullyPickedLines).toBe(2);
    });

    it('picks are recorded in the sales_order_picks sub-ledger', async () => {
      const picks = await db.execute(sql`
        SELECT * FROM modbm_core.sales_order_picks 
        WHERE sales_order_id = ${orderId}
        ORDER BY created_on
      `);

      // 3 picks total: 7 + 3 for line 1, 5 for line 2
      expect(picks.length).toBe(3);
      expect(picks.every((p: any) => p.state_code === 'picked')).toBe(true);
    });

    it('inventory ledger entries created for each pick', async () => {
      const entries = await db.execute(sql`
        SELECT * FROM modbm_core.inventory_entries 
        WHERE source_id = ${orderId} AND source_type = 'SO_PICK'
      `);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].memo).toContain('Sales Order Pick');
    });

    it('shipped BLOCKED when not all lines shipped', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'shipped' })
        .expect(400);

      expect(res.body.message).toContain('not fully shipped');
    });

    it('create shipment, dispatch, and complete lifecycle', async () => {
      const shipRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            { salesOrderLineId: lineIds[0], quantityShipped: '10' },
            { salesOrderLineId: lineIds[1], quantityShipped: '5' },
          ],
        })
        .expect(201);

      expect(shipRes.body).toHaveProperty('shipmentId');

      // Dispatch — should auto-transition order to shipped
      await request(app.getHttpServer())
        .patch(
          `/api/sales-orders/${orderId}/shipments/${shipRes.body.shipmentId}/state`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'dispatched' })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.stateCode).toBe('shipped');
    });
  });

  // =========================================================================
  // Validation guards
  // =========================================================================

  describe('Validation guards', () => {
    let binId: string;

    beforeAll(async () => {
      binId = await getFirstBinId();
    });

    it('rejects pick on draft order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fulfillmentLocationId: locationId,
          customerId: validCustomerId,
          name: 'E2E Draft Guard',
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
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lineId = detail.body.lines[0].salesOrderLineId;

      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/lines/${lineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: '5' })
        .expect(400);
    });

    it('rejects quantity exceeding ordered', async () => {
      const { orderId, lineIds } = await createConfirmedOrder({
        lineQtys: ['3', '2'],
      });

      await pickLine(orderId, lineIds[0], binId, '5', 400);
    });

    it('rejects negative quantity', async () => {
      const { orderId, lineIds } = await createConfirmedOrder();

      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: '-1' })
        .expect(400);
    });

    it('rejects zero quantity', async () => {
      const { orderId, lineIds } = await createConfirmedOrder();

      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: '0' })
        .expect(400);
    });

    it('rejects cumulative picks exceeding ordered quantity', async () => {
      const { orderId, lineIds } = await createConfirmedOrder({
        lineQtys: ['10', '5'],
      });

      // First pick: 7 of 10 — OK
      await pickLine(orderId, lineIds[0], binId, '7');

      // Second pick: 5 more — total would be 12 > 10 — should fail
      await pickLine(orderId, lineIds[0], binId, '5', 400);
    });

    it('rejects shipping more than picked', async () => {
      const { orderId, lineIds } = await createConfirmedOrder({
        lineQtys: ['10', '5'],
      });

      // Pick only 3
      await pickLine(orderId, lineIds[0], binId, '3');

      // Try to ship 5 — should fail
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
  // Shipment document lifecycle
  // =========================================================================

  describe('Shipment document lifecycle', () => {
    let orderId: string;
    let lineIds: string[];
    let shipmentId: string;
    let shipmentLineId: string;

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
      const binId = await getFirstBinId();

      // Pick all lines fully
      await pickLine(orderId, lineIds[0], binId, '10');
      await pickLine(orderId, lineIds[1], binId, '5');
    });

    it('POST /shipments — creates a shipment with lines', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'First batch delivery',
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
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
        .send({ salesOrderLineId: lineIds[1], quantityShipped: '3' })
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
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
      const binId = await getFirstBinId();

      await pickLine(orderId, lineIds[0], binId, '10');
      await pickLine(orderId, lineIds[1], binId, '5');
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
  // RBAC
  // =========================================================================

  describe('RBAC — viewer cannot pick or ship', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('viewer cannot pick a line (403)', async () => {
      const binId = await getFirstBinId();
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/picking/lines/${lineIds[0]}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ binId, quantity: '5' })
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
