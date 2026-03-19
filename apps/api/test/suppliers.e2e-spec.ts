import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { suppliers, supplierEvents } from '../src/drizzle/modbm-core-schema';
import { like } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Suppliers (e2e)', () => {
  let app: INestApplication;
  let db: any;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = moduleFixture.get(DRIZZLE);

    // Login as admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.DEV_ADMIN_PASSWORD || 'password',
      });
    adminToken = adminRes.body.access_token;

    // Cleanup E2E data
    await db.delete(suppliers).where(like(suppliers.vendorNumber, 'E2E-%'));
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
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const found = res.body.data.find((s: any) =>
      s.vendorNumber.startsWith('E2E-V-'),
    );
    expect(found).toBeDefined();
    expect(found.source).toBe('app');
  });

  it('PATCH /api/suppliers/:id -> should update the supplier', async () => {
    // 1. Create one
    const createRes = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
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
