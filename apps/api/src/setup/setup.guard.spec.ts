import { SetupGuard } from './setup.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs to avoid reading real files
jest.mock('fs');

describe('SetupGuard', () => {
  let guard: SetupGuard;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    guard = new SetupGuard();
    jest.resetAllMocks();

    mockRequest = {
      headers: {},
      query: {},
      user: null,
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  describe('Admin JWT bypass', () => {
    it('should allow access if user has admin role', () => {
      mockRequest.user = { role: 'admin' };

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
      // fs.existsSync should not be called because checking the token is bypassed
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should NOT bypass if user has a different role', () => {
      mockRequest.user = { role: 'user' };
      // User role should fall through to token check, which fails because no token provided
      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Setup token file validation', () => {
    it('should reject if no header or query token is provided', () => {
      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should reject if .setup-token file does not exist', () => {
      mockRequest.headers['x-setup-token'] = 'some-token';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => guard.canActivate(mockContext)).toThrow(
        /No \.setup-token file found/,
      );
    });

    it('should reject if provided token does not match file token', () => {
      mockRequest.headers['x-setup-token'] = 'invalid-token';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('valid-token');

      expect(() => guard.canActivate(mockContext)).toThrow(
        /Invalid setup token/,
      );
    });

    it('should allow if header token EXACTLY matches file token', () => {
      mockRequest.headers['x-setup-token'] = '<REDACTED>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<REDACTED>\n'); // tests trailing whitespace handle

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should allow if query parameter token matches file token', () => {
      mockRequest.query.token = '<REDACTED>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('<REDACTED>');

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
