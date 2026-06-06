import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Supplier Groups (e2e)', () => {
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

  it('CRUD /api/supplier-groups — full lifecycle', async () => {
    const groupCode = `SUP-GRP-${Date.now()}`;

    // 1. Create a group
    const createRes = await request(app.getHttpServer())
      .post('/api/supplier-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupCode,
        name: 'E2E Test Supplier Group',
      });
    if (createRes.status !== 201) {
      console.log('Create Failed! Response Body:', createRes.body);
    }
    expect(createRes.status).toBe(201);
    expect(createRes.body.supplierGroupId).toBeDefined();
    expect(createRes.body.groupCode).toBe(groupCode);
    const groupId = createRes.body.supplierGroupId;

    // 2. Read all groups
    const listRes = await request(app.getHttpServer())
      .get('/api/supplier-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(
      listRes.body.find((g: any) => g.supplierGroupId === groupId),
    ).toBeDefined();

    // 3. Read single group
    const getRes = await request(app.getHttpServer())
      .get(`/api/supplier-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('E2E Test Supplier Group');

    // 4. Assign an account to the group
    const createSupplierRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address1Country: 'AU',
        vendorNumber: `GRP-MEMBER-${Date.now()}`,
        name: 'Group Member Supplier',
        supplierGroupId: groupId,
      });
    expect(createSupplierRes.status).toBe(201);
    expect(createSupplierRes.body.supplierGroupId).toBe(groupId);

    // 5. Verify the group name merges into the account payload correctly
    const supplierListRes = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1000&orderDirection=desc')
      .set('Authorization', `Bearer ${adminToken}`);
    const foundAcc = supplierListRes.body.data.find(
      (a: any) => a.vendorId === createSupplierRes.body.vendorId,
    );
    expect(foundAcc).toBeDefined();
    expect(foundAcc.supplierGroupCode).toBe(groupCode);
    expect(foundAcc.supplierGroupName).toBe('E2E Test Supplier Group');

    // 6. Update the group
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/supplier-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Supplier Group',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Supplier Group');

    // 7. Delete the group (first cleanly un-assign the account to avoid FK errors)
    await request(app.getHttpServer())
      .patch(`/api/suppliers/${createSupplierRes.body.vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplierGroupId: null });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/supplier-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });
});
