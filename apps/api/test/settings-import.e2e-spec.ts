import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { users } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';

describe('Settings Import (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    const db = app.get(DRIZZLE);
    const [adminUser] = await db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);

    const jwtService = app.get(JwtService);
    accessToken = jwtService.sign({
      sub: adminUser.userId,
      username: 'admin',
      roles: ['admin'],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /settings/cost-centers/import', () => {
    it('should bulk import cost centers and handle upsert', async () => {
      const importData = [
        { code: 'E2E_CC1', name: 'E2E Cost Center 1' },
        { code: 'E2E_CC2', name: 'E2E Cost Center 2' },
      ];

      // Initial import
      const res1 = await request(app.getHttpServer())
        .post('/settings/cost-centers/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importData)
        .expect(201);

      expect(res1.body.count).toBeGreaterThanOrEqual(2);

      // Upsert check: change name for CC1
      const updateData = [
        { code: 'E2E_CC1', name: 'E2E CC1 Updated' },
        { code: 'E2E_CC3', name: 'E2E Cost Center 3' },
      ];

      const res2 = await request(app.getHttpServer())
        .post('/settings/cost-centers/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(201);

      expect(res2.body.count).toBeGreaterThanOrEqual(2);

      // Verify names
      const listRes = await request(app.getHttpServer())
        .get('/settings/cost-centers')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const cc1 = listRes.body.find(
        (c: { code: string; name: string }) => c.code === 'E2E_CC1',
      );
      expect(cc1?.name).toBe('E2E CC1 Updated');

      const cc3 = listRes.body.find(
        (c: { code: string; name: string }) => c.code === 'E2E_CC3',
      );
      expect(cc3).toBeDefined();
    });
  });

  describe('POST /settings/activities/import', () => {
    it('should bulk import activities and handle upsert', async () => {
      const importData = [{ code: 'E2E_ACT1', name: 'E2E Activity 1' }];

      const res1 = await request(app.getHttpServer())
        .post('/settings/activities/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importData)
        .expect(201);

      expect(res1.body.count).toBeGreaterThanOrEqual(1);

      const res2 = await request(app.getHttpServer())
        .post('/settings/activities/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([{ code: 'e2e_act1', name: 'E2E ACT1 UPDATED' }]) // lowercase code to test case-insensitivity/trim
        .expect(201);

      expect(res2.body.count).toBeGreaterThanOrEqual(1);

      const listRes = await request(app.getHttpServer())
        .get('/settings/activities')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const act1 = listRes.body.find(
        (a: { code: string; name: string }) => a.code === 'E2E_ACT1',
      );
      expect(act1?.name).toBe('E2E ACT1 UPDATED');
    });
  });
});
