import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { apiKeys } from '../drizzle/herobm-core-schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    if (apiKeyHeader.length < 10) {
      throw new UnauthorizedException('Invalid API Key');
    }

    const prefix = apiKeyHeader.substring(0, 4);

    const keys = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.prefix, prefix));

    for (const key of keys) {
      if (!key.isActive) continue;

      const isMatch = await bcrypt.compare(apiKeyHeader, key.keyHash);
      if (isMatch) {
        // Mock a user object for Casbin
        request.user = {
          userId: key.apiKeyId,
          username: `api_key_${key.name.replace(/\s+/g, '_').toLowerCase()}`,
          sub: key.apiKeyId,
          roles: ['api_client'],
        };
        return true;
      }
    }

    throw new UnauthorizedException('Invalid API Key');
  }
}
