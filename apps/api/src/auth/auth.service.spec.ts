import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import * as bcrypt from 'bcrypt';

// eslint-disable-next-line no-restricted-syntax
const TEST_PASSWORD = 'test-admin-pw-xyz'; // TEST_CREDENTIAL
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

/**
 * Mock Drizzle query builder chain:
 *   db.select().from(users).where(eq(...)).limit(1) → [row] | []
 */
function createMockDb(rows: any[]) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb([
      {
        userId: '11111111-1111-1111-1111-111111111111',
        username: 'admin',
        passwordHash: TEST_HASH,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: mockDb },
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
      // Return empty array — user not found
      mockDb = createMockDb([]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DRIZZLE, useValue: mockDb },
          {
            provide: JwtService,
            useValue: { sign: jest.fn() },
          },
        ],
      }).compile();
      const svc = module.get<AuthService>(AuthService);

      await expect(svc.login('nonexistent', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      await expect(service.login('admin', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockDb = createMockDb([
        {
          userId: '22222222-2222-2222-2222-222222222222',
          username: 'disabled',
          passwordHash: TEST_HASH,
          role: 'viewer',
          isActive: false,
          createdAt: new Date(),
        },
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: DRIZZLE, useValue: mockDb },
          {
            provide: JwtService,
            useValue: { sign: jest.fn() },
          },
        ],
      }).compile();
      const svc = module.get<AuthService>(AuthService);

      await expect(svc.login('disabled', TEST_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
