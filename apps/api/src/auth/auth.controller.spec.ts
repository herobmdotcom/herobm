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
  let service: any;

  const mockToken = { access_token: 'jwt.token.here' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: jest.fn().mockResolvedValue(mockToken) },
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
        password: 'password123',
      });
      expect(result).toEqual(mockToken);
      expect(service.login).toHaveBeenCalledWith('admin', 'password123');
    });

    it('should propagate UnauthorizedException from service', async () => {
      service.login.mockRejectedValueOnce(
        new UnauthorizedException('Invalid credentials'),
      );
      await expect(
        controller.login({ username: 'bad', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should pass username and password from DTO body', async () => {
      await controller.login({ username: 'viewer', password: 'REDACTED' });
      expect(service.login).toHaveBeenCalledWith('viewer', 'REDACTED');
    });
  });
});
