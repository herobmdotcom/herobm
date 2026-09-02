import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Actors (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let createdActorId: string;
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
        firstName: 'Actor',
        lastName: 'Contact',
        email: 'actor.contact@example.com',
      });
    createdContactId = contactRes.body.contactId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/actors — creates a new actor (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/actors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Actor',
        actorType: 'customer',
        email: 'e2e@actor.com',
        isTaxRegistered: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.actorId).toBeDefined();
    expect(res.body.name).toBe('E2E Actor');
    createdActorId = res.body.actorId;
  });

  it('GET /api/actors — returns a list of actors (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/actors')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/actors/:id — returns an actor by ID (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/actors/${createdActorId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.actorId).toBe(createdActorId);
    expect(res.body.name).toBe('E2E Actor');
  });

  it('PATCH /api/actors/:id — updates an actor (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/actors/${createdActorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Actor Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Actor Updated');
  });

  describe('Nested Routes', () => {
    let noteId: string;

    it('POST /api/actors/:id/notes — adds a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/actors/${createdActorId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Important actor note',
        });

      expect(res.status).toBe(201);
      expect(res.body.noteId).toBeDefined();
      noteId = res.body.noteId;
    });

    it('DELETE /api/actors/:id/notes/:noteId — removes a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/actors/${createdActorId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/actors/:id/contacts — adds a contact (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/actors/${createdActorId}/contacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId: createdContactId,
          primaryFor: ['billing'],
        });

      expect(res.status).toBe(201);
    });

    it('PATCH /api/actors/:id/contacts/:contactId — updates contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/actors/${createdActorId}/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          primaryFor: ['billing', 'shipping'],
        });

      expect(res.status).toBe(200);
    });

    it('DELETE /api/actors/:id/contacts/:contactId — removes a contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/actors/${createdActorId}/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Referral Tracking', () => {
    let parentActorId: string;
    let childActorId: string;

    it('POST /api/actors — creates actor with referral data (admin)', async () => {
      // 1. Create referer
      const pRes = await request(app.getHttpServer())
        .post('/api/actors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Referer Actor',
          actorType: 'partner',
          isTaxRegistered: false,
        });
      parentActorId = pRes.body.actorId;

      // 2. Create child with referral info
      const cRes = await request(app.getHttpServer())
        .post('/api/actors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Referred Actor',
          actorType: 'customer',
          referralMode: 'Partner',
          referredByActorId: parentActorId,
          referredByContactId: createdContactId,
          referralNote: 'Found us at a conference',
          isTaxRegistered: false,
        });

      expect(cRes.status).toBe(201);
      childActorId = cRes.body.actorId;
      expect(cRes.body.referralMode).toBe('Partner');
      expect(cRes.body.referredByActorId).toBe(parentActorId);
      expect(cRes.body.referredByContactId).toBe(createdContactId);
      expect(cRes.body.referralNote).toBe('Found us at a conference');
    });

    it('GET /api/actors/:id — exposes referral link names (viewer)', async () => {
      const getRes = await request(app.getHttpServer())
        .get(`/api/actors/${childActorId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.referredByActorId).toBe(parentActorId);
      expect(getRes.body.referredByActorName).toBe('Referer Actor');
      expect(getRes.body.referredByContactId).toBe(createdContactId);
      expect(getRes.body.referredByContactName).toContain('Actor Contact');
    });

    it('PATCH /api/actors/:id — clears referral links (admin)', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/actors/${childActorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          referredByActorId: null,
          referredByContactId: null,
          referralNote: null,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.referredByActorId).toBeNull();
      expect(patchRes.body.referredByContactId).toBeNull();
      expect(patchRes.body.referralNote).toBeNull();
    });
  });

  it('DELETE /api/actors/:id — deletes an actor (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/actors/${createdActorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/actors/${createdActorId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(404);
  });
});
