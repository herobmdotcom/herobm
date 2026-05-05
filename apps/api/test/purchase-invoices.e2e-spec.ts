/**
 * E2E Tests — Purchase Invoices & GL Integration
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Purchase Invoices', () => {
  let app: INestApplication;
  let adminToken: string;
  let validVendorId: string;
  let validProductId: string;
  let validLocationId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (await createE2eModule()).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Fetch GL accounts to use for AP and Expense
    const accountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const leaves: any[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isGroup) leaves.push(node);
        if (node.children) walk(node.children);
      }
    };
    walk(accountsRes.body);

    // Pick two accounts
    const apAccount = leaves.find((l) => l.accountCode === '2100') || leaves[0];
    const expAccount =
      leaves.find((l) => l.accountCode === '5100') || leaves[1];

    // Create an app vendor (core UUID) to guarantee valid UUID vendorId
    const vendorRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorNumber: `E2E-VEND-${Date.now()}`,
        name: 'E2E Test Vendor for Invoices',
        defaultApAccountId: apAccount.glAccountId,
        defaultExpenseAccountId: expAccount.glAccountId,
      })
      .expect(201);
    validVendorId = vendorRes.body.vendorId;

    // Create an app product (core UUID) for use in PO lines
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `E2E-INV-P-${Date.now()}`,
        name: 'E2E Invoice Test Product',
        listPrice: '15.00',
      })
      .expect(201);
    validProductId = productRes.body.productId;

    await request(app.getHttpServer())
      .post(`/api/products/${validProductId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId: validVendorId,
        isPreferred: true,
        costPrice: '10.00',
        minOrderQty: 1,
      })
      .expect(201);

    // Fetch a base delivery location
    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validLocationId = locationsRes.body.data[0].locationId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  describe('Purchase Invoice Lifecycle', () => {
    let orderId: string;
    let createdInvoiceId: string;

    it('creates and invoices a fully received purchase order', async () => {
      // 1. Create order
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

      const createRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `E2E-INV-PO-${today}-${rand}`,
          vendorId: validVendorId,
          deliveryLocationId: validLocationId,
          name: 'E2E Invoice Test',
          currencyCode: 'AUD',
          lines: [
            {
              productId: validProductId,
              quantity: '5',
              pricePerUnit: '12.00',
            },
          ],
        });
      if (createRes.status !== 201) {
        console.error('PO CREATION ERROR:', createRes.body);
      }
      expect(createRes.status).toBe(201);

      orderId = createRes.body.purchaseOrderId;

      // 2. Transition state and receive
      await request(app.getHttpServer())
        .patch(`/api/purchase-orders/${orderId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'ordered' })
        .expect(200);

      // Get line IDs
      const detail = await request(app.getHttpServer())
        .get(`/api/purchase-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const lineId = detail.body.lines[0].purchaseOrderLineId;

      await request(app.getHttpServer())
        .post(`/api/goods-received`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          locationId: validLocationId,
          packingSlipNumber: `TEST-PS-${rand}`,
          lines: [{ productId: validProductId, quantityReceived: '5' }],
        })
        .expect(201);

      // The reception of full quantity automatically transitions the order to 'received'

      // 3. Generate Invoice
      const invoiceRes = await request(app.getHttpServer())
        .post(`/api/purchase-invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: validVendorId,
          supplierInvoiceNumber: `SUPP-INV-${rand}`,
          currencyCode: 'AUD',
          purchaseOrderId: orderId,
          totalAmount: 60.0,
          taxAmount: 0,
          notes: 'Test AP invoicing',
          lines: [
            {
              description: 'E2E Invoice Test Product',
              productId: validProductId,
              quantityInvoiced: 5,
              pricePerUnit: 12.0,
              purchaseOrderLineId: lineId,
            },
          ],
        })
        .expect(201);

      createdInvoiceId = invoiceRes.body.invoiceId;
      expect(createdInvoiceId).toBeDefined();

      // 4. Post the invoice to generate GL entries
      await request(app.getHttpServer())
        .post(`/api/purchase-invoices/${createdInvoiceId}/post`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('GL Integration — posted a journal entry for the AP invoice', async () => {
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceType=purchase_invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const je = glRes.body.data.find(
        (j: any) => j.sourceId === createdInvoiceId,
      );
      expect(je).toBeDefined();

      const detailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${je.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const lines = detailRes.body.lines;
      expect(lines.length).toBeGreaterThanOrEqual(2);

      // AP Line should be the credit line for the supplier
      const apLine = lines.find(
        (l: any) => l.partyId === validVendorId && parseFloat(l.credit) > 0,
      );
      expect(apLine).toBeDefined();
      expect(apLine.partyType).toBe('supplier');
      expect(parseFloat(apLine.credit)).toBeGreaterThan(59.0);

      // Verify outbox event
      const dbRes = await request(app.getHttpServer())
        .get('/api/settings/external-sync/events?type=gl_posted')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const eventsList = dbRes.body.events || [];
      const glEvent = eventsList.find(
        (evt: any) =>
          evt.eventType === 'gl_posted' &&
          evt.aggregateId === je.journalEntryId,
      );
      expect(glEvent).toBeDefined();
    });
  });
});
