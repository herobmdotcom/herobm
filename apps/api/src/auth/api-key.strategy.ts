import { Request } from 'express';
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { apiKeys } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {
    super();
  }

  async validate(req: Request): Promise<unknown> {
    const apiKeyHeader = req.headers['x-api-key'];

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
        return {
          userId: key.apiKeyId,
          username: `api_key_${key.name.replace(/\s+/g, '_').toLowerCase()}`,
          sub: key.apiKeyId,
          role: key.role,
        };
      }
    }

    throw new UnauthorizedException('Invalid API Key');
  }
}
