import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { FileLoggerService } from '../src/common/file-logger.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('System Logs E2E Verification', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (await createE2eModule()).compile();

    // Use the real FileLoggerService so NestJS startup writes to logs/api.log
    // (exactly as main.ts does in production)
    const fileLogger = new FileLoggerService();

    app = moduleFixture.createNestApplication({
      logger: fileLogger,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Obtain auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.DEV_ADMIN_PASSWORD })
      .expect(201);

    if (loginRes.status !== 201) {
      throw new Error(
        `${'loginRes'} login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }
    authToken = loginRes.body.access_token;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/admin/system-logs — should restrict access without token', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/system-logs')
      .expect(401);
  });

  it('GET /api/admin/system-logs — should return lines array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/system-logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('lines');
    expect(Array.isArray(res.body.lines)).toBe(true);

    // The FileLoggerService writes real logs during app.init(), so the file
    // should be populated with genuine NestJS startup output
    expect(res.body.lines.length).toBeGreaterThan(0);
  });

  it('GET /api/admin/system-logs?lines=5 — should respect line limits', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/system-logs?lines=5')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.lines.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/admin/system-logs?lines=10000 — should reject oversized limits', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/system-logs?lines=10000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400); // Bad Request
  });
});
