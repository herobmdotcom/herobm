import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';

describe('Account Groups (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('CRUD /api/account-groups — full lifecycle', async () => {
    const groupCode = `ACC-GRP-${Date.now()}`;

    // 1. Create a group
    const createRes = await request(app.getHttpServer())
      .post('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupCode,
        name: 'E2E Test Account Group',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.customerGroupId).toBeDefined();
    expect(createRes.body.groupCode).toBe(groupCode);
    const groupId = createRes.body.customerGroupId;

    // 2. Read all groups
    const listRes = await request(app.getHttpServer())
      .get('/api/customer-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(
      listRes.body.find(
        (g: { customerGroupId: string }) => g.customerGroupId === groupId,
      ),
    ).toBeDefined();

    // 3. Read single group
    const getRes = await request(app.getHttpServer())
      .get(`/api/customer-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('E2E Test Account Group');

    // 4. Assign an account to the group
    const createCustomerRes = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber: `GRP-MEMBER-${Date.now()}`,
        name: 'Group Member',
        customerGroupId: groupId,
      });
    expect(createCustomerRes.status).toBe(201);
    expect(createCustomerRes.body.customerGroupId).toBe(groupId);

    // 5. Verify the group name merges into the account payload correctly
    const accountListRes = await request(app.getHttpServer())
      .get('/api/customers?limit=1000&orderDirection=desc')
      .set('Authorization', `Bearer ${adminToken}`);
    const foundAcc = accountListRes.body.data.find(
      (a: { customerId: string }) =>
        a.customerId === createCustomerRes.body.customerId,
    );
    expect(foundAcc).toBeDefined();
    expect(foundAcc.customerGroupCode).toBe(groupCode);
    expect(foundAcc.customerGroupName).toBe('E2E Test Account Group');

    // 6. Update the group
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/customer-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Account Group',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Account Group');

    // 7. Delete the group (first cleanly un-assign the account to avoid FK errors)
    await request(app.getHttpServer())
      .patch(`/api/customers/${createCustomerRes.body.customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerGroupId: null });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/customer-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });
});
