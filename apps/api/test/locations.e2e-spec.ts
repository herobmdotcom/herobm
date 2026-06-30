import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

import request from 'supertest';

describe('Locations & Topography (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let baseUrl: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Use external API Gateway if provided, else use the internal Nest HTTP server
    baseUrl = process.env.TEST_API_URL || app.getHttpServer();

    // Login as admin
    const adminRes = await request(baseUrl)
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('Topography Lifecycle — Create, Update, Delete with guards', async () => {
    const locCode = `TEST-LOC-${Date.now()}`;

    // 1. Create Location
    const createLocRes = await request(baseUrl)
      .post('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: locCode,
        name: 'E2E Test Warehouse',
        city: 'Test City',
      });
    expect(createLocRes.status).toBe(201);
    const locationId = createLocRes.body.locationId;

    // 2. Create Zone
    const createZoneRes = await request(baseUrl)
      .post('/api/inventory/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationId,
        code: 'PICK',
        name: 'Picking Zone',
      });
    expect(createZoneRes.status).toBe(201);
    const zoneId = createZoneRes.body.zoneId;

    // 3. Create Bin
    const createBinRes = await request(baseUrl)
      .post('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        zoneId,
        binNumber: 'B-01-01',
        binType: 'pick',
      });
    expect(createBinRes.status).toBe(201);
    const binId = createBinRes.body.binId;

    // 4. Update Bin
    const updateBinRes = await request(baseUrl)
      .patch(`/api/inventory/bins/${binId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ binType: 'bulk', isBonded: true });
    expect(updateBinRes.status).toBe(200);
    expect(updateBinRes.body.binType).toBe('bulk');
    expect(updateBinRes.body.isBonded).toBe(true);

    // 6. Test Delete Guard: Cannot delete Location while Zones exist
    const failDeleteLocRes = await request(baseUrl)
      .delete(`/api/inventory/locations/${locationId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(failDeleteLocRes.status).toBe(400);
    expect(failDeleteLocRes.body.message).toContain('zones');

    // 7. Test Delete Guard: Cannot delete Zone while Bins exist
    const failDeleteZoneRes = await request(baseUrl)
      .delete(`/api/inventory/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(failDeleteZoneRes.status).toBe(400);
    expect(failDeleteZoneRes.body.message).toContain('bins');

    // 8. Delete Bin (Success)
    const deleteBinRes = await request(baseUrl)
      .delete(`/api/inventory/bins/${binId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteBinRes.status).toBe(200);

    // 9. Delete Zone (Success)
    const deleteZoneRes = await request(baseUrl)
      .delete(`/api/inventory/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteZoneRes.status).toBe(200);

    // 10. CLEANUP: The system auto-scaffolds a 'HANDLING' zone with 'SHIPPING'/'RECEIVING' bins via trigger.
    // We must find and remove them to cleanly delete the location per the guards.
    const inventoryRes = await request(baseUrl)
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);

    const myLoc = inventoryRes.body.find(
      (l: any) => l.locationId === locationId,
    );
    if (!myLoc) throw new Error('Location not found in full list');

    const handlingZone = myLoc.zones.find((z: any) => z.code === 'HANDLING');
    if (handlingZone) {
      // 10.1 Delete auto-bins
      for (const b of handlingZone.bins) {
        await request(baseUrl)
          .delete(`/api/inventory/bins/${b.binId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      }
      // 10.2 Delete handling zone
      const res = await request(baseUrl)
        .delete(`/api/inventory/zones/${handlingZone.zoneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    }

    // 11. Delete Location (Success)
    const deleteLocRes = await request(baseUrl)
      .delete(`/api/inventory/locations/${locationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteLocRes.status).toBe(200);
  });
});
