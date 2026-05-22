import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { users } from '../drizzle/modbm-core-schema';
import { count } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Guard that protects setup endpoints with a dual-auth strategy:
 *
 * 1. **Setup Token (Initial Bootstrap)**: If no users exist in the DB, a valid `X-Setup-Token`
 *    will inject a synthetic 'system' session to bypass Passport and hit Casbin.
 *    (Fixes ADV-073 and ADV-074)
 * 2. **Admin JWT (Day 2 Ops)**: Once users are seeded, the token route is completely disabled.
 *    The guard falls back to `AuthGuard('jwt')` requiring a valid admin token.
 */
@Injectable()
export class SetupGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(SetupGuard.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {
    super();
  }

  /**
   * Read the setup token from the `.setup-token` file.
   * Returns null if the file doesn't exist or is unreadable.
   */
  private readTokenFromFile(): string | null {
    // Look up from apps/api → project root
    const projectRoot = path.resolve(process.cwd(), '..', '..');
    const tokenPath = path.join(projectRoot, '.setup-token');

    try {
      if (fs.existsSync(tokenPath)) {
        return fs.readFileSync(tokenPath, 'utf-8').trim();
      }
    } catch {
      this.logger.warn('Failed to read .setup-token file from project root');
    }

    // Also try CWD (monorepo root) directly
    const cwdTokenPath = path.join(process.cwd(), '.setup-token');
    try {
      if (cwdTokenPath !== tokenPath && fs.existsSync(cwdTokenPath)) {
        return fs.readFileSync(cwdTokenPath, 'utf-8').trim();
      }
    } catch {
      // Ignore
    }

    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const headerToken = request.headers['x-setup-token'] as string | undefined;
    const queryToken = request.query?.token as string | undefined;
    const providedToken = headerToken || queryToken;

    // Path 1: Setup token — Initial bootstrap only
    if (providedToken) {
      // 1. Enforce Zero-User constraint (ADV-073 extension)
      const usrCountResult = await this.db
        .select({ value: count() })
        .from(users);
      const userCount = usrCountResult[0].value;

      if (userCount > 0) {
        this.logger.warn(
          'Setup token attempted but users exist. Rejecting token fallback.',
        );
        throw new UnauthorizedException(
          'Setup token is disabled because admin customers exist. Please login via JWT.',
        );
      }

      // 2. Cryptographic Token Validation (Fixes ADV-074)
      const fileToken = this.readTokenFromFile();
      if (!fileToken) {
        throw new UnauthorizedException(
          'No .setup-token file found. Run script to generate one.',
        );
      }

      const providedBuf = Buffer.from(providedToken);
      const fileBuf = Buffer.from(fileToken);

      if (
        providedBuf.length !== fileBuf.length ||
        !crypto.timingSafeEqual(providedBuf, fileBuf)
      ) {
        throw new UnauthorizedException('Invalid setup token.');
      }

      // 3. Inject synthetic system session for Casbin evaluation
      request.user = { userId: 'bootstrap-system', role: 'system' };
      return true;
    }

    // Path 2: Day-2 Ops via JWT
    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return await result;
    }
    // Handle Observable resolution safely (from nestjs/passport)
    if (result && typeof result === 'object' && 'toPromise' in result) {
      // @ts-expect-error -- toPromise is deprecated but used in legacy node libraries
      return await result.toPromise();
    }
    return !!result;
  }
}
