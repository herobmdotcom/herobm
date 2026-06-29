import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import {
  glJournalEntries,
  glJournalLines,
  glAccounts,
  users,
  salesOrders,
  salesInvoices,
  locations,
} from '../src/drizzle/herobm-core-schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

describe('Credit Control Lifecycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let arAccountId: string;
  let revAccountId: string;
  let productId: string;
  let suffix: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    setupE2eApp(app);
    await app.init();

    suffix = Math.random().toString(36).substring(7);

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    adminToken = adminRes.body.access_token;

    // Create a viewer user
    const db = app.get(DRIZZLE);
    const viewerId = crypto.randomUUID();
    const testPass = 'test-pass';
    await db.insert(users).values({
      userId: viewerId,
      username: `viewer-${suffix}`,
      passwordHash: await bcrypt.hash(testPass, 10),
      email: `viewer-${suffix}@test.com`,
      firstName: 'Viewer',
      lastName: 'Test',
      role: 'viewer',
    });

    const enforcer = app.get('CASBIN_ENFORCER');
    await enforcer.addRoleForUser(`viewer-${suffix}`, 'viewer');

    // Login as viewer
    const viewerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: `viewer-${suffix}`,
        password: testPass,
      });
    viewerToken = viewerRes.body.access_token;

    // Get GL Accounts
    const arRes = await db
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.accountType, 'asset'))
      .limit(1);
    const revRes = await db
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.accountType, 'revenue'))
      .limit(1);
    arAccountId = arRes[0].glAccountId;
    revAccountId = revRes[0].glAccountId;

    // Get a product
    const prodRes = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    productId = prodRes.body.data[0].productId;
  });

  afterAll(async () => {
    await app.close();
  });

  const createCustomer = async (payload: any) => {
    const custRes = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    return custRes.body.customerId;
  };

  async function createOrder(customerId: string, price: number) {
    return request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        salesOrderId: crypto.randomUUID(),
        customerId,
        lines: [
          {
            productId,
            quantity: '1',
            pricePerUnit: price.toString(),
            tax: '0.00',
          },
        ],
        deliveryAddressLine1: 'Test',
      });
  }

  it('should block confirmation for manual credit hold', async () => {
    const customerId = await createCustomer({
      customerNumber: `HOLD-${suffix}`,
      name: 'Hold Customer',
      billingAddressCountry: 'AU',
      isOnCreditHold: true,
    });

    const orderRes = await createOrder(customerId, 100);
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.salesOrderId;

    const confirmRes = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${orderId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });

    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.message).toContain('customer_credit_hold');
  });

  describe('Credit limit behavior - strict', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .patch('/api/settings/app')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ creditLimitBehavior: 'hard' });
    });

    afterAll(async () => {
      await request(app.getHttpServer())
        .patch('/api/settings/app')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ creditLimitBehavior: 'soft' });
    });

    it('should block order creation for strict credit limit exceeded', async () => {
      const customerId = await createCustomer({
        customerNumber: `LIMIT-${suffix}`,
        name: 'Limit Customer',
        billingAddressCountry: 'AU',
        creditLimit: '50.00',
      });

      const orderRes = await createOrder(customerId, 100);
      expect(orderRes.status).toBe(400);
      expect(orderRes.body.message).toContain('credit_limit_exceeded');
    });
  });

  it('should prevent standard users from modifying credit limits', async () => {
    const customerId = await createCustomer({
      customerNumber: `PERM-${suffix}`,
      name: 'Perm Customer',
      billingAddressCountry: 'AU',
    });

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ creditLimit: '1000' });

    expect(patchRes.status).toBe(403);
  });

  it('should block overdue balance but allow a single order override', async () => {
    const termRes = await request(app.getHttpServer())
      .post('/api/settings/trading-terms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `NET_0_${suffix}`,
        description: 'Due Immediately',
        type: 'net',
        days: 0,
      });
    const termId = termRes.body.id;

    const customerId = await createCustomer({
      customerNumber: `OVERDUE-${suffix}`,
      name: 'Overdue Customer',
      billingAddressCountry: 'AU',
      tradingTermsId: termId,
      creditLimit: '10000',
    });

    const db = app.get(DRIZZLE);
    const entryDate = new Date();
    entryDate.setDate(entryDate.getDate() - 5);

    const locRes = await db.select().from(locations).limit(1);
    const locId = locRes[0]?.locationId;

    const [pastOrder] = await db
      .insert(salesOrders)
      .values({
        customerId: customerId,
        orderNumber: `SO-E2E-${suffix}`,
        currencyCode: 'USD',
        fulfillmentLocationId: locId,
        stateCode: 'invoiced',
      })
      .returning();

    await db.insert(salesInvoices).values({
      salesOrderId: pastOrder.salesOrderId,
      invoiceNumber: `INV-E2E-${suffix}`,
      totalAmount: '500.00',
      outstandingAmount: '500.00',
      currencyCode: 'USD',
      stateCode: 'unpaid',
      dueDate: entryDate,
    });

    // Create Order 1
    const order1Res = await createOrder(customerId, 100);
    const order1Id = order1Res.body.salesOrderId;

    // Confirm should fail due to overdue balance
    const confirm1Res = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${order1Id}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });
    expect(confirm1Res.status).toBe(400);
    expect(confirm1Res.body.message).toContain('overdue_balance');

    // Override Order 1
    const overrideRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${order1Id}/override-credit-hold`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Approved for test' });
    expect(overrideRes.status).toBe(200);

    // Confirm Order 1 should now succeed
    const confirm2Res = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${order1Id}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });
    expect(confirm2Res.status).toBe(200);

    // Create Order 2 (should still be blocked because override was for Order 1 only)
    const order2Res = await createOrder(customerId, 100);
    const order2Id = order2Res.body.salesOrderId;

    const confirm3Res = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${order2Id}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });
    expect(confirm3Res.status).toBe(400);
    expect(confirm3Res.body.message).toContain('overdue_balance');

    // Customer level override
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const overrideCustomerRes = await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ overrideCreditHoldUntil: futureDate.toISOString() });

    if (overrideCustomerRes.status !== 200) {
      console.error('OVERRIDE FAILED:', overrideCustomerRes.body);
    }
    expect(overrideCustomerRes.status).toBe(200);

    // Confirm Order 2 should now succeed without order-level override
    const confirm4Res = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${order2Id}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });

    if (confirm4Res.status !== 200) {
      console.error('SO CONFIRM FAILED:', confirm4Res.body);
    }
    expect(confirm4Res.status).toBe(200);
  });
});
