import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Opportunities (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let createdOpportunityId: string;
  let createdContactId: string;
  let createdActorId: string;

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
        firstName: 'Opportunity',
        lastName: 'Contact',
        email: 'opp.contact@example.com',
      });
    createdContactId = contactRes.body.contactId;

    // Setup an actor
    const actorRes = await request(app.getHttpServer())
      .post('/api/actors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Opportunity Actor',
        actorType: 'supplier',
      });
    createdActorId = actorRes.body.actorId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/opportunities — creates a new opportunity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Opportunity',
        type: 'implementation',
      });

    expect(res.status).toBe(201);
    expect(res.body.opportunityId).toBeDefined();
    expect(res.body.name).toBe('E2E Opportunity');
    createdOpportunityId = res.body.opportunityId;
  });

  it('GET /api/opportunities — returns a list of opportunities (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/opportunities')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/opportunities/:id — returns an opportunity by ID (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/opportunities/${createdOpportunityId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.opportunityId).toBe(createdOpportunityId);
    expect(res.body.name).toBe('E2E Opportunity');
  });

  it('PATCH /api/opportunities/:id — updates an opportunity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/opportunities/${createdOpportunityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Opportunity Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Opportunity Updated');
  });

  describe('Nested Routes', () => {
    let noteId: string;

    it('POST /api/opportunities/:id/notes — adds a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/opportunities/${createdOpportunityId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Important opportunity note',
        });

      expect(res.status).toBe(201);
      expect(res.body.noteId).toBeDefined();
      noteId = res.body.noteId;
    });

    it('DELETE /api/opportunities/:id/notes/:noteId — removes a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/opportunities/${createdOpportunityId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/opportunities/:id/contacts — adds a contact (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/opportunities/${createdOpportunityId}/contacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId: createdContactId,
          roles: ['Decision Maker'],
        });

      expect(res.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get(`/api/opportunities/${createdOpportunityId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(
        getRes.body.opportunityContacts.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test check
          (pc: any) => pc.contactId === createdContactId,
        ),
      ).toBeDefined();
    });

    it('PATCH /api/opportunities/:id/contacts/:contactId — updates contact role (admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/opportunities/${createdOpportunityId}/contacts/${createdContactId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['Decision Maker', 'Influencer'],
        });

      expect(res.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/api/opportunities/${createdOpportunityId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const link = getRes.body.opportunityContacts.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test check
        (pc: any) => pc.contactId === createdContactId,
      );
      expect(link.roles).toContain('Influencer');
    });

    it('DELETE /api/opportunities/:id/contacts/:contactId — removes a contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/opportunities/${createdOpportunityId}/contacts/${createdContactId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/opportunities/:id/actors — adds an actor (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/opportunities/${createdOpportunityId}/actors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          actorId: createdActorId,
          roles: ['supplier'],
        });

      expect(res.status).toBe(201);
    });

    it('DELETE /api/opportunities/:id/actors/:actorId — removes an actor link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/opportunities/${createdOpportunityId}/actors/${createdActorId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  it('DELETE /api/opportunities/:id — deletes an opportunity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/opportunities/${createdOpportunityId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/opportunities/${createdOpportunityId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(404);
  });
});
