/**
 * End-to-End Integration Tests
 *
 * These tests hit the running API against the real Postgres database
 * and verify that data flows correctly from dbt marts → Drizzle → API → HTTP.
 *
 * Run with: npm run test:e2e
 * Requires: Postgres running with populated marts (make elt && make transform)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE, DrizzleDB } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Data Pipeline Verification', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Clear Prometheus metrics (may be polluted from other tests)
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Obtain auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);

    authToken = loginRes.body.access_token;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // Auth
  // =========================================================================

  describe('Authentication', () => {
    it('POST /api/auth/login — valid credentials return JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('username', 'admin');
      expect(res.body).toHaveProperty('role', 'admin');
    });

    it('POST /api/auth/login — invalid password returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        // eslint-disable-next-line no-restricted-syntax
        .send({ username: 'admin', password: 'wrongpassword' }) // TEST_CREDENTIAL
        .expect(401);
    });

    it('POST /api/auth/login — unknown user returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        // eslint-disable-next-line no-restricted-syntax
        .send({ username: 'nobody', password: 'REDACTED' }) // TEST_CREDENTIAL
        .expect(401);
    });

    it('GET /api/accounts — no token returns 401', async () => {
      await request(app.getHttpServer()).get('/api/accounts').expect(401);
    });
  });

  // =========================================================================
  // Accounts  (data from mart_accounts → Drizzle → API)
  // =========================================================================

  describe('Accounts — mart_accounts data pipeline', () => {
    it('GET /api/accounts — returns paginated list from Postgres', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 50);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verify data is actually coming from dbt marts (not empty)
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify CDM field names are present
      const firstAccount = res.body.data[0];
      expect(firstAccount).toHaveProperty('accountId');
      expect(firstAccount).toHaveProperty('name');
      expect(firstAccount.accountId).toBeTruthy();
      expect(firstAccount.name).toBeTruthy();
    });

    it('GET /api/accounts — pagination works', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/accounts?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('GET /api/accounts — search filters results', async () => {
      // Get first account's name to use as search term
      const allRes = await request(app.getHttpServer())
        .get('/api/accounts?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const searchTerm = allRes.body.data[0]?.name?.substring(0, 3);
      if (!searchTerm) return; // skip if no data

      const searchRes = await request(app.getHttpServer())
        .get(`/api/accounts?q=${searchTerm}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchRes.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/accounts/:id — returns specific account', async () => {
      // Get an ID from the list
      const listRes = await request(app.getHttpServer())
        .get('/api/accounts?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const accountId = listRes.body.data[0]?.accountId;
      expect(accountId).toBeTruthy();

      const detailRes = await request(app.getHttpServer())
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(detailRes.body.accountId).toBe(accountId);
      expect(detailRes.body.name).toBeTruthy();
    });

    it('GET /api/accounts/:id — unknown ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/accounts/NONEXISTENT-UUID-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // Products  (data from mart_products → Drizzle → API)
  // =========================================================================

  describe('Products — mart_products data pipeline', () => {
    it('GET /api/products — returns paginated list from Postgres', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);

      const firstProduct = res.body.data[0];
      expect(firstProduct).toHaveProperty('productId');
      expect(firstProduct).toHaveProperty('name');
      expect(firstProduct).toHaveProperty('productNumber');
      expect(firstProduct.productId).toBeTruthy();
    });

    it('GET /api/products — search by product name', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/products?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const searchTerm = allRes.body.data[0]?.name?.substring(0, 3);
      if (!searchTerm) return;

      const searchRes = await request(app.getHttpServer())
        .get(`/api/products?q=${searchTerm}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchRes.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/products/:id — returns specific product', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/products?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const productId = listRes.body.data[0]?.productId;
      expect(productId).toBeTruthy();

      const detailRes = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(detailRes.body.productId).toBe(productId);
      expect(detailRes.body.name).toBeTruthy();
    });

    it('GET /api/products/:id — unknown ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/products/NONEXISTENT-UUID-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // Bin Contents  (data from mart_bin_contents → Drizzle → API)
  // =========================================================================

  describe.skip('Bin Contents — mart_bin_contents data pipeline', () => {
    it('GET /api/inventory/bins — returns paginated bin stock', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory/bins')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);

      const first = res.body.data[0];
      expect(first).toHaveProperty('binContentId');
      expect(first).toHaveProperty('binNumber');
      expect(first).toHaveProperty('productNumber');
      expect(first).toHaveProperty('actualQuantity');
    });

    it('GET /api/inventory/bins — search by bin number', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/inventory/bins?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const binNum = allRes.body.data[0]?.binNumber?.substring(0, 3);
      if (!binNum) return;

      const searchRes = await request(app.getHttpServer())
        .get(`/api/inventory/bins?q=${binNum}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchRes.body.data.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Orders  (data from mart_sales_order_lines → Drizzle → API)
  // =========================================================================

  describe('Orders — unified order listing', () => {
    it('GET /api/sales-orders — returns paginated unified orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);

      const first = res.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('orderNumber');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('stateCode');
    });

    it('GET /api/sales-orders — search by order number', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/sales-orders?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const orderNum = allRes.body.data[0]?.orderNumber?.substring(0, 3);
      if (!orderNum) return;

      const searchRes = await request(app.getHttpServer())
        .get(`/api/sales-orders?q=${orderNum}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchRes.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/sales-orders/:id — returns specific order', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/sales-orders?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const orderId = listRes.body.data[0]?.id;
      expect(orderId).toBeTruthy();

      const detailRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(detailRes.body.salesOrderId).toBe(orderId);
    });

    it('GET /api/sales-orders/:id — unknown ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/sales-orders/NONEXISTENT-UUID-12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('GET /api/sales-orders — no token returns 401', async () => {
      await request(app.getHttpServer()).get('/api/sales-orders').expect(401);
    });
  });

  // =========================================================================
  // Dashboard  (aggregates across all marts)
  // =========================================================================

  describe('Dashboard — cross-mart aggregation', () => {
    it('GET /api/dashboard/summary — returns entity counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('accounts');
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('orderLines');

      // All counts should be positive (marts are populated)
      expect(res.body.accounts).toBeGreaterThan(0);
      expect(res.body.products).toBeGreaterThan(0);
      expect(res.body.orderLines).toBeGreaterThan(0);
    });

    it('GET /api/dashboard/summary — no token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/summary')
        .expect(401);
    });
  });

  // =========================================================================
  // Observability (metrics endpoint is set up in main.ts, not available here)
  // =========================================================================

  describe('Observability — request logging', () => {
    it('successful requests are handled without errors', async () => {
      // This implicitly tests that the MetricsInterceptor is working
      // by making requests and verifying they succeed
      const res = await request(app.getHttpServer())
        .get('/api/accounts?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // System Integrity
  // =========================================================================

  describe('System Integrity — Required Seed Data', () => {
    it('verifies that system bins (SHIPPING, RECEIVING) exist in modbm_core.bins', async () => {
      const db = app.get<DrizzleDB>(DRIZZLE);
      const systemBins = await db.execute(
        sql`SELECT * FROM modbm_core.bins WHERE bin_number IN ('SHIPPING', 'RECEIVING') AND source = 'system' AND bin_type = 'staging' AND is_unavailable = true`,
      );

      // Verify that the system-defined staging bins are present
      expect(systemBins.length).toBeGreaterThanOrEqual(2);
      expect(systemBins.some((b: any) => b.bin_number === 'SHIPPING')).toBe(
        true,
      );
      expect(systemBins.some((b: any) => b.bin_number === 'RECEIVING')).toBe(
        true,
      );
    });

    it('verifies that the system custom line magic product exists', async () => {
      const db = app.get<DrizzleDB>(DRIZZLE);
      const magicProducts = await db.execute(
        sql`SELECT * FROM modbm_core.products WHERE product_id = '00000000-0000-0000-0000-000000000000'`,
      );

      expect(magicProducts.length).toBe(1);
      expect(magicProducts[0].product_number).toBe('SYSTEM-CUSTOM-LINE');
    });
  });
});
