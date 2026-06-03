import { SystemResource } from '@modbm/shared';
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
  Put,
  Delete,
  Body,
  Param,
  Inject,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { webhooks } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateWebhookDto, UpdateWebhookDto, WebhookResponseDto } from './dto';
import { OUTBOX_EVENT_TYPES } from '../common/event-types';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.WEBHOOKS)
export class WebhooksController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Webhooks',
    description: 'Retrieves all registered outbound webhooks.',
  })
  @ApiOkResponse({ type: [WebhookResponseDto] })
  async list() {
    return this.db.select().from(webhooks);
  }

  @Get('events')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Available Events',
    description:
      'Retrieves all possible event types that webhooks can subscribe to.',
  })
  @ApiOkResponse({ type: [String] })
  async listEvents() {
    return Array.from(OUTBOX_EVENT_TYPES).sort();
  }

  @Post()
  @ApiBody({ type: CreateWebhookDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Webhook',
    description: 'Registers a new webhook endpoint for system events.',
  })
  @ApiCreatedResponse({ type: WebhookResponseDto })
  async create(@Body() body: CreateWebhookDto) {
    const { targetUrl, eventTypes } = body;
    const secretKey = randomBytes(32).toString('hex');

    const [created] = await this.db
      .insert(webhooks)
      .values({
        targetUrl,
        eventTypes,
        secretKey,
        isActive: true,
      })
      .returning();

    return created;
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
    @Body()
    body: UpdateWebhookDto,
  ) {
    const { targetUrl, eventTypes, isActive } = body;

    const [updated] = await this.db
      .update(webhooks)
      .set({
        ...(targetUrl !== undefined && { targetUrl }),
        ...(eventTypes !== undefined && { eventTypes }),
        ...(isActive !== undefined && { isActive }),
      })
      .where(eq(webhooks.webhookId, id))
      .returning();

    if (!updated) throw new NotFoundException('Webhook not found');
    return updated;
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Webhook',
    description: 'Removes a webhook subscription.',
  })
  @ApiOkResponse({
    // BYPASS-TYPING-TEST
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  async remove(@Param('id') id: string) {
    const [deleted] = await this.db
      .delete(webhooks)
      .where(eq(webhooks.webhookId, id))
      .returning();
    if (!deleted) throw new NotFoundException('Webhook not found');
    return { success: true };
  }
}
