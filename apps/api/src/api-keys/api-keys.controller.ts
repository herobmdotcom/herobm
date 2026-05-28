import {
  ApiTags,
  ApiBearerAuth,
  ApiProperty,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
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
import {
  CreateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
  ApiKeyFullResponseDto,
} from './dto';

@ApiTags('ApiKeys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('api_keys')
export class ApiKeysController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List API Keys',
    description: 'Retrieves all service API keys (without raw secrets).',
  })
  @ApiOkResponse({ type: [ApiKeyResponseDto] })
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
  @ApiBody({ type: CreateApiKeyDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create API Key',
    description: 'Generates a new API key. Secret is only returned once.',
  })
  @ApiCreatedResponse({ type: ApiKeyCreatedResponseDto })
  async create(@Body() body: CreateApiKeyDto) {
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
  @ApiOperation({
    summary: 'Revoke API Key',
    description: 'Permanently deletes and revokes an API key.',
  })
  @ApiOkResponse({ type: ApiKeyFullResponseDto })
  async revoke(@Param('id') id: string) {
    const [deleted] = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.apiKeyId, id))
      .returning();

    return deleted;
  }
}
