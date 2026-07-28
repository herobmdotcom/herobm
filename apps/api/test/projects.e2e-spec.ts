import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PROJECT_STATE } from '@herobm/shared';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let createdProjectId: string;
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
        firstName: 'Project',
        lastName: 'Contact',
        email: 'project.contact@example.com',
      });
    createdContactId = contactRes.body.contactId;

    // Setup an actor
    const actorRes = await request(app.getHttpServer())
      .post('/api/actors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Project Actor',
        actorType: 'supplier',
      });
    createdActorId = actorRes.body.actorId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/projects — creates a new project (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Project',
        type: 'implementation',
      });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBeDefined();
    expect(res.body.name).toBe('E2E Project');
    createdProjectId = res.body.projectId;
  });

  it('GET /api/projects — returns a list of projects (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/projects/:id — returns a project by ID (viewer)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(createdProjectId);
    expect(res.body.name).toBe('E2E Project');
  });

  it('PATCH /api/projects/:id — updates a project (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Project Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Project Updated');
  });

  describe('Nested Routes', () => {
    let noteId: string;

    it('POST /api/projects/:id/notes — adds a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${createdProjectId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Important project note',
        });

      expect(res.status).toBe(201);
      expect(res.body.noteId).toBeDefined();
      noteId = res.body.noteId;
    });

    it('DELETE /api/projects/:id/notes/:noteId — removes a note (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/projects/${createdProjectId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/projects/:id/contacts — adds a contact (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${createdProjectId}/contacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          contactId: createdContactId,
          roles: ['Decision Maker'],
        });

      expect(res.status).toBe(201);

      const getRes = await request(app.getHttpServer())
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(
        getRes.body.projectContacts.find(
          (pc: any) => pc.contactId === createdContactId,
        ),
      ).toBeDefined();
    });

    it('PATCH /api/projects/:id/contacts/:contactId — updates contact role (admin)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${createdProjectId}/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['Decision Maker', 'Influencer'],
        });

      expect(res.status).toBe(200);

      const getRes = await request(app.getHttpServer())
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const link = getRes.body.projectContacts.find(
        (pc: any) => pc.contactId === createdContactId,
      );
      expect(link.roles).toContain('Influencer');
    });

    it('DELETE /api/projects/:id/contacts/:contactId — removes a contact link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/api/projects/${createdProjectId}/contacts/${createdContactId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('POST /api/projects/:id/actors — adds an actor (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${createdProjectId}/actors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          actorId: createdActorId,
          roles: ['supplier'],
        });

      expect(res.status).toBe(201);
    });

    it('DELETE /api/projects/:id/actors/:actorId — removes an actor link (admin)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/projects/${createdProjectId}/actors/${createdActorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  it('DELETE /api/projects/:id — deletes a project (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(404);
  });
});
