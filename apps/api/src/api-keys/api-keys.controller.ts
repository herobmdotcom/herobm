import { SystemResource } from '@herobm/shared';
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
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
  ApiKeyFullResponseDto,
} from './dto';

import { ApiKeysService } from './api-keys.service';

@ApiTags('System')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
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
