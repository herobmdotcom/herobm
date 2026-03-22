import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Shape of the authenticated user object attached to the request
 * after JWT validation by Passport. Matches the return shape of
 * JwtStrategy.validate() in jwt.strategy.ts.
 */
export interface JwtUser {
  userId: string;
  username: string;
  role: string;
}

/**
 * Parameter decorator that extracts the authenticated user from the
 * request object in a type-safe way.
 *
 * Usage:
 *   @Post()
 *   create(@AuthUser() user: JwtUser, @Body() dto: CreateDto) { ... }
 *
 * Replaces the anti-pattern: @Req() req: any → req.user.username
 */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
