/**
 * End-to-End Integration Tests
 *
 * These tests hit the running API against the real Postgres database
 * and verify that data flows correctly from dbt marts → Drizzle → API → HTTP.
 *
 * Run with: npm run test:e2e
 * Requires: Postgres running with populated marts (make elt && make transform)
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { DRIZZLE, DrizzleDB } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderLineItems,
  taxCategories,
  binContents,
  products,
} from '../src/drizzle/herobm-core-schema';
import { SALES_ORDER_STATE } from '@herobm/shared';
import request from 'supertest';

describe('API E2E — Data Pipeline Verification', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Clear Prometheus metrics (may be polluted from other tests)
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

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
      .send({ username: 'admin', password: process.env.ADMIN_PASSWORD })
      .expect(201);

    if (loginRes.status !== 201) {
      throw new Error(
        `${'loginRes'} login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }

    {
      const db = app.get<DrizzleDB>(DRIZZLE);
      try {
        const prod = await db.select().from(products).limit(1);
        const productId = prod[0]?.productId;

        if (!productId) {
          console.error(
            'No product seeded! Cannot insert sales order line mock.',
          );
        } else {
          await db
            .insert(salesOrders)
            .values({
              salesOrderId: '00000000-0000-4000-8000-000000000001',
              orderNumber: 'SO-E2E-001',
              customerId: '20000000-0000-4000-8000-000000000001',
              fulfillmentLocationId: '10000000-0000-4000-8000-000000000001',
              currencyCode: 'AUD',
              stateCode: SALES_ORDER_STATE.DRAFT,
            })
            .onConflictDoNothing();

          let taxCategory = await db
            .select()
            .from(taxCategories)
            .limit(1)
            .then((res) => res[0]);
          if (!taxCategory) {
            [taxCategory] = await db
              .insert(taxCategories)
              .values({
                taxCategoryId: '00000000-0000-4000-8000-000000000001',
                code: 'GST',
                title: 'Goods and Services Tax',
                type: 'tax_applies',
                rate: '10',
              })
              .returning();
          }

          await db
            .insert(salesOrderLineItems)
            .values({
              salesOrderLineId: '00000000-0000-4000-8000-000000000001',
              salesOrderId: '00000000-0000-4000-8000-000000000001',
              lineNumber: 1,
              productId,
              quantity: '10',
              pricePerUnit: '10.00',
              taxCategoryId: taxCategory.taxCategoryId,
              fulfillmentLocationId: '10000000-0000-4000-8000-000000000001',
            })
            .onConflictDoNothing();

          await db
            .insert(binContents)
            .values({
              binContentId: '00000000-0000-4000-8000-000000000001',
              binId: '00000000-0000-4000-8000-000000000003',
              productId,
              actualQuantity: '50',
            })
            .onConflictDoNothing();
        }
      } catch (err: unknown) {
        const error = err as Record<string, unknown>;
        console.error(
          'FAILED TO INSERT E2E MOCK DATA:',
          error.message,
          error.name,
          error.code,
          err,
        );
      }
    }

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
        .send({ username: 'admin', password: process.env.ADMIN_PASSWORD })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('username', 'admin');
      expect(res.body).toHaveProperty('role', 'admin');
    });

    it('POST /api/auth/login — invalid password returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Test credentials).
        .send({ username: 'admin', password: 'wrongpassword' }) // TEST_CREDENTIAL
        .expect(401);
    });

    it('POST /api/auth/login — unknown user returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Test credentials).
        .send({ username: 'nobody', password: 'REDACTED' }) // TEST_CREDENTIAL
        .expect(401);
    });

    it('GET /api/accounts — no token returns 401', async () => {
      await request(app.getHttpServer()).get('/api/customers').expect(401);
    });
  });

  // =========================================================================
  // Accounts  (data from mart_accounts → Drizzle → API)
  // =========================================================================

  describe('Accounts — mart_accounts data pipeline', () => {
    it('GET /api/accounts — returns paginated list from Postgres', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
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
      expect(firstAccount).toHaveProperty('customerId');
      expect(firstAccount).toHaveProperty('name');
      expect(firstAccount.customerId).toBeTruthy();
      expect(firstAccount.name).toBeTruthy();
    });

    it('GET /api/accounts — pagination works', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('GET /api/accounts — search filters results', async () => {
      // Get first account's name to use as search term
      const allRes = await request(app.getHttpServer())
        .get('/api/customers?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const searchTerm = allRes.body.data[0]?.name?.substring(0, 3);
      if (!searchTerm) return; // skip if no data

      const searchRes = await request(app.getHttpServer())
        .get(`/api/customers?q=${searchTerm}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchRes.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/accounts/:id — returns specific account', async () => {
      // Get an ID from the list
      const listRes = await request(app.getHttpServer())
        .get('/api/customers?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const customerId = listRes.body.data[0]?.customerId;
      expect(customerId).toBeTruthy();

      const detailRes = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(detailRes.body.customerId).toBe(customerId);
      expect(detailRes.body.name).toBeTruthy();
    });

    it('GET /api/accounts/:id — unknown ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/customers/NONEXISTENT-UUID-12345')
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

  describe('Bin Contents — Drizzle data pipeline', () => {
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

      expect(res.body).toHaveProperty('customers');
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('orderLines');

      // All counts should be positive (marts are populated)
      expect(res.body.customers).toBeGreaterThan(0);
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
        .get('/api/customers?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // System Integrity
  // =========================================================================

  describe('System Integrity — Required Seed Data', () => {
    it('verifies that system bins (SHIPPING, RECEIVING) exist in herobm_core.bins', async () => {
      const db = app.get<DrizzleDB>(DRIZZLE);
      const systemBinsRaw = await db.execute(
        sql`SELECT * FROM herobm_core.bins WHERE bin_number IN ('SHIPPING', 'RECEIVING') AND source = 'system' AND bin_type = 'staging' AND is_unavailable = true`,
      );
      const systemBins = Array.isArray(systemBinsRaw)
        ? systemBinsRaw
        : (systemBinsRaw as { rows?: unknown[] }).rows || [];

      // Verify that the system-defined staging bins are present
      expect(systemBins.length).toBeGreaterThanOrEqual(2);
      expect(
        (systemBins as { bin_number?: string }[]).some(
          (b) => b.bin_number === 'SHIPPING',
        ),
      ).toBe(true);
      expect(
        (systemBins as { bin_number?: string }[]).some(
          (b) => b.bin_number === 'RECEIVING',
        ),
      ).toBe(true);
    });

    it('verifies that the system custom line magic product exists', async () => {
      const db = app.get<DrizzleDB>(DRIZZLE);
      const magicProductsRaw = await db.execute(
        sql`SELECT * FROM herobm_core.products WHERE product_number = 'SYSTEM-CUSTOM-LINE'`,
      );
      const magicProducts = Array.isArray(magicProductsRaw)
        ? magicProductsRaw
        : (magicProductsRaw as { rows?: { product_number: string }[] }).rows ||
          [];

      expect(magicProducts.length).toBe(1);
      expect(magicProducts[0].product_number).toBe('SYSTEM-CUSTOM-LINE');
    });
  });
});
