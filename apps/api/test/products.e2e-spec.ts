import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Products (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      });
    adminToken = adminRes.body.access_token;

    // Login as viewer
    const viewerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });
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
});
