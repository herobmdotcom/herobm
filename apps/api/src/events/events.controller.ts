import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Post, Body, Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { outbox } from '../drizzle/schema';

import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PublishEventDto } from './dto';
import * as crypto from 'crypto';

@ApiTags('System')
@ApiBearerAuth()
@Controller('events')
@CasbinResource(SystemResource.EVENTS) // Assigning 'events' resource for Casbin
export class EventsController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Post('publish')
  @ApiBody({ type: PublishEventDto })
  @CasbinAction('write')
  @ApiCreatedResponse({
    // BYPASS-TYPING-TEST
    description: 'The event was successfully published.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        outboxId: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: 'Publish Event',
    description:
      'Publishes an event to the backend message queue (outbox) to trigger workflows or webhooks.',
  })
  async publish(@Body() body: PublishEventDto) {
    const { type, payload } = body;

    const [inserted] = await this.db
      .insert(outbox)
      .values({
        entityType: 'external_event',
        entityId: crypto.randomUUID(),
        eventType: type,
        payload: payload,
      })
      .returning({ outboxId: outbox.outboxId });

    return { success: true, outboxId: inserted.outboxId };
  }
}
