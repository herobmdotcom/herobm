import { outbox } from '@herobm/db-schema';
import { SystemResource } from '@herobm/shared';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';

import * as crypto from 'crypto';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { PublishEventDto, PublishEventResponseDto } from './dto';

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
    description: 'The event was successfully published.',
    type: PublishEventResponseDto,
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
