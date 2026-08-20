import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { users } from '@herobm/db-schema';
import { EnvService } from '../common/config/env.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly env: EnvService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  /**
   * Per-request validation: after JWT signature check, verify the user
   * still exists and is active in the database. Returns DB-fresh role
   * so role changes take effect immediately without re-login.
   *
   * Resolves ADV-079: disabled/demoted users are blocked immediately
   * instead of retaining access until JWT expiry.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.userId, payload.sub))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Customer disabled or not found');
    }

    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role, // DB-fresh role, not JWT-cached
    };
  }
}
