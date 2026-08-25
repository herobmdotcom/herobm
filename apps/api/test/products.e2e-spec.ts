import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

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

    // Login as viewer
    const viewerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });
    if (viewerRes.status !== 201) {
      throw new Error(
        `${'viewerRes'} login failed: ${viewerRes.status} ${JSON.stringify(viewerRes.body)}`,
      );
    }
    viewerToken = viewerRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/products — returns a list of products (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/products — creates a new product (admin)', async () => {
    const productNumber = `PROD-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber,
        name: 'E2E Test Product',
        listPrice: '99.99',
        productType: 'inventory',
        baseUom: 'EA',
      });

    expect(res.status).toBe(201);
    expect(res.body.productId).toBeDefined();
    expect(res.body.productNumber).toBe(productNumber);
  });

  it('POST /api/products — fails with 403 (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        productNumber: 'FAIL-001',
        name: 'Unauthorized Product',
        productType: 'inventory',
        baseUom: 'EA',
      });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/products/:id — updates a product (admin)', async () => {
    // 1. Create product
    const createRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `PATCH-${Date.now()}`,
        name: 'Before Patch',
        productType: 'inventory',
        baseUom: 'EA',
      });
    const productId = createRes.body.productId;

    // 2. Update product
    const res = await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'After Patch',
        notes: 'Testing patching',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('After Patch');
    expect(res.body.notes).toBe('Testing patching');
  });

  it('PATCH /api/products/:id — all products are editable (admin)', async () => {
    // All products are first-class entities after ABM decommissioning
    const listRes = await request(app.getHttpServer())
      .get('/api/products?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    const product = listRes.body.data[0];

    if (!product) {
      console.warn('No products found in test environment, skipping edit test');
      return;
    }

    // All products should be fully editable
    const res = await request(app.getHttpServer())
      .patch(`/api/products/${product.productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'E2E: verified editable' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('E2E: verified editable');
  });

  it('GET /api/products/images/* — streams image when it exists and 404s when absent', async () => {
    // 1. Non-existent image should 404
    const notFoundRes = await request(app.getHttpServer()).get(
      '/api/products/images/non-existent-image-12345.jpg',
    );
    expect(notFoundRes.status).toBe(404);

    // 2. Demo image if present in data/storage/products/demo
    const demoRes = await request(app.getHttpServer()).get(
      '/api/products/images/demo/tl-1001.jpg',
    );
    if (demoRes.status === 200) {
      expect(demoRes.headers['content-type']).toMatch(/image\/jpeg/);
      expect(demoRes.headers['cache-control']).toContain('public');
    }
  });
});
