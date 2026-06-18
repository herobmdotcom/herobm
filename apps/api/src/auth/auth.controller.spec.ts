import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

// Mock AuthService at the module level to prevent requireEnv() from firing
// during module load (it calls bcrypt.hashSync(requireEnv(...)) at top level).
jest.mock('./auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    login: jest.fn(),
  })),
}));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
  const mockToken = { access_token: 'jwt.token.here' }; // TEST_CREDENTIAL

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: jest.fn().mockResolvedValue(mockToken) },
        },
        {
          provide: 'CASBIN_ENFORCER',
          useValue: {
            getImplicitPermissionsForUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  describe('login', () => {
    it('should return a JWT token for valid credentials', async () => {
      const result = await controller.login({
        username: 'admin',
        // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
        password: 'password123', // TEST_CREDENTIAL
      });
      expect(result).toEqual(mockToken);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Jest assertion
      expect(service.login).toHaveBeenCalledWith('admin', 'password123');
    });

    it('should propagate UnauthorizedException from service', async () => {
      service.login.mockRejectedValueOnce(
        new UnauthorizedException('Invalid credentials'),
      );
      await expect(
        // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
        controller.login({ username: 'bad', password: 'wrong' }), // TEST_CREDENTIAL
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should pass username and password from DTO body', async () => {
      // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
      await controller.login({ username: 'viewer', password: 'REDACTED' }); // TEST_CREDENTIAL
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Jest assertion
      expect(service.login).toHaveBeenCalledWith('viewer', 'REDACTED');
    });
  });
});
