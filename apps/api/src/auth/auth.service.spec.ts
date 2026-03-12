// Set env vars BEFORE anything else — DEV_USERS are evaluated at module-load time
process.env.DEV_ADMIN_PASSWORD = 'test-admin-pw-xyz';
process.env.DEV_VIEWER_PASSWORD = 'test-viewer-pw-xyz';

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
    it('should return a JWT token for valid admin credentials', async () => {
      const result = await service.login('admin', 'test-admin-pw-xyz');
      expect(result).toHaveProperty('access_token', 'mock.jwt.token');
      expect(result).toHaveProperty('username', 'admin');
      expect(result).toHaveProperty('role', 'admin');
    });

    it('should return a JWT token for valid viewer credentials', async () => {
      const result = await service.login('viewer', 'test-viewer-pw-xyz');
      expect(result).toHaveProperty('access_token', 'mock.jwt.token');
      expect(result).toHaveProperty('role', 'viewer');
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
  });
});
