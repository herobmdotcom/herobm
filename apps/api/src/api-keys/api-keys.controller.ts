import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { apiKeys } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

@Controller('api-keys')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('api_keys')
export class ApiKeysController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  async list() {
    const keys = await this.db
      .select({
        apiKeyId: apiKeys.apiKeyId,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        createdOn: apiKeys.createdOn,
      })
      .from(apiKeys);
    return keys;
  }

  @Post()
  @CasbinAction('write')
  async create(@Body() body: { name: string }) {
    // Generate a secure random token
    const secret = randomBytes(32).toString('hex');
    const prefix = `sk_test_${secret.slice(0, 4)}`; // Or live prefix depending on environment

    const hash = createHash('sha256').update(secret).digest('hex');

    const [key] = await this.db
      .insert(apiKeys)
      .values({
        name: body.name,
        prefix: prefix,
        keyHash: hash,
        createdBy: 'api', // Temporarily hardcoded for API-created keys
      })
      .returning();

    return {
      ...key,
      // We ONLY return the raw secret upon creation!
      secretKey: secret,
    };
  }

  @Delete(':id')
  @CasbinAction('write')
  async revoke(@Param('id') id: string) {
    const [deleted] = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.apiKeyId, id))
      .returning();

    return deleted;
  }
}
