import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { suppliers, masterDataEvents } from '@herobm/db-schema';
import { like, sql } from 'drizzle-orm';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';

describe('Suppliers (e2e)', () => {
  let app: INestApplication;
  let db: NodePgDatabase;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = moduleFixture.get(DRIZZLE);

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

    // Cleanup E2E data — events first (FK), then suppliers
    await db.execute(sql`
      DELETE FROM herobm_core.master_data_events
      WHERE entity_type = 'supplier' AND entity_id IN (
        SELECT vendor_id FROM herobm_core.suppliers 
        WHERE vendor_number LIKE 'E2E-V-%' 
           OR vendor_number LIKE 'E2E-PATCH-%' 
           OR vendor_number LIKE 'E2E-DETAIL-%'
      )
    `);
    try {
      await db.execute(sql`
        DELETE FROM herobm_core.suppliers 
        WHERE vendor_number LIKE 'E2E-V-%' 
           OR vendor_number LIKE 'E2E-PATCH-%' 
           OR vendor_number LIKE 'E2E-DETAIL-%'
      `);
    } catch (e) {
      // Quiet fail if external tests linked the suppliers
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/suppliers -> should create a new supplier', async () => {
    const vendorNumber = `E2E-V-${Date.now()}`;
    const dto = {
      vendorNumber,
      name: 'E2E Vendor',
      emailAddress1: 'e2e@example.com',
      address1Country: 'AU',
    };

    const res = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(dto)
      .expect(201);

    expect(res.body.vendorNumber).toBe(vendorNumber);
    expect(res.body.vendorId).toBeDefined();
  });

  it('GET /api/suppliers -> should list unified suppliers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/suppliers?q=E2E-V-')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const found = res.body.data.find((s: { vendorNumber: string }) =>
      s.vendorNumber.startsWith('E2E-V-'),
    );
    expect(found).toBeDefined();
  });

  it('PATCH /api/suppliers/:id -> should update the supplier', async () => {
    // 1. Create one
    const createRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address1Country: 'AU',
        vendorNumber: `E2E-PATCH-${Date.now()}`,
        name: 'Before Patch',
      });
    const id = createRes.body.vendorId;

    // 2. Update it
    const res = await request(app.getHttpServer())
      .patch(`/api/suppliers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'After Patch' })
      .expect(200);

    expect(res.body.name).toBe('After Patch');
  });

  it('GET /api/suppliers/:id -> should return detail with events', async () => {
    const vendorNumber = `E2E-DETAIL-${Date.now()}`;
    // 1. Create
    const createRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address1Country: 'AU',
        vendorNumber,
        name: 'Detail Test',
      });
    const id = createRes.body.vendorId;

    // 2. Update
    await request(app.getHttpServer())
      .patch(`/api/suppliers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Detail' });

    // 3. Get Detail
    const res = await request(app.getHttpServer())
      .get(`/api/suppliers/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.vendorNumber).toBe(vendorNumber);
    expect(res.body.events).toBeDefined();
    expect(res.body.events.length).toBeGreaterThanOrEqual(2); // created + updated
  });
});
