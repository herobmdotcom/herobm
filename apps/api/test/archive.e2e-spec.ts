/**
 * E2E Tests — Archive / Unarchive Functionality
 *
 * These tests verify the full archive round-trip across entities:
 *   1. Archive an entity → confirm it disappears from the default list
 *   2. Fetch with ?includeArchived=true → confirm it reappears
 *   3. Unarchive → confirm restored to expected state
 *   4. PO-specific: verify unarchive defaults to 'cancelled'
 *
 * Run with: npm run test:e2e -- --testPathPatterns archive
 * Requires: Docker/Podman stack running with Postgres + populated marts.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Archive E2E — Full Round-Trip', () => {
  let app: INestApplication;
  let adminToken: string;
  let locationId: string;
  let viewerToken: string;

  // IDs captured during setup
  let validCustomerId: string;
  let validProductId: string;
  let validVendorId: string;
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin (has archive action)
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locRes.body.data[0].locationId;

    // Login as viewer (read-only, no archive action)
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
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId = products.body.data[0].productId;

    const suppliers = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validVendorId = suppliers.body.data[0].vendorId;

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locations.body.data[0].locationId;

    // Ensure the product is mapped to the vendor
    await request(app.getHttpServer())
      .post(`/api/products/${validProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      });
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // Accounts — archive round-trip
  // ===========================================================================

  describe('Accounts — archive round-trip', () => {
    let accountId: string;

    it('create a test account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accountNumber: `E2E-ARCH-ACCT-${Date.now()}`,
          name: 'E2E Archive Test Account',
        })
        .expect(201);

      accountId = res.body.accountId;
      expect(res.body.stateCode).toBe('active');
    });

    it('viewer cannot archive (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/accounts/${accountId}/archive`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('admin can archive the account', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounts/${accountId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('archived');
    });

    it('archived account is excluded from default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((a: any) => a.accountId);
      expect(ids).not.toContain(accountId);
    });

    it('archived account appears with ?includeArchived=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts?includeArchived=true&limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((a: any) => a.accountId === accountId);
      expect(found).toBeDefined();
      expect(found.stateCode).toBe('archived');
    });

    it('admin can unarchive the account', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/accounts/${accountId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('active');
    });

    it('unarchived account reappears in default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts?limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((a: any) => a.accountId);
      expect(ids).toContain(accountId);
    });
  });

  // ===========================================================================
  // Sales Orders — archive round-trip (must be in terminal state)
  // ===========================================================================

  describe('Sales Orders — archive round-trip', () => {
    let orderId: string;

    it('create and cancel a sales order (terminal state)', async () => {
      // Create draft
      const createRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fulfillmentLocationId: validLocationId,
          customerId: validCustomerId,
          name: 'E2E Archive Test SO',
          lines: [
            {
              productId: validProductId,
              productDescription: 'Archive Test Product',
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);

      orderId = createRes.body.salesOrderId;

      // Cancel it (terminal state)
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(200);
    });

    it('archiving a draft order fails (not terminal)', async () => {
      // Create a second draft
      const draftRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fulfillmentLocationId: validLocationId,
          customerId: validCustomerId,
          name: 'E2E Draft Archive Fail',
          lines: [
            {
              productId: validProductId,
              productDescription: 'Archive Test',
              quantity: '1',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/sales-orders/${draftRes.body.salesOrderId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('admin can archive the cancelled order', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('archived');
    });

    it('archived order is excluded from default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-orders?limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((o: any) => o.id);
      expect(ids).not.toContain(orderId);
    });

    it('archived order appears with ?includeArchived=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-orders?includeArchived=true&limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((o: any) => o.id === orderId);
      expect(found).toBeDefined();
      expect(found.stateCode).toBe('archived');
    });

    it('admin can unarchive — restores to cancelled', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      // Should restore to the state it was in before archiving (cancelled)
      expect(res.body.stateCode).toBe('cancelled');
    });
  });

  // ===========================================================================
  // Purchase Orders — archive round-trip + unarchive defaults to 'cancelled'
  // ===========================================================================

  describe('Purchase Orders — archive round-trip (unarchive defaults to cancelled)', () => {
    let poId: string;

    it('create and cancel a purchase order (terminal state)', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

      const createRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `E2E-ARCH-PO-${today}-${rand}`,
          name: 'E2E Archive Test PO',
          vendorId: validVendorId,
          deliveryLocationId: validLocationId,
          currencyCode: 'EUR',
          lines: [
            {
              productId: validProductId,
              productDescription: 'Archive Test Product',
              quantity: '1',
              pricePerUnit: '10.00',
              unitOfMeasure: 'EA',
            },
          ],
        })
        .expect(201);

      poId = createRes.body.purchaseOrderId;

      // Cancel it (terminal state for archiving)
      await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${poId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(200);
    });

    it('archiving a draft PO fails (not terminal)', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

      const draftRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `E2E-ARCH-PO-FAIL-${today}-${rand}`,
          name: 'E2E Draft Archive Fail',
          vendorId: validVendorId,
          deliveryLocationId: validLocationId,
          currencyCode: 'EUR',
          lines: [
            {
              productId: validProductId,
              productDescription: 'Fail Test',
              quantity: '1',
              pricePerUnit: '10.00',
              unitOfMeasure: 'EA',
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/purchase-orders/${draftRes.body.purchaseOrderId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('admin can archive the cancelled PO', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${poId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('archived');
    });

    it('archived PO is excluded from default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders?limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((o: any) => o.id);
      expect(ids).not.toContain(poId);
    });

    it('archived PO appears with ?includeArchived=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders?includeArchived=true&limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((o: any) => o.id === poId);
      expect(found).toBeDefined();
      expect(found.stateCode).toBe('archived');
    });

    it('unarchive defaults PO to cancelled (no event store)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/purchase-orders/${poId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      // PO unarchive always defaults to 'cancelled' since there is no event log
      expect(res.body.stateCode).toBe('cancelled');
    });

    it('unarchived PO reappears in default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/purchase-orders?limit=100000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((o: any) => o.id === poId);
      expect(found).toBeDefined();
    });
  });

  // ===========================================================================
  // Products — archive round-trip
  // ===========================================================================

  describe('Products — archive round-trip', () => {
    let productId: string;

    it('create a test product', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productNumber: `E2E-ARCH-PROD-${Date.now()}`,
          name: 'E2E Archive Test Product',
          listPrice: '25.00',
        })
        .expect(201);

      productId = res.body.productId;
      expect(res.body.stateCode).toBe('active');
    });

    it('admin can archive the product', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/products/${productId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('archived');
    });

    it('archived product is excluded from default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((p: any) => p.productId);
      expect(ids).not.toContain(productId);
    });

    it('archived product appears with ?includeArchived=true', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/products?includeArchived=true&q=E2E%20Archive%20Test&limit=100000',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.find((p: any) => p.productId === productId);
      expect(found).toBeDefined();
      expect(found.stateCode).toBe('archived');
    });

    it('admin can unarchive the product', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/products/${productId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('active');
    });
  });

  // ===========================================================================
  // Suppliers — archive round-trip
  // ===========================================================================

  describe('Suppliers — archive round-trip', () => {
    let vendorId: string;

    it('create a test supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorNumber: `E2E-ARCH-SUP-${Date.now()}`,
          name: 'E2E Archive Test Supplier',
        })
        .expect(201);

      vendorId = res.body.vendorId;
      expect(res.body.stateCode).toBe('active');
    });

    it('admin can archive the supplier', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/suppliers/${vendorId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('archived');
    });

    it('archived supplier is excluded from default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.data.map((s: any) => s.vendorId);
      expect(ids).not.toContain(vendorId);
    });

    it('admin can unarchive the supplier', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/suppliers/${vendorId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.stateCode).toBe('active');
    });
  });
});

