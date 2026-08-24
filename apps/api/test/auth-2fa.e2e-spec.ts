import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { generate } from 'otplib';
import request from 'supertest';

describe('Auth 2FA Lifecycle (e2e) — ADV-168', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Login as admin to manage users
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Test credentials).
        password:
          process.env.ADMIN_PASSWORD ||
          process.env.DEV_ADMIN_PASSWORD ||
          'test-admin-pw-xyz', // TEST_CREDENTIAL
      });
    if (adminRes.status !== 201) {
      throw new Error(
        `admin login failed: ${adminRes.status} ${JSON.stringify(adminRes.body)}`,
      );
    }
    adminToken = adminRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies 2FA setup rejection of invalid codes and strict login challenge', async () => {
    const testUsername = `test2fa_${Date.now()}`;
    const testPass = 'TestPass123!';

    // 1. Create a test user
    const createRes = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: testUsername,
        password: testPass,
        role: 'viewer',
        displayName: '2FA Test User',
      })
      .expect(201);

    const userId = createRes.body.userId;

    // 2. Initial login as test user (no 2FA yet)
    const initialLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: testUsername, password: testPass })
      .expect(201);

    expect(initialLogin.body.access_token).toBeDefined();
    expect(initialLogin.body.twoFactorRequired).toBeUndefined();
    const userToken = initialLogin.body.access_token;

    // 3. Initiate 2FA setup
    const setupRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/setup')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(setupRes.body.secret).toBeDefined();
    expect(setupRes.body.backupCodes).toHaveLength(8);
    const rawSecret = setupRes.body.secret;
    const backupCodes = setupRes.body.backupCodes;

    // 4. Attempt to enable with an invalid 6-digit code (ADV-168 fix check)
    const badEnable = await request(app.getHttpServer())
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        code: '000000',
        secret: rawSecret,
      })
      .expect(400);

    expect(badEnable.body.message).toContain('Invalid verification code');

    // 5. Enable with a valid TOTP code
    const validCode = generate({ secret: rawSecret });
    await request(app.getHttpServer())
      .post('/api/auth/2fa/enable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        code: validCode,
        secret: rawSecret,
      })
      .expect(201);

    // 6. Login as test user — should now require 2FA challenge
    const challengeRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: testUsername, password: testPass })
      .expect(201);

    expect(challengeRes.body.twoFactorRequired).toBe(true);
    expect(challengeRes.body.tempToken).toBeDefined();
    expect(challengeRes.body.access_token).toBeUndefined();
    const tempToken = challengeRes.body.tempToken;

    // 7. Protected route must reject tempToken with 401
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tempToken}`)
      .expect(401);

    // 8. Attempt 2FA verification with an invalid 6-digit code (ADV-168 fix check)
    await request(app.getHttpServer())
      .post('/api/auth/2fa/verify-login')
      .send({
        tempToken,
        code: '000000',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/2fa/verify-login')
      .send({
        tempToken,
        code: '123456',
      })
      .expect(401);

    // 9. Complete 2FA login with a valid backup code
    const validBackupCode = backupCodes[0];
    const backupVerifyRes = await request(app.getHttpServer())
      .post('/api/auth/2fa/verify-login')
      .send({
        tempToken,
        code: validBackupCode,
      })
      .expect(201);

    expect(backupVerifyRes.body.access_token).toBeDefined();
    const finalToken = backupVerifyRes.body.access_token;

    // 10. Access protected route with final access token
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${finalToken}`)
      .expect(200);

    expect(meRes.body.username).toBe(testUsername);

    // 11. Cleanup: delete test user
    await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
