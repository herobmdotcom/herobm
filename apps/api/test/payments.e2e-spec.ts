import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';

import request from 'supertest';

describe('Payments (e2e)', () => {
  let app: INestApplication;

  let server: any;
  let jwtToken: string;

  let bankAccountId: string;
  let supplierId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer();

    // Login as admin
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    jwtToken = loginRes.body.access_token;

    // Get a bank account
    const bankRes = await request(server)
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    // find a bank account from the tree
    let foundBankId = null;
    interface BankAccountNode {
      isGroup: boolean;
      isBankAccount: boolean;
      glAccountId: string;
      children?: BankAccountNode[];
    }
    const walk = (nodes: BankAccountNode[]) => {
      for (const node of nodes) {
        if (!node.isGroup && node.isBankAccount) {
          foundBankId = node.glAccountId;
          return;
        }
        if (node.children) walk(node.children);
      }
    };
    walk(bankRes.body);
    bankAccountId = foundBankId || bankRes.body[0]?.glAccountId; // fallback

    // Get a supplier
    const supplierRes = await request(server)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
    supplierId =
      supplierRes.body.data?.[0]?.vendorId || supplierRes.body[0]?.vendorId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow deleting a DRAFT payment', async () => {
    // Create draft payment
    const createRes = await request(server)
      .post('/api/payments')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        paymentType: 'supplier_payment',
        partyType: 'supplier',
        partyId: supplierId,
        paymentDate: new Date().toISOString(),
        modeOfPayment: 'EFT',
        totalAmount: 100.0,
        glAccountBank: bankAccountId,
        currencyCode: 'AUD',
        submitImmediately: false, // DRAFT
      })
      .expect(201);

    const paymentId = createRes.body.paymentId;
    expect(paymentId).toBeDefined();

    // Delete draft payment
    await request(server)
      .delete(`/api/payments/${paymentId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    // Verify it is gone
    await request(server)
      .get(`/api/payments/${paymentId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(404);
  });

  it('should NOT allow cancelling a DRAFT payment', async () => {
    // Create draft payment
    const createRes = await request(server)
      .post('/api/payments')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        paymentType: 'supplier_payment',
        partyType: 'supplier',
        partyId: supplierId,
        paymentDate: new Date().toISOString(),
        modeOfPayment: 'EFT',
        totalAmount: 200.0,
        glAccountBank: bankAccountId,
        currencyCode: 'AUD',
        submitImmediately: false, // DRAFT
      })
      .expect(201);

    const paymentId = createRes.body.paymentId;

    // Attempt to cancel draft payment
    const cancelRes = await request(server)
      .patch(`/api/payments/${paymentId}/cancel`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({})
      .expect(400);

    expect(cancelRes.body.message).toContain(
      'Only submitted payments can be cancelled',
    );
  });
});
