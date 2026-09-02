import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
/* eslint-disable no-restricted-syntax -- globally skipping throttler guard */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import { CasbinResource, CasbinAction, SkipCasbin } from '../auth/casbin.guard';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookResponseDto,
  DeleteWebhookResponseDto,
} from './dto';

import { WebhooksService } from './webhooks.service';

@ApiTags('System')
@ApiBearerAuth()
@Controller('webhooks')
@CasbinResource(SystemResource.WEBHOOKS)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Webhooks',
    description: 'Retrieves all registered outbound webhooks.',
  })
  @ApiOkResponse({ type: [WebhookResponseDto] })
  async list() {
    return this.webhooksService.list();
  }

  @Get('events')
  @SkipCasbin()
  @ApiOperation({
    summary: 'List Available Events',
    description:
      'Retrieves all possible event types that webhooks can subscribe to.',
  })
  @ApiOkResponse({ type: [String] })
  async listEvents() {
    return this.webhooksService.listEvents();
  }

  @Post()
  @ApiBody({ type: CreateWebhookDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Webhook',
    description: 'Registers a new webhook endpoint for system events.',
  })
  @ApiCreatedResponse({ type: WebhookResponseDto })
  async create(@Body() body: CreateWebhookDto, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'api';
    return this.webhooksService.create(body, actor);
  }

  @Put(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Webhook',
    description: 'Modifies an existing webhook configuration.',
  })
  @ApiOkResponse({ type: WebhookResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWebhookDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'api';
    return this.webhooksService.update(id, body, actor);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Webhook',
    description: 'Removes a webhook subscription.',
  })
  @ApiOkResponse({ type: DeleteWebhookResponseDto })
  async remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'api';
    return this.webhooksService.remove(id, actor);
  }
}
