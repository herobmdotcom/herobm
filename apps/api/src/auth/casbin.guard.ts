import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { newEnforcer, Enforcer } from 'casbin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve a Casbin asset file. Tries the compiled dist/ path first
 * (__dirname), then falls back to the source tree so local dev
 * survives a dist/ wipe from `nest start --watch`.
 */
function resolveCasbinAsset(filename: string): string {
  const distPath = path.join(__dirname, 'casbin', filename);
  if (fs.existsSync(distPath)) return distPath;
  // Fallback: walk up from dist/auth → project root → src/auth/casbin
  const srcPath = path.resolve(__dirname, '..', '..', 'src', 'auth', 'casbin', filename);
  if (fs.existsSync(srcPath)) return srcPath;
  // If neither exists, return the dist path so the original error surfaces
  return distPath;
}

// Decorators for controllers
import { SetMetadata } from '@nestjs/common';
export const CASBIN_RESOURCE = 'casbin_resource';
export const CASBIN_ACTION = 'casbin_action';
export const CasbinResource = (resource: string) =>
  SetMetadata(CASBIN_RESOURCE, resource);
export const CasbinAction = (action: string) =>
  SetMetadata(CASBIN_ACTION, action);

/**
 * Decorator to explicitly skip Casbin authorization for a handler or controller.
 * Use only for intentionally public endpoints (e.g. /auth/login).
 * The /metrics endpoint in main.ts is outside the NestJS pipeline and does not
 * need this decorator — it is documented as an architectural exception.
 */
export const SKIP_CASBIN = 'skip_casbin';
export const SkipCasbin = () => SetMetadata(SKIP_CASBIN, true);

@Injectable()
export class CasbinGuard implements CanActivate {
  private enforcer: Enforcer | null = null;

  constructor(private reflector: Reflector) {}

  private async getEnforcer(): Promise<Enforcer> {
    if (!this.enforcer) {
      const modelPath = resolveCasbinAsset('model.conf');
      const policyPath = resolveCasbinAsset('policy.csv');
      this.enforcer = await newEnforcer(modelPath, policyPath);
    }
    return this.enforcer;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for explicit @SkipCasbin() decorator
    const skipCasbin = this.reflector.getAllAndOverride<boolean>(SKIP_CASBIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCasbin) {
      return true;
    }

    const resource = this.reflector.getAllAndOverride<string>(CASBIN_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const action = this.reflector.getAllAndOverride<string>(CASBIN_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);

    // DENY by default if decorators are missing (ADV-026 fix)
    if (!resource || !action) {
      throw new ForbiddenException(
        'Endpoint is missing @CasbinResource/@CasbinAction decorators. ' +
          'Add them or use @SkipCasbin() for intentionally public endpoints.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('No authenticated user');
    }

    const enforcer = await this.getEnforcer();
    const allowed = await enforcer.enforce(user.role, resource, action);

    if (!allowed) {
      throw new ForbiddenException(
        `Role '${user.role}' cannot '${action}' on '${resource}'`,
      );
    }

    return true;
  }
}
