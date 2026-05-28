import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';
import { CASBIN_ENFORCER } from './casbin.provider';

// Decorators for controllers
import { SetMetadata } from '@nestjs/common';
export const CASBIN_RESOURCE = 'casbin_resource';
export const CASBIN_ACTION = 'casbin_action';
export const CasbinResource = (resource: string) =>
  SetMetadata(CASBIN_RESOURCE, resource);
export const CasbinAction = (action: string) =>
  SetMetadata(CASBIN_ACTION, action);

export const SKIP_CASBIN = 'skip_casbin';
export const SkipCasbin = () => SetMetadata(SKIP_CASBIN, true);

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CASBIN_ENFORCER) private enforcer: Enforcer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const allowed = await this.enforcer.enforce(user.role, resource, action);

    if (!allowed) {
      throw new ForbiddenException(
        `Role '${user.role}' cannot '${action}' on '${resource}'`,
      );
    }

    return true;
  }
}
