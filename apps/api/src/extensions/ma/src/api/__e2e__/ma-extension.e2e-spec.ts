import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from '@test/utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('M&A Extension (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdActorId: string;
  let createdProjectId: string;

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

    // Create a base Actor for M&A testing
    const actorRes = await request(app.getHttpServer())
      .post('/api/actors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'M&A Target Actor',
        actorType: 'customer',
      });
    createdActorId = actorRes.body.actorId;

    // Create a base Project for M&A testing
    const projectRes = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'M&A Deal Apollo',
        status: 'prospect',
        type: 'implementation',
      });
    createdProjectId = projectRes.body.projectId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Seller Qualifications', () => {
    let qualId: string;

    it('POST /api/actors/:id/seller-qualifications — creates a snapshot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/actors/${createdActorId}/seller-qualifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          snapshotName: 'Initial Assessment',
          asOfDate: new Date().toISOString(),
          marketContext: 'Favorable',
          interestedBuyersExist: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.qualificationId).toBeDefined();
      qualId = res.body.qualificationId;
    });

    it('GET /api/actors/:id/seller-qualifications — retrieves snapshots', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/actors/${createdActorId}/seller-qualifications`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].marketContext).toBe('Favorable');
    });

    it('PATCH /api/actors/:id/seller-qualifications/:qualId — updates snapshot', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/actors/${createdActorId}/seller-qualifications/${qualId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          marketContext: 'Very Favorable',
        });

      expect(res.status).toBe(200);
      expect(res.body.marketContext).toBe('Very Favorable');
    });
  });

  describe('Buyer Qualifications', () => {
    let qualId: string;

    it('POST /api/actors/:id/buyer-qualifications — creates a snapshot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/actors/${createdActorId}/buyer-qualifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          snapshotName: 'Buyer Screening',
          buyerActivity: 'Active',
          geography: 'Europe',
        });

      expect(res.status).toBe(201);
      expect(res.body.qualificationId).toBeDefined();
      qualId = res.body.qualificationId;
    });

    it('GET /api/actors/:id/buyer-qualifications — retrieves snapshots', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/actors/${createdActorId}/buyer-qualifications`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].buyerActivity).toBe('Active');
    });

    it('PATCH /api/actors/:id/buyer-qualifications/:qualId — updates snapshot', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/actors/${createdActorId}/buyer-qualifications/${qualId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          buyerActivity: 'Passive',
        });

      expect(res.status).toBe(200);
      expect(res.body.buyerActivity).toBe('Passive');
    });
  });

  describe('Strategic Intelligence', () => {
    let intelId: string;

    it('POST /api/actors/:id/strategic-intelligence — creates a snapshot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/actors/${createdActorId}/strategic-intelligence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          snapshotName: 'Intelligence Q3',
          timeline: 'Q3',
          managerIntent: 'Retiring',
        });

      expect(res.status).toBe(201);
      expect(res.body.intelligenceId).toBeDefined();
      intelId = res.body.intelligenceId;
    });

    it('GET /api/actors/:id/strategic-intelligence — retrieves snapshots', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/actors/${createdActorId}/strategic-intelligence`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].managerIntent).toBe('Retiring');
    });

    it('PATCH /api/actors/:id/strategic-intelligence/:intelId — updates snapshot', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/actors/${createdActorId}/strategic-intelligence/${intelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          timeline: 'Q4',
        });

      expect(res.status).toBe(200);
      expect(res.body.timeline).toBe('Q4');
    });
  });

  describe('Project Feedback', () => {
    let feedbackId: string;

    it('POST /api/projects/:id/feedback — creates a snapshot', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${createdProjectId}/feedback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          snapshotName: 'Initial Feedback',
          actorId: createdActorId,
          dealProposalReason: 'Good fit',
        });

      if (res.status !== 201) {
        console.error('DEBUG 500 ERROR:', res.body);
      }

      expect(res.status).toBe(201);
      expect(res.body.feedbackId).toBeDefined();
      feedbackId = res.body.feedbackId;
    });

    it('GET /api/projects/:id/feedback — retrieves snapshots', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/projects/${createdProjectId}/feedback`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].dealProposalReason).toBe('Good fit');
    });

    it('PATCH /api/projects/:id/feedback/:feedbackId — updates snapshot', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${createdProjectId}/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dealProposalReason: 'Great fit',
        });

      expect(res.status).toBe(200);
      expect(res.body.dealProposalReason).toBe('Great fit');
    });
  });
});
