import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Mock fs to avoid reading real files
jest.mock('fs');
jest.mock('crypto', () => ({
  timingSafeEqual: jest.fn().mockReturnValue(true),
}));

const mockSuperCanActivate = jest.fn().mockResolvedValue(true);
jest.mock('@nestjs/passport', () => {
  return {
    AuthGuard: jest.fn(() => {
      return class {
        canActivate(context: any) {
          return mockSuperCanActivate(context);
        }
      };
    }),
  };
});

// Import SetupGuard AFTER mocking @nestjs/passport
import { SetupGuard } from './setup.guard';

describe('SetupGuard', () => {
  let guard: SetupGuard;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;
  let mockDb: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDb = {
      from: jest.fn().mockResolvedValue([{ value: 0 }]),
    };
    mockDb.select = jest.fn().mockReturnValue(mockDb);

    guard = new SetupGuard(mockDb);

    mockDb.from.mockResolvedValue([{ value: 0 }]); // Default is 0 users
    mockSuperCanActivate.mockResolvedValue(true);

    mockRequest = {
      headers: {},
      query: {},
      user: null,
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue({}),
      }),
    } as any;
  });

  afterAll(() => {
    jest.unmock('fs');
    jest.unmock('crypto');
    jest.unmock('@nestjs/passport');
  });

  describe('JWT Fallback', () => {
    it('should fallback to JWT AuthGuard if no token provided', async () => {
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(mockSuperCanActivate).toHaveBeenCalled();
    });
  });

  describe('Setup token file validation', () => {
    it('should fallback to JWT if no header or query token is provided', async () => {
      mockSuperCanActivate.mockResolvedValueOnce(true);
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should reject if users exist in the database', async () => {
      mockRequest.headers['x-setup-token'] = 'some-token';
      mockDb.from.mockResolvedValue([{ value: 2 }]); // 2 users exist

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        /Setup token is disabled/,
      );
    });

    it('should reject if .setup-token file does not exist', async () => {
      mockRequest.headers['x-setup-token'] = 'some-token';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        /No \.setup-token file found/,
      );
    });

    it('should reject if provided token does not match file token exactly', async () => {
      mockRequest.headers['x-setup-token'] = 'invalid-token';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('valid-token');
      // Override crypto mock just for this test
      (crypto as any).timingSafeEqual.mockReturnValueOnce(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        /Invalid setup token/,
      );
    });

    it('should allow if header token EXACTLY matches file token and no users exist', async () => {
      mockRequest.headers['x-setup-token'] = '<REDACTED>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<REDACTED>\n');
      (crypto as any).timingSafeEqual.mockReturnValueOnce(true);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      // It should have injected the synthetic session
      expect(mockRequest.user.role).toBe('system');
    });

    it('should allow if query parameter token matches file token', async () => {
      mockRequest.query.token = '<REDACTED>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<REDACTED>');
      (crypto as any).timingSafeEqual.mockReturnValueOnce(true);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
