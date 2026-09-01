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
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import { binContents } from '@herobm/db-schema';
import { parsePickBarcode, CUSTOMER_STATE } from '@herobm/shared';

import request from 'supertest';

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
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    db = app.get(DRIZZLE);

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.ADMIN_PASSWORD })
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
    locationId = locRes.body[0].locationId;

    // Fetch real IDs from mart data
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeCustomer =
      customers.body.data.find(
        (c: any) => c.stateCode === CUSTOMER_STATE.ACTIVE,
      ) || customers.body.data[0];
    validCustomerId = activeCustomer.customerId;

    const p1 = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: 'PICK-P1-' + Date.now(),
        name: 'Pick Test 1',
        baseUom: 'EA',
        productType: 'inventory',
      })
      .expect(201);
    validProductId = p1.body.productId;

    const p2 = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: 'PICK-P2-' + Date.now(),
        name: 'Pick Test 2',
        baseUom: 'EA',
        productType: 'inventory',
      })
      .expect(201);
    secondProductId = p2.body.productId;

    // Seed stock into pickable MAIN-BIN-1 for both products
    const mainBinId = '00000000-0000-4000-8000-000000000003';
    await db
      .insert(binContents)
      .values([
        {
          binId: mainBinId,
          productId: validProductId,
          actualQuantity: '100',
        },
        {
          binId: mainBinId,
          productId: secondProductId,
          actualQuantity: '100',
        },
      ])
      .onConflictDoNothing();
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
        deliveryAddressLine1: '123 E2E Street',
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
      .expect((r) => {
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
        .expect((r) => {
          if (r.status !== 200)
            console.error(`State change to ${state} failed:`, r.body);
        })
        .expect(200);
    }

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detail.body.lines.map(
      (l: { salesOrderLineId: string }) => l.salesOrderLineId,
    );
    return { orderId, lineIds };
  }

  /** Resolve the storage bin ID for picking. Always use the seeded MAIN-BIN-1
   *  storage bin so we never accidentally pick FROM the SHIPPING staging bin
   *  (which would create cancelling ledger entries). */
  async function getFirstBinId(): Promise<string> {
    return '00000000-0000-4000-8000-000000000003'; // MAIN-BIN-1 from test-seed.ts
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
      .expect((r) => {
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
        (l: { salesOrderLineId: string }) => l.salesOrderLineId === lineIds[0],
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
        (l: { salesOrderLineId: string }) => l.salesOrderLineId === lineIds[0],
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
      const res = await db.execute(sql`
        SELECT * FROM herobm_core.sales_order_picks 
        WHERE sales_order_id = ${orderId}
        ORDER BY created_on
      `);
      const picks = res.rows || res;

      // 3 picks total: 7 + 3 for line 1, 5 for line 2
      expect(picks.length).toBe(3);
      expect(
        picks.every((p: { state_code: string }) => p.state_code === 'picked'),
      ).toBe(true);
    });

    it('inventory ledger entries created for each pick', async () => {
      const res = await db.execute(sql`
        SELECT * FROM herobm_core.inventory_entries 
        WHERE source_id = ${orderId} AND source_type = 'SO_PICK'
      `);
      const entries = res.rows || res;

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

      // Dispatch is automatic on creation — should auto-transition order to shipped

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
          deliveryAddressLine1: '123 E2E Street',
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

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
      const binId = await getFirstBinId();

      // Pick all lines fully
      await pickLine(orderId, lineIds[0], binId, '10');
      await pickLine(orderId, lineIds[1], binId, '5');
    });

    it('POST /shipments — creates a shipment natively as dispatched', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'First batch delivery',
          lines: [{ salesOrderLineId: lineIds[0], quantityShipped: '5' }],
        })
        .expect(201);

      expect(res.body.stateCode).toBe('dispatched');
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
    });

    it('PATCH /shipments/:id — updates notes', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(res.body.notes).toBe('Updated notes');
    });

    it('rejects line mutations on dispatched shipment', async () => {
      // Get the existing shipment line id to test remove
      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const shipmentLineId = detail.body.lines[0].shipmentLineId;

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
  // Cancellation Workflow
  // =========================================================================

  describe('Cancellation Workflow', () => {
    let orderId: string;
    let lineIds: string[];
    let shipmentId: string;

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
      const binId = await getFirstBinId();

      await pickLine(orderId, lineIds[0], binId, '10');
      await pickLine(orderId, lineIds[1], binId, '5');
    });

    it('rejects transitioning to cancelled via PATCH state endpoint', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            { salesOrderLineId: lineIds[0], quantityShipped: '10' },
            { salesOrderLineId: lineIds[1], quantityShipped: '5' },
          ],
        })
        .expect(201);

      shipmentId = createRes.body.shipmentId;

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/shipments/${shipmentId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(400); // Bad Request
    });

    it('POST /cancel correctly cancels the shipment', async () => {
      // Order should be 'shipped' before cancellation because we shipped everything
      const detailBefore = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detailBefore.body.stateCode).toBe('shipped');

      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/shipments/${shipmentId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((r) => {
          if (r.status !== 201) console.error(r.body);
        })
        .expect(201);

      expect(res.body.stateCode).toBe('cancelled');

      // Check that the order reverted back to 'picking' because the shipment was cancelled
      const detailAfter = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detailAfter.body.stateCode).toBe('picking');
    });
  });

  // =========================================================================
  // Scan-to-Pick Barcode Round-Trip (Producer & Consumer)
  // =========================================================================

  describe('Scan-to-Pick Barcode Round-Trip (Producer & Consumer)', () => {
    let orderId: string;
    let lineIds: string[];

    beforeAll(async () => {
      const result = await createConfirmedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('Producer: generates scan-to-pick barcodes via GET /picking/barcodes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking/barcodes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const barcodeItem = res.body[0];
      expect(barcodeItem.salesOrderId).toBe(orderId);
      expect(barcodeItem.salesOrderLineId).toBe(lineIds[0]);
      expect(barcodeItem.barcodePayload).toMatch(
        /^PICK:[a-f0-9-]+:[a-f0-9-]+:[a-f0-9-]+:\d+(\.\d+)?$/,
      );
    });

    it('Consumer: parses barcode payload and executes pick via POST /picking/lines/:lineId', async () => {
      // 1. Fetch generated barcodes from API (Producer)
      const barcodesRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking/barcodes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const barcodeItem = barcodesRes.body[0];
      const scannedRawBarcode = barcodeItem.barcodePayload;

      // 2. Client-side consumer parses the scanned barcode
      const parsed = parsePickBarcode(scannedRawBarcode);
      expect(parsed).not.toBeNull();
      expect(parsed!.orderId).toBe(orderId);
      expect(parsed!.lineId).toBe(lineIds[0]);
      expect(parsed!.binId).toBe(barcodeItem.binId);

      // 3. Dispatch pick operation using parsed parameters
      const pickRes = await pickLine(
        parsed!.orderId,
        parsed!.lineId,
        parsed!.binId,
        parsed!.quantity,
      );

      expect(pickRes.body).toHaveProperty('pickId');
      expect(pickRes.body.salesOrderLineId).toBe(lineIds[0]);
      expect(parseFloat(pickRes.body.quantity)).toBe(
        parseFloat(parsed!.quantity),
      );

      // 4. Verify picking summary reflects the picked state
      const summaryRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/picking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const pickedLine = summaryRes.body.lines.find(
        (l: { salesOrderLineId: string }) => l.salesOrderLineId === lineIds[0],
      );
      expect(pickedLine).toBeDefined();
      expect(parseFloat(pickedLine.quantityPicked)).toBeGreaterThan(0);
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
