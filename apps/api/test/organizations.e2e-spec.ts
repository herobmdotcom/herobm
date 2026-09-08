import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let createdOrganizationId: string;
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

    // Setup a contact for tests
    const contactRes = await request(app.getHttpServer())
      .post('/api/contacts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Organization',
        lastName: 'Contact',
        email: 'org.contact@example.com',
      });
    createdContactId = contactRes.body.contactId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/organizations — creates a new organization (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Organization',
        organizationType: 'customer',
        email: 'e2e@organization.com',
        isTaxRegistered: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBeDefined();
    expect(res.body.name).toBe('E2E Organization');
    createdOrganizationId = res.body.organizationId;
  });

  it('GET /api/organizations — returns a list of organizations (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/organizations/:id — returns an organization by ID (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/organizations/${createdOrganizationId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(createdOrganizationId);
    expect(res.body.name).toBe('E2E Organization');
  });

  it('PATCH /api/organizations/:id — updates an organization (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/organizations/${createdOrganizationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Organization Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Organization Updated');
  });

  describe('Nested Routes', () => {
    let noteId: string;

    it('POST /api/organizations/:id/notes — adds a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/organizations/${createdOrganizationId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Important organization note',
        });

      expect(res.status).toBe(201);
      expect(res.body.noteId).toBeDefined();
      noteId = res.body.noteId;
    });

    it('DELETE /api/organizations/:id/notes/:noteId — removes a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/organizations/${createdOrganizationId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/organizations/:id/contacts — adds a contact (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/organizations/${createdOrganizationId}/contacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId: createdContactId,
          primaryFor: ['billing'],
        });

      expect(res.status).toBe(201);
    });

    it('PATCH /api/organizations/:id/contacts/:contactId — updates contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/organizations/${createdOrganizationId}/contacts/${createdContactId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          primaryFor: ['billing', 'shipping'],
        });

      expect(res.status).toBe(200);
    });

    it('DELETE /api/organizations/:id/contacts/:contactId — removes a contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/organizations/${createdOrganizationId}/contacts/${createdContactId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Referral Tracking', () => {
    let parentOrganizationId: string;
    let childOrganizationId: string;

    it('POST /api/organizations — creates organization with referral data (admin)', async () => {
      // 1. Create referer
      const pRes = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Referer Organization',
          organizationType: 'partner',
          isTaxRegistered: false,
        });
      parentOrganizationId = pRes.body.organizationId;

      // 2. Create child with referral info
      const cRes = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Referred Organization',
          organizationType: 'customer',
          referralMode: 'Partner',
          referredByOrganizationId: parentOrganizationId,
          referredByContactId: createdContactId,
          referralNote: 'Found us at a conference',
          isTaxRegistered: false,
        });

      expect(cRes.status).toBe(201);
      childOrganizationId = cRes.body.organizationId;
      expect(cRes.body.referralMode).toBe('Partner');
      expect(cRes.body.referredByOrganizationId).toBe(parentOrganizationId);
      expect(cRes.body.referredByContactId).toBe(createdContactId);
      expect(cRes.body.referralNote).toBe('Found us at a conference');
    });

    it('GET /api/organizations/:id — exposes referral link names (viewer)', async () => {
      const getRes = await request(app.getHttpServer())
        .get(`/api/organizations/${childOrganizationId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.referredByOrganizationId).toBe(parentOrganizationId);
      expect(getRes.body.referredByOrganizationName).toBe(
        'Referer Organization',
      );
      expect(getRes.body.referredByContactId).toBe(createdContactId);
      expect(getRes.body.referredByContactName).toContain(
        'Organization Contact',
      );
    });

    it('PATCH /api/organizations/:id — clears referral links (admin)', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/organizations/${childOrganizationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          referredByOrganizationId: null,
          referredByContactId: null,
          referralNote: null,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.referredByOrganizationId).toBeNull();
      expect(patchRes.body.referredByContactId).toBeNull();
      expect(patchRes.body.referralNote).toBeNull();
    });
  });

  it('DELETE /api/organizations/:id — deletes an organization (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/organizations/${createdOrganizationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/organizations/${createdOrganizationId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(404);
  });
});
