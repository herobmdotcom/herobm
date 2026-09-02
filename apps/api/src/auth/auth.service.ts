import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { users } from '@herobm/db-schema';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(JwtService) private jwtService: JwtService,
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async login(username: string, password: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !user.isActive) {
      this.logger.warn(
        `[AUDIT] Failed login attempt for username '${username}': User not found or inactive`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      this.logger.warn(
        `[AUDIT] Failed login attempt for username '${username}': Invalid password`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled for this user
    const has2Fa = await this.twoFactorService.isEnabled(user.userId);

    if (has2Fa) {
      this.logger.log(
        `[AUDIT] User '${user.username}' authenticated password; 2FA challenge issued`,
      );
      // Return a short-lived temp token for 2FA verification
      const tempPayload = {
        sub: user.userId,
        username: user.username,
        purpose: '2fa_login',
      };

      return {
        twoFactorRequired: true,
        tempToken: this.jwtService.sign(tempPayload, { expiresIn: '5m' }),
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      };
    }

    // Standard login (no 2FA)
    this.logger.log(
      `[AUDIT] User '${user.username}' successfully logged in (role: ${user.role})`,
    );

    const payload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  }

  /**
   * Complete 2FA login: verify the temp token and TOTP code,
   * then issue the full access token.
   */
  async verify2FaLogin(tempToken: string, code: string) {
    let payload: { sub: string; username: string; purpose?: string };
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (payload.purpose !== '2fa_login') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    // Verify TOTP / backup code
    const verifier = await this.twoFactorService.verifyCode(payload.sub);
    const isValid = await verifier.verify(code);
    if (!isValid) {
      this.logger.warn(
        `[AUDIT] Failed 2FA verification attempt for user '${payload.username}'`,
      );
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Fetch fresh user data for the final token
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.userId, payload.sub))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(
      `[AUDIT] User '${user.username}' successfully completed 2FA login (role: ${user.role})`,
    );

    const fullPayload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(fullPayload),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
