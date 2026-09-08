import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('CRM Activities (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let testContactId: string;
  let testOrganizationId: string;
  let createdActivityId: string;
  let createdTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    setupE2eApp(app);
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

    // Create a contact
    const contactRes = await request(app.getHttpServer())
      .post('/api/contacts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Activity',
        lastName: 'Contact',
        email: 'activity.contact@example.com',
      });
    testContactId = contactRes.body.contactId;

    // Create an organization
    const orgRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Activity Organization Corp',
      });
    testOrganizationId = orgRes.body.organizationId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/crm-activities — creates a new CRM call activity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/crm-activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'call',
        subject: 'Initial intro discovery call',
        description: 'Discussed client requirements and potential timeline.',
        status: 'open',
        priority: 'medium',
        contactIds: [testContactId],
        organizationId: testOrganizationId,
      });

    expect(res.status).toBe(201);
    expect(res.body.activityId).toBeDefined();
    expect(res.body.type).toBe('call');
    expect(res.body.subject).toBe('Initial intro discovery call');
    expect(res.body.status).toBe('open');
    expect(res.body.priority).toBe('medium');
    expect(res.body.organizationId).toBe(testOrganizationId);
    expect(res.body.contacts).toHaveLength(1);
    expect(res.body.contacts[0].contactId).toBe(testContactId);
    createdActivityId = res.body.activityId;
  });

  it('POST /api/crm-activities — creates a task activity with due date (admin)', async () => {
    const dueDate = new Date(Date.now() + 86400000 * 3).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/crm-activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'task',
        subject: 'Prepare migration roadmap proposal',
        description: 'Send proposal document before end of week.',
        status: 'open',
        priority: 'high',
        organizationId: testOrganizationId,
        dueDate,
      });

    expect(res.status).toBe(201);
    expect(res.body.activityId).toBeDefined();
    expect(res.body.type).toBe('task');
    expect(res.body.status).toBe('open');
    expect(res.body.priority).toBe('high');
    expect(res.body.dueDate).toBeDefined();
    createdTaskId = res.body.activityId;
  });

  it('POST /api/crm-activities — supports dynamic/custom activity types (admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/crm-activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'in_person_meeting',
        subject: 'Onsite architecture review',
        description: 'Deep dive into legacy system migration.',
        status: 'scheduled',
        priority: 'urgent',
        organizationId: testOrganizationId,
      });

    expect(res.status).toBe(201);
    expect(res.body.activityId).toBeDefined();
    expect(res.body.type).toBe('in_person_meeting');
    expect(res.body.status).toBe('scheduled');
    expect(res.body.priority).toBe('urgent');
  });

  it('GET /api/crm-activities — returns a list of activities (admin)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/crm-activities')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/crm-activities — respects task privacy scoping for non-admin viewer', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/crm-activities')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Viewer sees public non-task activities (call and meeting), but not admin's private task
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test validation
    expect(
      res.body.data.some((a: any) => a.activityId === createdActivityId),
    ).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test validation
    expect(res.body.data.some((a: any) => a.activityId === createdTaskId)).toBe(
      false,
    );
  });

  it('GET /api/crm-activities?organizationId=... — filters by organizationId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/crm-activities?organizationId=${testOrganizationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test validation
    expect(
      res.body.data.every((a: any) => a.organizationId === testOrganizationId),
    ).toBe(true);
  });

  it('GET /api/crm-activities?type=task — filters tasks for admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/crm-activities?type=task')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test validation
    expect(res.body.data.some((a: any) => a.activityId === createdTaskId)).toBe(
      true,
    );
  });

  it('GET /api/crm-activities/:id — returns an activity by ID (viewer for public activity)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/crm-activities/${createdActivityId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activityId).toBe(createdActivityId);
    expect(res.body.subject).toBe('Initial intro discovery call');
  });

  it('PATCH /api/crm-activities/:id — updates an activity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/crm-activities/${createdActivityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Initial intro discovery call (Follow-up scheduled)',
        priority: 'high',
      });

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe(
      'Initial intro discovery call (Follow-up scheduled)',
    );
    expect(res.body.priority).toBe('high');
  });

  it('PATCH /api/crm-activities/:id/complete — marks task as completed (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/crm-activities/${createdTaskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.completedAt).toBeDefined();
    expect(res.body.completedAt).not.toBeNull();
  });

  it('PATCH /api/crm-activities/:id/reopen — reopens a completed task (admin)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/crm-activities/${createdTaskId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.completedAt).toBeNull();
  });

  it('DELETE /api/crm-activities/:id — deletes an activity (admin)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/crm-activities/${createdActivityId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/crm-activities/${createdActivityId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(getRes.status).toBe(404);
  });
});
