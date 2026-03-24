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
  let validProductId1: string;
  let validProductId2: string;

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
      .get('/api/products?limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId1 = products.body.data[0].productId;
    validProductId2 = products.body.data[1]?.productId || validProductId1;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Invoice Fetching', () => {
    let orderId: string;
    let createdInvoiceId: string;

    let orderLineId1: string;
    let orderLineId2: string;

    it('creates a multi-line order and partially invoices it', async () => {
      // 1. Create order
      const createRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          name: 'E2E Partial Invoice Test',
          lines: [
            {
              productId: validProductId1,
              quantity: '4',
              pricePerUnit: '10.00',
            },
            {
              productId: validProductId2,
              quantity: '2',
              pricePerUnit: '15.00',
            },
          ],
        })
        .expect(201);
      orderId = createRes.body.salesOrderId;

      const linesRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      orderLineId1 = linesRes.body.lines[0].salesOrderLineId;
      orderLineId2 = linesRes.body.lines[1].salesOrderLineId;

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

      // 3. Generate Partial Invoice #1
      const partialInvoiceRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Test partial',
          lines: [{ salesOrderLineId: orderLineId1, quantityToInvoice: 2 }],
        });

      if (partialInvoiceRes.status !== 201) {
        console.log('PARTIAL INVOICE ERROR:', partialInvoiceRes.body);
      }
      expect(partialInvoiceRes.status).toBe(201);

      createdInvoiceId = partialInvoiceRes.body.invoiceId;
      expect(createdInvoiceId).toBeDefined();

      // Check state is STILL 'shipped' (not fully invoiced)
      const checkState1 = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(checkState1.body.stateCode).toBe('shipped');

      // 4. Generate Final Invoice #2 for the rest
      const finalInvoiceRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Test final',
          lines: [
            { salesOrderLineId: orderLineId1, quantityToInvoice: 2 },
            { salesOrderLineId: orderLineId2, quantityToInvoice: 2 },
          ],
        })
        .expect(201);

      expect(finalInvoiceRes.body.invoiceId).toBeDefined();

      // Check state transitioned to 'invoiced' natively
      const checkState2 = await request(app.getHttpServer())
        .get(`/api/sales-orders/${orderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(checkState2.body.stateCode).toBe('invoiced');
    });

    it('rejects invoicing more than the shipped quantity (demonstrably impossible)', async () => {
      // 1. Create order
      const createRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: validCustomerId,
          name: 'E2E Unshipped Invoice Test',
          lines: [
            {
              productId: validProductId1,
              quantity: '4',
              pricePerUnit: '10.00',
            },
          ],
        })
        .expect(201);
      const testOrderId = createRes.body.salesOrderId;

      const linesRes = await request(app.getHttpServer())
        .get(`/api/sales-orders/${testOrderId}?source=app`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const testLineId = linesRes.body.lines[0].salesOrderLineId;

      // 2. Transition to picking
      for (const state of ['quoted', 'confirmed', 'picking']) {
        await request(app.getHttpServer())
          .patch(`/api/sales-orders/${testOrderId}/state`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ stateCode: state })
          .expect(200);
      }

      // 3. Pick it fully natively (but NO SHIPMENT created!)
      await request(app.getHttpServer())
        .patch(`/api/sales-orders/${testOrderId}/picking/lines/${testLineId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantityPicked: '4' })
        .expect(200);

      // 4. Try to invoice it - this should FAIL securely because 0 shipped
      const badInvoiceRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Testing invalid unshipped logic',
          lines: [{ salesOrderLineId: testLineId, quantityToInvoice: 2 }],
        });

      expect(badInvoiceRes.status).toBe(400);
      expect(badInvoiceRes.body.message).toMatch(
        /Cannot invoice more than shipped quantity/,
      );
    });

    it('GET /api/sales-invoices — retrieves the global invoice list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sales-invoices?days=30&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const found = res.body.data.find(
        (inv: any) => inv.invoiceId === createdInvoiceId,
      );
      expect(found).toBeDefined();
      expect(found.salesOrderId).toBe(orderId);
      expect(found.customerId).toBe(validCustomerId);
      expect(found.customerName).toBeDefined();
      expect(found.orderNumber).toBeDefined();
      expect(parseFloat(found.totalAmount)).toBeGreaterThan(19.0); // Line 1 qty 2 * 10 = 20
    });

    it('GET /api/sales-invoices?accountId=... — filters by account strictly', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sales-invoices?accountId=${validCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        res.body.data.every((inv: any) => inv.customerId === validCustomerId),
      ).toBe(true);
    });

    it('GET /api/sales-invoices?accountId=BOGUS — returns empty', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/sales-invoices?accountId=00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('GL Integration — posted a journal entry for the invoice', async () => {
      // Find the journal entries filtered by this sourceType
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceType=sales_invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const je = glRes.body.data.find(
        (j: any) => j.sourceId === createdInvoiceId,
      );

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
      expect(parseFloat(arLine.debit)).toBeGreaterThan(19.0); // 20 + tax
    });
  });
});
