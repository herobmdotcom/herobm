import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Sales Invoices', () => {
  let app: INestApplication;
  let adminToken: string;

  let validCustomerId: string;
  let validProductId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.access_token;

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
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Invoice Fetching', () => {
    let orderId: string;
    let createdInvoiceId: string;

    it('creates and invoices a fully shipped order', async () => {
      // 1. Create order
      const createRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          name: 'E2E Invoice Test',
          lines: [
            {
              productId: validProductId,
              quantity: '4',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);
      orderId = createRes.body.salesOrderId;

      // 2. Transition to shipped
      for (const state of ['quoted', 'confirmed', 'picking', 'shipped']) {
        if (state === 'shipped') {
          await request(app.getHttpServer())
            .post(`/api/sales-orders/${orderId}/picking/pick-all`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(201);
        }
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${orderId}/state`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ stateCode: state })
          .expect(200);
      }

      // 3. Generate Invoice
      const invoiceRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Test invoicing' })
        .expect(201);

      createdInvoiceId = invoiceRes.body.invoiceId;
      expect(createdInvoiceId).toBeDefined();
    });

    it('GET /api/sales-invoices — retrieves the global invoice list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-invoices?days=30&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const found = res.body.find(
        (inv: any) => inv.invoiceId === createdInvoiceId,
      );
      expect(found).toBeDefined();
      expect(found.salesOrderId).toBe(orderId);
      expect(found.customerId).toBe(validCustomerId);
      expect(found.customerName).toBeDefined();
      expect(found.orderNumber).toBeDefined();
      expect(parseFloat(found.totalAmount)).toBeGreaterThan(39.0);
    });

    it('GET /api/sales-invoices?accountId=... — filters by account strictly', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-invoices?accountId=${validCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.every((inv: any) => inv.customerId === validCustomerId),
      ).toBe(true);
    });

    it('GET /api/sales-invoices?accountId=BOGUS — returns empty', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/sales-invoices?accountId=00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('GL Integration — posted a journal entry for the invoice', async () => {
      // Find the journal entries filtered by this sourceType
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceType=sales_invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const je = glRes.body.find((j: any) => j.sourceId === createdInvoiceId);

      expect(je).toBeDefined();

      // Fetch the full details to inspect lines
      const detailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${je.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lines = detailRes.body.lines;
      expect(lines.length).toBeGreaterThanOrEqual(2);

      const arLine = lines.find((l: any) => l.partyId === validCustomerId);
      expect(arLine).toBeDefined();
      expect(arLine.partyType).toBe('customer');
      expect(parseFloat(arLine.debit)).toBeGreaterThan(39.0);
    });
  });
});
