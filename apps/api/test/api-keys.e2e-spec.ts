import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../src/app.module';

describe('API Keys (e2e)', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer();

    // Login as admin to get JWT
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    jwtToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a valid API key that works for authentication (ADV-098)', async () => {
    // 1. Create API key via UI endpoint
    const createRes = await request(server)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'Test Key ADV-098',
        role: 'admin',
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('secretKey');
    const secretKey = createRes.body.secretKey;
    const apiKeyId = createRes.body.apiKeyId;

    // 2. Authenticate using the generated key to hit a protected endpoint
    await request(server)
      .get('/api/webhooks')
      .set('x-api-key', secretKey)
      .expect(200);

    // 3. Clean up
    await request(server)
      .delete(`/api/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
  });
});
