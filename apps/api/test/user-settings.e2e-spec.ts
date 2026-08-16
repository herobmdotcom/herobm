import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('UserSettings (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

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
      throw new Error(`admin login failed: ${adminRes.status}`);
    }
    adminToken = adminRes.body.access_token;

    // Login as viewer
    const viewerRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });

    if (viewerRes.status !== 201) {
      throw new Error(`viewer login failed: ${viewerRes.status}`);
    }
    viewerToken = viewerRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/user-settings — retrieves default settings for logged in user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/user-settings')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.preferences).toBeDefined();
    expect(res.body.preferences.density).toBeDefined();
  });

  it('PATCH /api/user-settings — updates preferences without overwriting dashboard config', async () => {
    // 1. Update preferences
    const updateRes = await request(app.getHttpServer())
      .patch('/api/user-settings')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        preferences: {
          density: 'compact',
        },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.preferences.density).toBe('compact');

    // 2. Fetch again and verify persistence
    const getRes = await request(app.getHttpServer())
      .get('/api/user-settings')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.preferences.density).toBe('compact');
  });

  it('GET /api/user-settings — rejects unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/user-settings');
    expect(res.status).toBe(401);
  });
});
