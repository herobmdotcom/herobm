/**
 * E2E Tests — Sales Portal Write API
 *
 * These tests exercise the write endpoints on OrdersController against a real
 * Postgres database (modbm_core schema). They verify RBAC enforcement, the
 * full order lifecycle, line management, validation errors, and event sourcing.
 *
 * Run with: npm run test:e2e -- --testPathPatterns orders-write
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

describe('API E2E — Sales Portal Write Endpoints', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  // IDs captured from mart data for creating test orders
  let validCustomerId: string;
  let validProductId: string;
  let secondProductId: string;
  let thirdProductId: string;

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

    // Login as admin (has orders:write)
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Login as viewer (read-only)
    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'viewer', password: process.env.DEV_VIEWER_PASSWORD })
      .expect(201);
    viewerToken = viewerLogin.body.access_token;

    // Fetch real IDs from mart data
    const accounts = await request(app.getHttpServer())
      .get('/api/accounts?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validCustomerId = accounts.body.data[0].accountId;

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=3')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId = products.body.data[0].productId;
    secondProductId = products.body.data[1]?.productId ?? validProductId;
    thirdProductId = products.body.data[2]?.productId ?? validProductId;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // RBAC enforcement
  // =========================================================================

  describe('RBAC — write permission enforcement', () => {
    it('viewer cannot create orders (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: validProductId,
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(403);
    });

    it('unauthenticated request returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/sales-orders')
        .send({
          customerId: validCustomerId,
          lines: [],
        })
        .expect(401);
    });
  });

  // =========================================================================
  // Full order lifecycle
  // =========================================================================

  describe('Full order lifecycle', () => {
    let orderId: string;
    let orderNumber: string;
    let firstLineId: string;
    let addedLineId: string;

    it('POST /api/sales-orders — creates a new order in draft state', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          name: 'E2E Test Order',
          notes: 'Created by E2E test suite',
          lines: [
            {
              productId: validProductId,
              productDescription: 'Test Product A',
              quantity: '10',
              pricePerUnit: '25.50',
              discountPercentage: '5',
              tax: '12.13',
            },
            {
              productId: secondProductId,
              productDescription: 'Test Product B',
              quantity: '3',
              pricePerUnit: '100.00',
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('salesOrderId');
      expect(res.body).toHaveProperty('orderNumber');
      expect(res.body.stateCode).toBe('draft');
      expect(res.body.name).toBe('E2E Test Order');

      orderId = res.body.salesOrderId;
      orderNumber = res.body.orderNumber;
    });

    it('GET /api/sales-orders/:id?source=app — retrieves the order with lines and events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.salesOrderId).toBe(orderId);
      expect(res.body.orderNumber).toBe(orderNumber);
      expect(res.body.lines).toHaveLength(2);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].eventType).toBe('created');

      // Verify line amount was computed correctly
      const lineA = res.body.lines.find(
        (l: any) => l.productDescription === 'Test Product A',
      );
      expect(lineA).toBeDefined();
      // 10 × 25.50 × (1 − 0.05) = 242.25
      expect(parseFloat(lineA.amount)).toBeCloseTo(242.25, 2);
      const expectedTotal = 242.25 + parseFloat(lineA.tax || '0');
      expect(parseFloat(lineA.totalAmount)).toBeCloseTo(expectedTotal, 2);

      firstLineId = res.body.lines[0].salesOrderLineId;
    });

    // NOTE: Legacy PDF report routes (sales-quote-report, sales-invoice-report)
    // were removed during the Typst migration. PDF generation is now handled
    // by the dynamic reports engine: POST /api/reports/hooks/:hookSlug/run

    it('PATCH /api/sales-orders/:id — updates order header', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Order — Updated',
          customerOrderNumber: 'CUST-PO-12345',
        })
        .expect(200);

      expect(res.body.name).toBe('E2E Test Order — Updated');
      expect(res.body.customerOrderNumber).toBe('CUST-PO-12345');
    });

    it('POST /api/sales-orders/:id/lines — adds a third line', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: thirdProductId,
          productDescription: 'Test Product C',
          quantity: '7',
          pricePerUnit: '15.00',
        })
        .expect(201);

      expect(res.body).toHaveProperty('salesOrderLineId');
      expect(res.body.lineNumber).toBe(3);
      addedLineId = res.body.salesOrderLineId;
    });

    it('PATCH /api/sales-orders/:id/lines/:lineId — updates a line', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/lines/${addedLineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: '14', pricePerUnit: '15.00' })
        .expect(200);

      // 14 × 15.00 = 210.00
      expect(parseFloat(res.body.amount)).toBeCloseTo(210.0, 2);
    });

    it('DELETE /api/sales-orders/:id/lines/:lineId — removes a line', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sales-orders/${orderId}/lines/${addedLineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify line count is back to 2
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.lines).toHaveLength(2);
    });

    it('PATCH /api/sales-orders/:id/state — transitions through the full lifecycle', async () => {
      const transitions = [
        'quoted',
        'confirmed',
        'picking',
        'shipped',
        'invoiced',
      ];

      for (const nextState of transitions) {
        if (nextState === 'shipped') {
          await request(app.getHttpServer())
            .post(`/api/sales-orders/${orderId}/picking/pick-all`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(201);
        }

        const res = await request(app.getHttpServer())
          .patch(`/api/sales-orders/${orderId}/state`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ stateCode: nextState })
          .expect(200);
        expect(res.body.stateCode).toBe(nextState);
      }
    });

    it('event log captures the full history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const eventTypes = res.body.events.map((e: any) => e.eventType);
      expect(eventTypes).toContain('created');
      expect(eventTypes).toContain('updated');
      expect(eventTypes).toContain('line_added');
      expect(eventTypes).toContain('line_updated');
      expect(eventTypes).toContain('line_removed');
      expect(eventTypes).toContain('status_changed');

      // Should have 5 status_changed events
      const statusChanges = res.body.events.filter(
        (e: any) => e.eventType === 'status_changed',
      );
      expect(statusChanges).toHaveLength(5);
    });
  });

  // =========================================================================
  // Validation & error handling
  // =========================================================================

  describe('Validation & error handling', () => {
    let draftOrderId: string;

    beforeAll(async () => {
      // Create a fresh draft order for validation tests
      const res = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: validProductId,
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);
      draftOrderId = res.body.salesOrderId;
    });

    it('create with unknown customer returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: 'NONEXISTENT-CUSTOMER-ID',
          lines: [
            {
              productId: validProductId,
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(400);
    });

    it('create with unknown product returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: 'NONEXISTENT-PRODUCT-ID',
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(400);
    });

    it('invalid state transition returns 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${draftOrderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'shipped' })
        .expect(400);

      expect(res.body.message).toContain('Cannot transition');
    });

    it('unknown state name returns 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${draftOrderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'bogus' })
        .expect(400);
    });

    it('update on invoiced order returns 400', async () => {
      // First move our draft order to invoiced state
      const invoicedOrder = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: validProductId,
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);

      const invoicedId = invoicedOrder.body.salesOrderId;

      // Move through lifecycle to invoiced
      for (const state of [
        'quoted',
        'confirmed',
        'picking',
        'shipped',
        'invoiced',
      ]) {
        if (state === 'shipped') {
          await request(app.getHttpServer())
            .post(`/api/sales-orders/${invoicedId}/picking/pick-all`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(201);
        }

        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${invoicedId}/state`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ stateCode: state })
          .expect(200);
      }

      // Now try to update it
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${invoicedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Should fail' })
        .expect(400);
    });

    it('add line to cancelled order returns 400', async () => {
      // Create and cancel an order
      const res = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            {
              productId: validProductId,
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${res.body.salesOrderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(200);

      // Try adding a line — should fail
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${res.body.salesOrderId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: validProductId,
          quantity: '1',
          pricePerUnit: '10.00',
        })
        .expect(400);
    });

    it('unknown order ID returns 404', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/sales-orders/00000000-0000-0000-0000-000000000000?source=app',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('create with duplicate products returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          lines: [
            { productId: validProductId, quantity: '1', pricePerUnit: '10.00' },
            { productId: validProductId, quantity: '2', pricePerUnit: '10.00' },
          ],
        })
        .expect(400);
    });

    it('add duplicate product as new line returns 400', async () => {
      // Order created in beforeAll already has validProductId
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${draftOrderId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: validProductId,
          quantity: '5',
          pricePerUnit: '10.00',
        })
        .expect(400);
    });
  });

  // =========================================================================
  // App order listing
  // =========================================================================

  describe('App order listing', () => {
    it('GET /api/sales-orders?source=app — returns app-created orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-orders?source=app')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      // We created orders in previous tests, should have at least 1
      expect(res.body.data.length).toBeGreaterThan(0);
      // Verify the listing contains our app-created orders
      const appOrders = res.body.data.filter(
        (o: any) => o.source === 'app' || o.orderNumber?.startsWith('ORD-'),
      );
      expect(appOrders.length).toBeGreaterThan(0);
      expect(appOrders[0]).toHaveProperty('id');
      expect(appOrders[0]).toHaveProperty('orderNumber');
    });
  });
});
