import { SystemResource } from '@herobm/shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth-user.decorator';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import {
  ApiKeyCreatedResponseDto,
  ApiKeyFullResponseDto,
  ApiKeyResponseDto,
  CreateApiKeyDto,
} from './dto';

import { ApiKeysService } from './api-keys.service';

@ApiTags('System')
@ApiBearerAuth()
@Controller('api-keys')
@CasbinResource(SystemResource.API_KEYS)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @CasbinAction('read')
  @ApiOkResponse({ type: [ApiKeyResponseDto] })
  @ApiOperation({
    summary: 'List API Keys',
    description: 'Retrieves all service API keys (without raw secrets).',
  })
  async list() {
    return this.apiKeysService.list();
  }

  @Post()
  @ApiBody({ type: CreateApiKeyDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create API Key',
    description: 'Generates a new API key. Secret is only returned once.',
  })
  @ApiCreatedResponse({ type: ApiKeyCreatedResponseDto })
  async create(@Body() body: CreateApiKeyDto, @AuthUser() user: JwtUser) {
    // Provide a fallback for API tokens creating other API tokens (though uncommon)
    const actor = user?.username || 'api';
    return this.apiKeysService.create(body, actor);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Revoke API Key',
    description: 'Permanently deletes and revokes an API key.',
  })
  @ApiOkResponse({ type: ApiKeyFullResponseDto })
  async revoke(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'api';
    return this.apiKeysService.revoke(id, actor);
  }
}
