import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CasbinGuard,
  CASBIN_RESOURCE,
  CASBIN_ACTION,
  SKIP_CASBIN,
} from './casbin.guard';
import { Enforcer, newEnforcer } from 'casbin';
import * as path from 'path';
import * as fs from 'fs';

function resolveCasbinAsset(filename: string): string {
  const dirPath = path.join(__dirname, 'casbin', filename);
  if (fs.existsSync(dirPath)) return dirPath;

  const srcPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'auth',
    'casbin',
    filename,
  );
  if (fs.existsSync(srcPath)) return srcPath;

  const srcPath2 = path.join(process.cwd(), 'src', 'auth', 'casbin', filename);
  if (fs.existsSync(srcPath2)) return srcPath2;

  return dirPath;
}

/**
 * Helper to build a mock ExecutionContext with configurable metadata and request.
 */
function createMockContext(opts: {
  metadata?: Record<string, unknown>;
  user?: { userId: string; username: string; role: string } | null;
}): ExecutionContext & { __metadata: Record<string, unknown> } {
  const handler = jest.fn();
  const classRef = jest.fn();

  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ user: opts.user ?? undefined }),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    // Store metadata so Reflector mock can retrieve it
    __metadata: opts.metadata ?? {},
    __handler: handler,
    __classRef: classRef,
  } as unknown as ExecutionContext & {
    __metadata: Record<string, unknown>;
  };
}

describe('CasbinGuard', () => {
  let guard: CasbinGuard;
  let reflector: Reflector;
  let enforcer: Enforcer;

  beforeAll(async () => {
    const modelPath = resolveCasbinAsset('model.conf');
    const policyPath = resolveCasbinAsset('policy.csv');
    enforcer = await newEnforcer(modelPath, policyPath);
  });

  beforeEach(() => {
    reflector = new Reflector();
    guard = new CasbinGuard(reflector, enforcer);
  });

  describe('SkipCasbin decorator', () => {
    it('should allow access when @SkipCasbin() is set', async () => {
      const ctx = createMockContext({
        metadata: { [SKIP_CASBIN]: true },
        user: null,
      });

      // Mock reflector to return skip_casbin = true
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe('Missing decorators (deny-by-default)', () => {
    it('should throw ForbiddenException when @CasbinResource is missing', async () => {
      const ctx = createMockContext({
        metadata: { [CASBIN_ACTION]: 'read' },
        user: { userId: '1', username: 'admin', role: 'admin' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when @CasbinAction is missing', async () => {
      const ctx = createMockContext({
        metadata: { [CASBIN_RESOURCE]: 'products' },
        user: { userId: '1', username: 'admin', role: 'admin' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when both decorators are missing', async () => {
      const ctx = createMockContext({
        metadata: {},
        user: { userId: '1', username: 'admin', role: 'admin' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Unauthenticated request', () => {
    it('should throw UnauthorizedException when no user is present', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'products',
          [CASBIN_ACTION]: 'read',
        },
        user: null,
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Policy enforcement', () => {
    it('should allow viewer to read products', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'products',
          [CASBIN_ACTION]: 'read',
        },
        user: { userId: '2', username: 'viewer', role: 'viewer' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should deny viewer from writing users', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'users',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '2', username: 'viewer', role: 'viewer' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to write sales-orders', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'sales-orders',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '1', username: 'admin', role: 'admin' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow admin to read dashboard', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'dashboard',
          [CASBIN_ACTION]: 'read',
        },
        user: { userId: '1', username: 'admin', role: 'admin' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should deny viewer from writing sales-orders', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'sales-orders',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '2', username: 'viewer', role: 'viewer' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    // --- New role tests ---

    it('should allow sales role to write customers', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'customers',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '3', username: 'sales', role: 'sales' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should deny sales role from writing suppliers', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'suppliers',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '3', username: 'sales', role: 'sales' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow warehouse role to write sales-orders (pick/ship)', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'sales-orders',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '4', username: 'warehouse', role: 'warehouse' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow procurement role to write suppliers', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'suppliers',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '5', username: 'procurement', role: 'procurement' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should deny procurement role from writing customers', async () => {
      const ctx = createMockContext({
        metadata: {
          [CASBIN_RESOURCE]: 'customers',
          [CASBIN_ACTION]: 'write',
        },
        user: { userId: '5', username: 'procurement', role: 'procurement' },
      });

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          return ctx.__metadata[key];
        });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow all roles to read products (inherited from viewer)', async () => {
      for (const role of ['sales', 'warehouse', 'procurement']) {
        const ctx = createMockContext({
          metadata: {
            [CASBIN_RESOURCE]: 'products',
            [CASBIN_ACTION]: 'read',
          },
          user: { userId: '99', username: role, role },
        });

        jest
          .spyOn(reflector, 'getAllAndOverride')
          .mockImplementation((key: string) => {
            return ctx.__metadata[key];
          });

        const result = await guard.canActivate(ctx);
        expect(result).toBe(true);
      }
    });

    describe('Deny-Override logic', () => {
      it('should deny restricted_user from reading dashboard (explicit deny overrides inherited allow)', async () => {
        const ctx = createMockContext({
          metadata: {
            [CASBIN_RESOURCE]: 'dashboard',
            [CASBIN_ACTION]: 'read',
          },
          user: {
            userId: '100',
            username: 'restricted',
            role: 'restricted_user',
          },
        });

        jest
          .spyOn(reflector, 'getAllAndOverride')
          .mockImplementation((key: string) => {
            return ctx.__metadata[key];
          });

        await expect(guard.canActivate(ctx)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should allow restricted_user to read products (inherited allow with no explicit deny)', async () => {
        const ctx = createMockContext({
          metadata: {
            [CASBIN_RESOURCE]: 'products',
            [CASBIN_ACTION]: 'read',
          },
          user: {
            userId: '100',
            username: 'restricted',
            role: 'restricted_user',
          },
        });

        jest
          .spyOn(reflector, 'getAllAndOverride')
          .mockImplementation((key: string) => {
            return ctx.__metadata[key];
          });

        const result = await guard.canActivate(ctx);
        expect(result).toBe(true);
      });
    });
  });
});
