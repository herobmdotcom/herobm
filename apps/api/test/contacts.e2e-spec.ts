import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Contacts (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let createdContactId: string;

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

  it('POST /api/contacts — creates a new contact (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/contacts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'E2E Contact',
        lastName: 'Test',
        email: 'e2e.contact@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.contactId).toBeDefined();
    expect(res.body.firstName).toBe('E2E Contact');
    createdContactId = res.body.contactId;
  });

  it('GET /api/contacts — returns a list of contacts (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/contacts')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/contacts/:id — updates a contact (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/contacts/${createdContactId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'E2E Contact Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('E2E Contact Updated');
    expect(res.body.fullName).toBe('E2E Contact Updated Test');
  });

  it('DELETE /api/contacts/:id — deletes a contact (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/contacts/${createdContactId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
