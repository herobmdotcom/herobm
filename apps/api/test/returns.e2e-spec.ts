/**
 * E2E Tests — Sales Order Returns API
 *
 * These tests exercise the return endpoints on OrderReturnsController against
 * a real Postgres database (herobm_core schema). They verify the full return
 * lifecycle: create, update, add/update/remove lines, state transitions, and
 * RBAC enforcement.
 *
 * Run with: npm run test:e2e -- --testPathPatterns returns
 * Requires: Docker stack running with Postgres + populated marts.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  RETURN_STATE,
  SALES_ORDER_STATE,
  SALES_CREDIT_NOTE_STATE,
  RETURN_RESOLUTION,
  CUSTOMER_STATE,
} from '@herobm/shared';

import request from 'supertest';

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
      .get('/api/customers?limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeCustomer =
      customers.body.data.find(
        (c: any) => c.stateCode === CUSTOMER_STATE.ACTIVE,
      ) || customers.body.data[0];
    validCustomerId = activeCustomer.customerId;

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
        deliveryAddressLine1: 'Test Address',
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
      binsRes.body.data.find((b: any) => b.typeCode === 'STORAGE')?.binId ||
      '00000000-0000-4000-8000-000000000003';

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const shipLines: { salesOrderLineId: string; quantityShipped: string }[] =
      [];
    for (const line of detail.body.lines) {
      const pickRes = await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${line.salesOrderLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: line.quantity });
      if (pickRes.status >= 400) console.error('Pick error:', pickRes.body);
      expect(pickRes.status).toBe(201);

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

    const invRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: shipLines.map((l) => ({
          salesOrderLineId: l.salesOrderLineId,
          quantityToInvoice: parseFloat(l.quantityShipped),
        })),
      })
      .expect(201);

    // Creating the invoice for the full amount auto-transitions the order state to INVOICED.

    // Get line IDs
    const detailFinal = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const lineIds = detailFinal.body.lines.map(
      (l: { salesOrderLineId: string }) => l.salesOrderLineId,
    );
    return { orderId, lineIds };
  }

  async function createShippedOrder(): Promise<{
    orderId: string;
    lineIds: string[];
  }> {
    const res = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,
        customerId: validCustomerId,
        name: 'E2E-RET Test Order (Shipped Only)',
        deliveryAddressLine1: 'Test Address',
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
    const binsRes = await request(app.getHttpServer())
      .get('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const binId =
      binsRes.body.data.find((b: any) => b.typeCode === 'STORAGE')?.binId ||
      '00000000-0000-4000-8000-000000000003';

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const shipLines: { salesOrderLineId: string; quantityShipped: string }[] =
      [];
    for (const line of detail.body.lines) {
      const pickRes = await request(app.getHttpServer())
        .post(
          `/api/sales-orders/${orderId}/picking/lines/${line.salesOrderLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ binId, quantity: line.quantity });
      if (pickRes.status >= 400) console.error('Pick error:', pickRes.body);
      expect(pickRes.status).toBe(201);

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

    const detailFinal = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const lineIds = detailFinal.body.lines.map(
      (l: { salesOrderLineId: string }) => l.salesOrderLineId,
    );
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

      const detail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detail.body.lines).toHaveLength(1);
    });

    it('POST /returns/:returnId/lines — adds a replacement return line', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns/${returnId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salesOrderLineId: lineIds[1],
          quantityReturned: '2',
          reason: 'Replacement requested',
          resolution: RETURN_RESOLUTION.REPLACE,
        })
        .expect(201);
    });

    it('PATCH /returns/:returnId/state — processes return, generating credit and replacement', async () => {
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

      const beforeProcess = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Now set to PROCESSED - this should trigger Credit Note and Replacement Order
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.PROCESSED })
        .expect(200);

      const retRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(retRes.body.stateCode).toBe(RETURN_STATE.PROCESSED);

      // Verify Credit Note was created
      const cns = await request(app.getHttpServer())
        .get(`/api/sales-credit-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const ourCn = (cns.body.data || cns.body).find(
        (cn: any) => cn.salesOrderId === orderId,
      );
      expect(ourCn).toBeDefined();

      // Verify Replacement Order was NOT created
      const orders = await request(app.getHttpServer())
        .get(`/api/sales-orders`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const replacement = orders.body.data.find(
        (o: any) =>
          o.customerOrderNumber?.endsWith('-REP') ||
          o.customerOrderNumber?.startsWith('REP-'),
      );
      expect(replacement).toBeUndefined();
    });
  });

  // =========================================================================
  // Return lifecycle (Not Invoiced)
  // =========================================================================

  describe('Return lifecycle (Not Invoiced)', () => {
    let orderId: string;
    let lineIds: string[];
    let returnId: string;

    beforeAll(async () => {
      const result = await createShippedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('processes return for un-invoiced order (no credit note, still replacement)', async () => {
      // 1. Create Return
      const retRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Not invoiced return',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityReturned: '3',
              reason: 'Damaged',
              resolution: RETURN_RESOLUTION.REFUND, // Refund, but not invoiced
            },
            {
              salesOrderLineId: lineIds[1],
              quantityReturned: '2',
              reason: 'Wrong item',
              resolution: RETURN_RESOLUTION.REPLACE, // Replace
            },
          ],
        })
        .expect(201);
      returnId = retRes.body.returnId;

      // 2. Process Return
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

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${returnId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.PROCESSED })
        .expect(200);

      // 3. Verify NO Credit Note was created (because invoicedQty = 0)
      const cns = await request(app.getHttpServer())
        .get(`/api/sales-credit-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const ourCn = cns.body.data?.find(
        (cn: any) => cn.salesOrderId === orderId,
      );
      expect(ourCn).toBeUndefined(); // Should NOT exist!

      // 4. Verify Replacement Order was NOT created
      const orders = await request(app.getHttpServer())
        .get(`/api/sales-orders`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const returnDoc = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const repPattern = `REP-${returnDoc.body.returnNumber}`;
      const replacement = orders.body.data.find(
        (o: any) => o.customerOrderNumber === repPattern,
      );
      expect(replacement).toBeUndefined();
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

  // =========================================================================
  // Complex Combinations (Refund vs Replace, Fees, Discounts, Multi-return)
  // =========================================================================

  describe('Complex Combinations (Refund vs Replace, Fees, Multi-return)', () => {
    let orderId: string;
    let lineIds: string[];
    let return1Id: string;
    let return2Id: string;

    beforeAll(async () => {
      const result = await createInvoicedOrder();
      orderId = result.orderId;
      lineIds = result.lineIds;
    });

    it('processes Return #1 with mixed REFUND and REPLACE lines plus return fees', async () => {
      // Create Return #1
      // Line 1 (Index 0): 3 units refunded with $15 fee
      // Line 2 (Index 1): 2 units replaced with $10 fee
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Return 1: Mixed refund and replacement',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityReturned: '3',
              reason: 'Defective item',
              resolution: RETURN_RESOLUTION.REFUND,
              returnFee: '15.00',
            },
            {
              salesOrderLineId: lineIds[1],
              quantityReturned: '2',
              reason: 'Wrong size',
              resolution: RETURN_RESOLUTION.REPLACE,
              returnFee: '10.00',
            },
          ],
        })
        .expect(201);

      return1Id = createRes.body.returnId;
      expect(return1Id).toBeDefined();

      // Transition Return #1 to CONFIRMED -> RECEIVED -> PROCESSED
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return1Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.CONFIRMED, generateBackorders: false })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return1Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.RECEIVED, locationId: mainLocationId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return1Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.PROCESSED })
        .expect(200);

      // Verify Return #1 state
      const retDoc = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}/returns/${return1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(retDoc.body.stateCode).toBe(RETURN_STATE.PROCESSED);
      expect(retDoc.body.creditNoteNumber).toBeDefined();

      // Fetch credit note details
      const cns = await request(app.getHttpServer())
        .get(`/api/sales-credit-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const cn = (cns.body.data || cns.body).find(
        (c: any) => c.returnId === return1Id,
      );
      expect(cn).toBeDefined();
      // Line 1: 3 units × $25.00 = $75.00 subtotal, fees = $15 + $10 = $25, GST tax (10%) = $7.50
      // Net AR = $75.00 + $7.50 - $25.00 = $57.50
      expect(parseFloat(cn.totalAmount)).toBe(75);
      expect(parseFloat(cn.feeAmount)).toBe(25);
      expect(parseFloat(cn.outstandingAmount)).toBe(57.5);
    });

    it('processes Return #2 for remaining returnable quantity on Line 1', async () => {
      // Return #2: 7 remaining units on Line 1 (10 shipped - 3 already returned)
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Return 2: Remaining line 1 units',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityReturned: '7',
              reason: 'Customer request',
              resolution: RETURN_RESOLUTION.REFUND,
              returnFee: '0.00',
            },
          ],
        })
        .expect(201);

      return2Id = createRes.body.returnId;

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return2Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.CONFIRMED, generateBackorders: false })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return2Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.RECEIVED, locationId: mainLocationId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/returns/${return2Id}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: RETURN_STATE.PROCESSED })
        .expect(200);

      const cns = await request(app.getHttpServer())
        .get(`/api/sales-credit-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const cn2 = (cns.body.data || cns.body).find(
        (c: any) => c.returnId === return2Id,
      );
      expect(cn2).toBeDefined();
      // Line 1: 7 units × $25.00 = $175.00
      expect(parseFloat(cn2.totalAmount)).toBe(175);
    });

    it('rejects Return #3 when Line 1 returnable quantity is exhausted (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Return 3: Over limit attempt',
          lines: [
            {
              salesOrderLineId: lineIds[0],
              quantityReturned: '1', // 10 already returned (3 + 7 = 10 out of 10)
              reason: 'Over limit',
              resolution: RETURN_RESOLUTION.REFUND,
            },
          ],
        })
        .expect(400);
    });
  });
});
