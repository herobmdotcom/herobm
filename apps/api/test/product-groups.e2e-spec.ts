import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Product Groups (e2e)', () => {
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

  it('CRUD /api/product-groups — full lifecycle', async () => {
    const groupCode = `PROD-GRP-${Date.now()}`;

    // 1. Create a group
    const createRes = await request(app.getHttpServer())
      .post('/api/product-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupCode,
        name: 'E2E Test Product Group',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.productGroupId).toBeDefined();
    expect(createRes.body.groupCode).toBe(groupCode);
    const groupId = createRes.body.productGroupId;

    // 2. Read all groups
    const listRes = await request(app.getHttpServer())
      .get('/api/product-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(
      listRes.body.find((g: any) => g.productGroupId === groupId),
    ).toBeDefined();

    // 3. Read single group
    const getRes = await request(app.getHttpServer())
      .get(`/api/product-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('E2E Test Product Group');

    // 4. Assign a product to the group
    const createProductRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `GRP-MEMBER-${Date.now()}`,
        name: 'Group Member Product',
        productGroupId: groupId,
      });
    expect(createProductRes.status).toBe(201);
    expect(createProductRes.body.productGroupId).toBe(groupId);

    // 5. Verify the group name merges into the product payload correctly
    const productRes = await request(app.getHttpServer())
      .get(`/api/products/${createProductRes.body.productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const foundAcc = productRes.body;
    expect(foundAcc.productId).toBeDefined();
    expect(foundAcc.productGroupCode).toBe(groupCode);
    expect(foundAcc.productGroupName).toBe('E2E Test Product Group');

    // 6. Update the group
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/product-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Product Group',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Product Group');

    // 7. Delete the group (first cleanly un-assign the product to avoid FK errors)
    await request(app.getHttpServer())
      .patch(`/api/products/${createProductRes.body.productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productGroupId: null });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/product-groups/${groupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });
});
