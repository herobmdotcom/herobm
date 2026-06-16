import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  CUSTOMER_STATE,
  PRODUCT_STATE,
  SALES_ORDER_STATE,
} from '@herobm/shared';

import request from 'supertest';

describe('Audit Events (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let locationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Clean up stale E2E data to prevent order number collisions
    const db = app.get(DRIZZLE);
    if (process.env.USE_PGLITE !== 'true') {
      await db.execute(sql`
      DO $$ 
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT sales_order_id FROM herobm_core.sales_orders WHERE name LIKE 'E2E%'
          LOOP
              DELETE FROM herobm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM herobm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.sales_credit_note_lines WHERE credit_note_id IN (SELECT credit_note_id FROM herobm_core.sales_credit_notes WHERE return_id IN (SELECT return_id FROM herobm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id));
              DELETE FROM herobm_core.sales_credit_notes WHERE return_id IN (SELECT return_id FROM herobm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;
              DELETE FROM herobm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM herobm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.warehouse_events WHERE entity_id IN (SELECT shipment_id FROM herobm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.sales_order_shipments WHERE sales_order_id = r.sales_order_id;
              DELETE FROM herobm_core.sales_invoice_lines WHERE invoice_id IN (SELECT invoice_id FROM herobm_core.sales_invoices WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.sales_invoices WHERE sales_order_id = r.sales_order_id;
              DELETE FROM herobm_core.backorders WHERE sales_order_id = r.sales_order_id;
              DELETE FROM herobm_core.sales_order_picks WHERE sales_order_line_id IN (SELECT sales_order_line_id FROM herobm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id);
              DELETE FROM herobm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id;
              DELETE FROM herobm_core.sales_events WHERE entity_id = r.sales_order_id;
              DELETE FROM herobm_core.outbox WHERE entity_id = r.sales_order_id;
              DELETE FROM herobm_core.sales_orders WHERE sales_order_id = r.sales_order_id;
          END LOOP;
      END $$;
    `);
    }

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    if (adminRes.status !== 201) {
      throw new Error(
        `${'adminRes'} login failed: ${adminRes.status} ${JSON.stringify(adminRes.body)}`,
      );
    }
    adminToken = adminRes.body.access_token;
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locRes.body[0].locationId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Customer Audit', () => {
    let customerId: string;

    it('should record a clean diff for name change', async () => {
      // 1. Create customer
      const createRes = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          billingAddressCountry: 'AU',
          customerNumber: `AUDIT-CUST-${Date.now()}`,
          name: 'Original Name',
        });
      customerId = createRes.body.customerId;

      // 2. Update name
      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      // 3. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const events = res.body.events;
      const updatedEvent = events.find(
        (e: { eventType: string }) => e.eventType === 'updated',
      );

      expect(updatedEvent).toBeDefined();
      expect(updatedEvent.payload.changes).toEqual({ name: 'Updated Name' });
      expect(updatedEvent.payload.previousValues).toEqual({
        name: 'Original Name',
      });
    });

    it('should only log changed fields (strict diff)', async () => {
      // 1. Update notes while sending name (same value)
      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
          notes: 'New Note',
        });

      // 2. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Filter for the SECOND update event (the one with the note)
      const noteEvent = res.body.events.find(
        (e: { eventType: string; payload: { changes: { notes?: string } } }) =>
          e.eventType === 'updated' && e.payload.changes.notes === 'New Note',
      );

      expect(noteEvent).toBeDefined();
      expect(noteEvent.payload.changes).toEqual({ notes: 'New Note' });
      expect(Object.keys(noteEvent.payload.changes)).toHaveLength(1);
    });

    it('should record specialized status_changed event', async () => {
      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: CUSTOMER_STATE.INACTIVE });

      const res = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const statusEvent = res.body.events.find(
        (e: { eventType: string }) => e.eventType === 'status_changed',
      );
      expect(statusEvent).toBeDefined();
      expect(statusEvent.payload).toEqual({
        from: CUSTOMER_STATE.ACTIVE,
        to: CUSTOMER_STATE.INACTIVE,
      });
    });
  });

  describe('Order Audit', () => {
    let orderId: string;

    it('should record clean diff for order name change', async () => {
      // 1. Find or create customer (needed for order)
      const custRes = await request(app.getHttpServer())
        .get('/api/customers?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      const customerId = custRes.body.data[0].customerId;

      // 2. Create draft order
      const createRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryAddressLine1: '123 E2E Street',
          fulfillmentLocationId: locationId,
          customerId,
          name: 'E2E Audit Order',
          lines: [],
        });
      orderId = createRes.body.salesOrderId;

      // 3. Update name
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Patched Order Name' });

      // 4. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const updatedEvent = res.body.events.find(
        (e: { eventType: string }) => e.eventType === 'updated',
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent.payload.changes).toEqual({
        name: 'Patched Order Name',
      });
    });
  });

  describe('Returns Audit', () => {
    let salesOrderId: string;
    let returnId: string;

    it('should record clean diff for return notes change', async () => {
      // 1. Find an invoiced order
      const orderRes = await request(app.getHttpServer())
        .get('/api/sales-orders?limit=50')
        .set('Authorization', `Bearer ${adminToken}`);
      const invoicedOrder = orderRes.body.data.find(
        (o: { stateCode: string }) =>
          o.stateCode === SALES_ORDER_STATE.INVOICED,
      );

      if (!invoicedOrder) {
        console.warn('No invoiced app order found for return test, skipping');
        return;
      }
      salesOrderId = invoicedOrder.id;

      // 2. Create return
      const createRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${salesOrderId}/returns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Original Return Note',
          lines: [],
        });
      returnId = createRes.body.returnId;

      // 3. Update return notes
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${salesOrderId}/returns/${returnId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated Return Note' });

      // 4. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/sales-orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const returnEvent = res.body.events.find(
        (e: { eventType: string; payload: { returnId: string } }) =>
          e.eventType === 'return_updated' && e.payload.returnId === returnId,
      );
      expect(returnEvent).toBeDefined();
      expect(returnEvent.payload.changes).toEqual({
        notes: 'Updated Return Note',
      });
    });
  });

  describe('Product Audit', () => {
    let productId: string;

    it('should record clean diff for product name change', async () => {
      // 1. Create product
      const createRes = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productNumber: `E2E-PROD-${Date.now()}`,
          name: 'Original Product Name',
          listPrice: '100.00',
        });
      productId = createRes.body.productId;

      // 2. Update name
      await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Product Name' });

      // 3. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const updatedEvent = res.body.events.find(
        (e: { eventType: string }) => e.eventType === 'updated',
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent.payload.changes).toEqual({
        name: 'Updated Product Name',
      });
    });

    it('should record specialized status_changed event for products', async () => {
      // 1. Update status
      await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: PRODUCT_STATE.INACTIVE });

      // 2. Verify event
      const res = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const statusEvent = res.body.events.find(
        (e: { eventType: string }) => e.eventType === 'status_changed',
      );
      expect(statusEvent).toBeDefined();
      expect(statusEvent.payload).toEqual({
        from: PRODUCT_STATE.ACTIVE,
        to: PRODUCT_STATE.INACTIVE,
      });
    });
  });
});
