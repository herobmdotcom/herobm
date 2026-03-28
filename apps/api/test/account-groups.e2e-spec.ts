import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Account Groups (e2e)', () => {
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
    adminToken = adminRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('CRUD /api/account-groups — full lifecycle', async () => {
    const groupCode = `ACC-GRP-${Date.now()}`;

    // 1. Create a group
    const createRes = await request(app.getHttpServer())
      .post('/api/account-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupCode,
        name: 'E2E Test Account Group',
        defaultDiscountPercentage: '10.5',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.accountGroupId).toBeDefined();
    expect(createRes.body.groupCode).toBe(groupCode);
    const groupId = createRes.body.accountGroupId;

    // 2. Read all groups
    const listRes = await request(app.getHttpServer())
      .get('/api/account-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(
      listRes.body.find((g: any) => g.accountGroupId === groupId),
    ).toBeDefined();

    // 3. Read single group
    const getRes = await request(app.getHttpServer())
      .get(`/api/account-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('E2E Test Account Group');

    // 4. Assign an account to the group
    const createAccountRes = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accountNumber: `GRP-MEMBER-${Date.now()}`,
        name: 'Group Member',
        accountGroupId: groupId,
      });
    expect(createAccountRes.status).toBe(201);
    expect(createAccountRes.body.accountGroupId).toBe(groupId);

    // 5. Verify the group name merges into the account payload correctly
    const accountListRes = await request(app.getHttpServer())
      .get('/api/accounts?limit=1000&orderDirection=desc')
      .set('Authorization', `Bearer ${adminToken}`);
    const foundAcc = accountListRes.body.data.find(
      (a: any) => a.accountId === createAccountRes.body.accountId,
    );
    expect(foundAcc).toBeDefined();
    expect(foundAcc.accountGroupCode).toBe(groupCode);
    expect(foundAcc.accountGroupName).toBe('E2E Test Account Group');

    // 6. Update the group
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/account-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Account Group',
        defaultDiscountPercentage: '15.0',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Account Group');
    expect(updateRes.body.defaultDiscountPercentage).toBe('15.0');

    // 7. Delete the group (first cleanly un-assign the account to avoid FK errors)
    await request(app.getHttpServer())
      .patch(`/api/accounts/${createAccountRes.body.accountId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accountGroupId: null });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/account-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });
});
