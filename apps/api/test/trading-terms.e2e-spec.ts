/**
 * E2E Tests — Trading Terms, Due Dates, and Live GL Overdue Assessment
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { CreditAssessmentService } from '../src/customers/credit-assessment.service';

import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { salesOrders, salesInvoices, locations } from '@herobm/db-schema';
import * as crypto from 'crypto';
import request from 'supertest';

describe('Trading Terms and Credit Assessments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let creditAssessmentService: CreditAssessmentService;

  let codTermId: string;
  let net30TermId: string;
  let eom30TermId: string;

  let arAccountId: string;
  let salesAccountId: string;

  beforeAll(async () => {
    register.clear();
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    creditAssessmentService = app.get(CreditAssessmentService);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = adminLogin.body.access_token;

    // Fetch GL Accounts
    const accRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    interface GLAccountNode {
      glAccountId: string;
      accountCode: string;
      isGroup: boolean;
      children?: GLAccountNode[];
    }

    const leaves: GLAccountNode[] = [];
    const walk = (nodes: GLAccountNode[]) => {
      for (const n of nodes) {
        if (!n.isGroup) leaves.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(accRes.body as GLAccountNode[]);

    arAccountId =
      leaves.find((a: GLAccountNode) => a.accountCode === '1200')
        ?.glAccountId || leaves[0].glAccountId;
    salesAccountId =
      leaves.find((a: GLAccountNode) => a.accountCode === '4100')
        ?.glAccountId || leaves[1].glAccountId;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  describe('System Setup', () => {
    it('creates trading terms for COD, Net 30, and EOM 30', async () => {
      // COD
      const codRes = await request(app.getHttpServer())
        .post('/api/settings/trading-terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'E2E_COD_' + Date.now(),
          description: 'Cash on Delivery',
          type: 'cash_on_delivery',
          days: 0,
        })
        .expect(201);
      codTermId = codRes.body.id;

      // Net 30
      const netRes = await request(app.getHttpServer())
        .post('/api/settings/trading-terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'E2E_NET30_' + Date.now(),
          description: 'Net 30',
          type: 'net',
          days: 30,
        })
        .expect(201);
      net30TermId = netRes.body.id;

      // EOM 30
      const eomRes = await request(app.getHttpServer())
        .post('/api/settings/trading-terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'E2E_EOM_' + Date.now(),
          description: 'End of Month 30',
          type: 'end_of_month',
          days: 30,
        })
        .expect(201);
      eom30TermId = eomRes.body.id;
    });
  });

  describe('Invoice Due Date Generation', () => {
    it('calculates correct due date for Net 30 invoices', async () => {
      // Create Supplier with Net 30
      const suppRes = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorNumber: `V-NET30-${Date.now()}`,
          name: 'Net 30 Supplier',
          tradingTermsId: net30TermId,
          defaultApAccountId: arAccountId, // doesn't matter for this test
          defaultExpenseAccountId: salesAccountId, // doesn't matter for this test
          address1Country: 'AU',
        })
        .expect(201);

      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      const expectedDue = new Date('2026-07-15T00:00:00Z'); // 30 days later

      const invRes = await request(app.getHttpServer())
        .post('/api/purchase-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: suppRes.body.vendorId,
          supplierInvoiceNumber: `INV-NET-1-${Date.now()}`,
          invoiceDate: invoiceDate.toISOString(),
          currencyCode: 'AUD',
          totalAmount: 100,
          taxAmount: 0,
          lines: [
            {
              quantityInvoiced: 1,
              pricePerUnit: 100,
              glAccountId: salesAccountId,
            },
          ],
        })
        .expect(201);

      console.log('Invoice Response Net30:', invRes.body);

      expect(invRes.body.dueDate.split('T')[0]).toBe(
        expectedDue.toISOString().split('T')[0],
      );
    });

    it('calculates correct due date for EOM 30 invoices', async () => {
      const suppRes = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorNumber: `V-EOM30-${Date.now()}`,
          name: 'EOM 30 Supplier',
          tradingTermsId: eom30TermId,
          defaultApAccountId: arAccountId,
          defaultExpenseAccountId: salesAccountId,
          address1Country: 'AU',
        })
        .expect(201);

      const invoiceDate = new Date('2026-06-15T00:00:00Z');
      // End of June is June 30. Plus 30 days is July 30.
      const expectedDue = new Date('2026-07-30T00:00:00Z');

      const invRes = await request(app.getHttpServer())
        .post('/api/purchase-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId: suppRes.body.vendorId,
          supplierInvoiceNumber: `INV-EOM-1-${Date.now()}`,
          invoiceDate: invoiceDate.toISOString(),
          currencyCode: 'AUD',
          totalAmount: 100,
          taxAmount: 0,
          lines: [
            {
              quantityInvoiced: 1,
              pricePerUnit: 100,
              glAccountId: salesAccountId,
            },
          ],
        })
        .expect(201);

      expect(invRes.body.dueDate.split('T')[0]).toBe(
        expectedDue.toISOString().split('T')[0],
      );
    });
  });

  describe('Live GL Overdue Assessment Verification', () => {
    it('assesses overdue debt correctly for COD terms via GL entries', async () => {
      const custRes = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerNumber: `C-COD-${Date.now()}`,
          name: 'COD Assessment Customer',
          tradingTermsId: codTermId,
          billingAddressCountry: 'AU',
        })
        .expect(201);
      const customerId = custRes.body.customerId;

      // Create an overdue invoice for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const db = app.get(DRIZZLE);
      const locRes = await db.select().from(locations).limit(1);
      const locId = locRes[0]?.locationId;
      const [pastOrder] = await db
        .insert(salesOrders)
        .values({
          customerId: customerId,
          orderNumber: `SO-COD-${Date.now()}`,
          currencyCode: 'USD',
          fulfillmentLocationId: locId,
          stateCode: 'invoiced',
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await db.insert(salesInvoices).values({
        salesOrderId: pastOrder.salesOrderId,
        invoiceNumber: `INV-COD-${Date.now()}`,
        totalAmount: '1000.00',
        outstandingAmount: '1000.00',
        currencyCode: 'USD',
        stateCode: 'unpaid',
        dueDate: yesterday,
        taxAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const assessRes = await creditAssessmentService.assessCredit(customerId);

      expect(assessRes.totalInvoiceBalance).toBe(1000);
      expect(assessRes.overdueInvoiceBalance).toBe(1000);
      expect(assessRes.isOverdue).toBe(true);
    });

    it('assesses overdue debt correctly for EOM terms via GL entries', async () => {
      const custRes = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerNumber: `C-EOM-${Date.now()}`,
          name: 'EOM Assessment Customer',
          tradingTermsId: eom30TermId,
          billingAddressCountry: 'AU',
        })
        .expect(201);
      const customerId = custRes.body.customerId;

      const today = new Date();
      // Mid last month -> Due end of THIS month (Not overdue yet)
      const future = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      const past = new Date(today.getFullYear(), today.getMonth() - 1, 15);

      const db = app.get(DRIZZLE);
      const locRes = await db.select().from(locations).limit(1);
      const locId = locRes[0]?.locationId;

      const [pastOrder1] = await db
        .insert(salesOrders)
        .values({
          customerId: customerId,
          orderNumber: `SO-EOM1-${Date.now()}`,
          currencyCode: 'USD',
          fulfillmentLocationId: locId,
          stateCode: 'invoiced',
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await db.insert(salesInvoices).values({
        salesOrderId: pastOrder1.salesOrderId,
        invoiceNumber: `INV-EOM1-${Date.now()}`,
        totalAmount: '500.00',
        outstandingAmount: '500.00',
        currencyCode: 'USD',
        stateCode: 'unpaid',
        dueDate: future,
        taxAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const [pastOrder2] = await db
        .insert(salesOrders)
        .values({
          customerId: customerId,
          orderNumber: `SO-EOM2-${Date.now()}`,
          currencyCode: 'USD',
          fulfillmentLocationId: locId,
          stateCode: 'invoiced',
          baseTotalAmount: '0',
          exchangeRate: '1',
          discrepanciesAcknowledged: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();
      await db.insert(salesInvoices).values({
        salesOrderId: pastOrder2.salesOrderId,
        invoiceNumber: `INV-EOM2-${Date.now()}`,
        totalAmount: '200.00',
        outstandingAmount: '200.00',
        currencyCode: 'USD',
        stateCode: 'unpaid',
        dueDate: past,
        taxAmount: '0',
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
        createdBy: 'system',
      });

      const assessRes = await creditAssessmentService.assessCredit(customerId);

      expect(assessRes.totalInvoiceBalance).toBe(700);
      expect(assessRes.overdueInvoiceBalance).toBe(200); // Only the older one
      expect(assessRes.isOverdue).toBe(true);
    });
  });
});
