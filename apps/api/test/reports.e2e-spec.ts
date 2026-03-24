import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Dynamic Reports Engine (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

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
    if (adminRes.status !== 201) {
      console.error('Admin login failed:', adminRes.status, adminRes.body);
    }
    adminToken = adminRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/reports/hooks/:hookSlug/run — handles sparse data (App Orders) without crashing Typst', async () => {
    // 1. Fetch valid foreign keys required for minimal creation
    const accounts = await request(app.getHttpServer())
      .get('/api/accounts?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    if (!accounts.body.data?.length || !products.body.data?.length) {
      console.warn('Missing test data for sparse order generation.');
      return;
    }

    // 2. Insert the sparsest possible order (no product number, no customer name, etc)
    const draftRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: accounts.body.data[0].accountId,
        lines: [
          {
            productId: products.body.data[0].productId,
            quantity: '1',
            pricePerUnit: '10.00',
          },
        ],
      });

    expect(draftRes.status).toBe(201);
    const orderId = draftRes.body.salesOrderId;

    // 3. Execute the Quote Hook against the sparse order
    const pdfRes = await request(app.getHttpServer())
      .post(
        `/api/reports/hooks/sales-order-quote/run?id=${orderId}&context=sales-order`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob');

    // NestJS @Post routes default to 201 Created
    expect(pdfRes.status).toBe(201);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');

    const buf = pdfRes.body;
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  }, 10000);

  it('POST /api/reports/hooks/:hookSlug/run — handles rich data seamlessly', async () => {
    // 1. Fetch valid foreign keys required for creation
    const accounts = await request(app.getHttpServer())
      .get('/api/accounts?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    if (!accounts.body.data?.length || products.body.data?.length < 2) {
      console.warn('Missing test data for rich order generation.');
      return;
    }

    // 2. Insert a fully saturated order
    const draftRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: accounts.body.data[0].accountId,
        name: 'Super Rich Demo Order',
        customerOrderNumber: 'PO-999-XYZ',
        notes: 'Please expedite shipping via air freight.',
        lines: [
          {
            productId: products.body.data[0].productId,
            productDescription: 'High-end Widget (Red)',
            quantity: '5',
            pricePerUnit: '125.50',
            discountPercentage: '10.0',
            tax: '25.10',
          },
          {
            productId: products.body.data[1].productId,
            productDescription: 'Standard Widget (Blue)',
            quantity: '50',
            pricePerUnit: '10.00',
          },
        ],
      });

    expect(draftRes.status).toBe(201);
    const orderId = draftRes.body.salesOrderId;

    // 3. Execute the Quote Hook against the rich order
    const pdfRes = await request(app.getHttpServer())
      .post(
        `/api/reports/hooks/sales-order-quote/run?id=${orderId}&context=sales-order`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob');

    expect(pdfRes.status).toBe(201);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');

    const buf = pdfRes.body;
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  }, 10000);

  describe('Template Management API', () => {
    let testReportId: string;
    let viewerToken: string;

    beforeAll(async () => {
      // Login as viewer (for AuthZ testing)
      const viewerRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'viewer',
          password: process.env.DEV_VIEWER_PASSWORD || 'password',
        });
      viewerToken = viewerRes.body.access_token;
    });

    it('POST /api/reports — creates a new template', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Template',
          slug: `e2e-test-template-${Date.now()}`,
          description: 'A test template',
          template: '#set page(paper: "a4")\n= E2E Test\n',
          outputNamePattern: 'E2E-Report.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      testReportId = res.body.data.id;
    });

    it('GET /api/reports — lists templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((r: any) => r.id === testReportId)).toBe(true);
    });

    it('GET /api/reports/:id — retrieves a specific template', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('E2E Test Template');
    });

    it('PATCH /api/reports/:id — updates a template', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Template Updated',
          template: '#set page(paper: "a4")\n= Updated E2E Test\n',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('E2E Test Template Updated');
      expect(res.body.data.template).toContain('Updated E2E Test');
    });

    it('AuthZ: viewer cannot CREATE templates (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Hacked Template',
          slug: `hacked-template-${Date.now()}`,
          template: '= Hack',
          outputNamePattern: 'Hack.pdf',
        })
        .expect(403);
    });

    it('AuthZ: viewer cannot UPDATE templates (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Hacked Updated',
        })
        .expect(403);
    });

    it('AuthZ: viewer CAN READ templates (200 OK)', async () => {
      await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('GET /api/reports/hooks — lists available hooks', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/hooks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        res.body.data.some((h: any) => h.contextSlug === 'sales-order'),
      ).toBe(true);
    });
  });
});
