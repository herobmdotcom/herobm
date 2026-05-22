import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Dynamic Reports Engine (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let locationId: string;

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
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
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
    locationId = locRes.body.data[0].locationId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/reports/hooks/:hookSlug/run — handles sparse data (App Orders) without crashing Typst', async () => {
    // 1. Fetch valid foreign keys required for minimal creation
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    if (!customers.body.data?.length || !products.body.data?.length) {
      console.warn('Missing test data for sparse order generation.');
      return;
    }

    // 2. Insert the sparsest possible order (no product number, no customer name, etc)
    const draftRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,

        customerId: customers.body.data[0].customerId,
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
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    const products = await request(app.getHttpServer())
      .get('/api/products?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    if (!customers.body.data?.length || products.body.data?.length < 2) {
      console.warn('Missing test data for rich order generation.');
      return;
    }

    // 2. Insert a fully saturated order
    const draftRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fulfillmentLocationId: locationId,

        customerId: customers.body.data[0].customerId,
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
      if (viewerRes.status !== 201) {
        throw new Error(
          `${'viewerRes'} login failed: ${viewerRes.status} ${JSON.stringify(viewerRes.body)}`,
        );
      }
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
          contexts: ['sales-order'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.contexts).toContain('sales-order');
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
          contexts: ['sales-order', 'purchase-order'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('E2E Test Template Updated');
      expect(res.body.data.template).toContain('Updated E2E Test');
      expect(res.body.data.contexts).toContain('purchase-order');
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

    it('DELETE /api/reports/:id — removes the template', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      // Verify it's gone
      const check = await request(app.getHttpServer())
        .get(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.status).toBe(404);
    });

    it('Assignment Management: lists and updates assignments', async () => {
      const testSlug = `assign-test-${Date.now()}`;
      const newReport = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Assignment Test Report',
          slug: testSlug,
          template: '= Hello',
        });
      const rid = newReport.body.data.id;

      // Update assignment
      await request(app.getHttpServer())
        .patch('/api/reports/hook-assignments/sales-invoice')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportId: rid, contextSlug: 'sales-invoice' })
        .expect(200);

      // Check listing
      const res = await request(app.getHttpServer())
        .get('/api/reports/hook-assignments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const invoiceAssign = res.body.data.find(
        (a: any) => a.hookSlug === 'sales-invoice',
      );
      expect(invoiceAssign.reportId).toBe(rid);

      // Deletion Guard: Should fail to delete since it's assigned
      const delFail = await request(app.getHttpServer())
        .delete(`/api/reports/${rid}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delFail.status).toBe(400);
      expect(delFail.body.message).toContain(
        'currently assigned to the system hook',
      );

      // Cleanup: Unassign and then restore the standard assignment
      await request(app.getHttpServer())
        .patch('/api/reports/hook-assignments/sales-invoice')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportId: 'a0000000-0000-0000-0000-000000000003',
          contextSlug: 'sales-invoice',
        })
        .expect(200);
    });

    it('AuthZ: viewer cannot DELETE templates (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/reports/${testReportId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
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
