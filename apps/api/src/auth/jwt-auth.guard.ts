import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { SKIP_CASBIN } from './casbin.guard';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'api-key']) {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const skipCasbin = this.reflector.getAllAndOverride<boolean>(SKIP_CASBIN, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCasbin) {
      return true;
    }

    return super.canActivate(context);
  }
}
