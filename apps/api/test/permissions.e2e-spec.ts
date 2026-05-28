import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestToken } from './utils/memory-db';

describe('Permissions & RBAC (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let salesToken: string;
  let testUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // In a real e2e environment, we would use provision-e2e-db.
    // For this demonstration, assume standard users are seeded.
    adminToken = await getTestToken(app, 'admin');
    viewerToken = await getTestToken(app, 'viewer');
    salesToken = await getTestToken(app, 'sales');
  });

  afterAll(async () => {
    await app.close();
  });

  it('Viewer should be able to read customers but not write', async () => {
    // Read -> 200
    await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    // Write -> 403
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Test Customer' })
      .expect(403);
  });

  it('Admin should be able to write customers', async () => {
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Customer Admin' })
      .expect(201);
  });

  it('Dynamic Permission: Grant write access to a new resource', async () => {
    // Viewer tries to write to webhooks -> 403
    await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ targetUrl: 'http://test' })
      .expect(403);

    // Admin adds webhooks write to viewer
    await request(app.getHttpServer())
      .post('/api/roles/viewer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        permissions: [
          { resource: 'webhooks', action: 'write' },
          { resource: 'customers', action: 'read' }, // Keep existing for simplicity or use a separate test role
        ],
      })
      .expect(201);

    // Viewer tries again -> 201 (or 400 if validation fails, but not 403)
    const res = await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        targetUrl: 'http://test',
        eventTypes: [],
        secretKey: 'secret' as string,
      }); // TEST_CREDENTIAL

    expect(res.status).not.toBe(403);
  });

  it('Remove a permission: Revoke webhooks write from viewer', async () => {
    // Admin removes webhooks write from viewer
    await request(app.getHttpServer())
      .post('/api/roles/viewer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        permissions: [
          { resource: 'customers', action: 'read' }, // Only keep customers read
        ],
      })
      .expect(201);

    // Viewer tries to write to webhooks -> 403
    await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        targetUrl: 'http://test',
        eventTypes: [],
        secretKey: 'secret' as string,
      }) // TEST_CREDENTIAL
      .expect(403);
  });

  it('Should fetch all roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const viewerRole = res.body.find((r: any) => r.role === 'viewer');
    expect(viewerRole).toBeDefined();
    expect(Array.isArray(viewerRole.permissions)).toBe(true);
  });

  it('Should get permissions for a single role', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/roles/viewer')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.role).toBe('viewer');
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('Should create and delete a new custom role', async () => {
    const roleName = 'test-custom-role';

    // Create new role by setting permissions
    await request(app.getHttpServer())
      .post(`/api/roles/${roleName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        permissions: [{ resource: 'customers', action: 'read' }],
      })
      .expect(201);

    // Verify it exists
    const getRes = await request(app.getHttpServer())
      .get(`/api/roles/${roleName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getRes.body.role).toBe(roleName);
    expect(getRes.body.permissions.length).toBe(1);

    // Delete role
    await request(app.getHttpServer())
      .delete(`/api/roles/${roleName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify it's deleted (fetch permissions returns empty)
    const afterDelete = await request(app.getHttpServer())
      .get(`/api/roles/${roleName}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(afterDelete.body.permissions.length).toBe(0);
  });

  it('Should prevent deletion of system roles', async () => {
    await request(app.getHttpServer())
      .delete('/api/roles/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete('/api/roles/viewer')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  // Note: Changing a user's role and deactivating a user require actual user creation
  // and login flows in the e2e tests, which depend on the exact users endpoint setup.
});
