import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import * as bcrypt from 'bcrypt';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { users } from '../drizzle/herobm-core-schema';

// eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
const TEST_PASSWORD = 'test-admin-pw-xyz'; // TEST_CREDENTIAL
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

describe('AuthService', () => {
  const pg = setupPgliteSuite();
  let service: AuthService;

  beforeEach(async () => {
    // Clean table for isolation
    await pg.db.delete(users);

    // Seed a standard admin user
    await pg.db.insert(users).values({
      userId: '11111111-1111-1111-1111-111111111111',
      username: 'admin',
      passwordHash: TEST_HASH,
      role: 'admin',
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock.jwt.token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return a JWT token for valid credentials', async () => {
      const result = await service.login('admin', TEST_PASSWORD);
      expect(result).toHaveProperty('access_token', 'mock.jwt.token');
      expect(result).toHaveProperty('username', 'admin');
      expect(result).toHaveProperty('role', 'admin');
    });

    it('should throw UnauthorizedException for unknown user', async () => {
      await expect(service.login('nonexistent', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      await expect(service.login('admin', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      await pg.db.insert(users).values({
        userId: '22222222-2222-2222-2222-222222222222',
        username: 'disabled',
        passwordHash: TEST_HASH,
        role: 'viewer',
        isActive: false,
      });

      await expect(service.login('disabled', TEST_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
