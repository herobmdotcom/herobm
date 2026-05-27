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

@Controller('webhooks')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('webhooks')
export class WebhooksController {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  @Get()
  @CasbinAction('read')
  async list() {
    return this.db.select().from(webhooks);
  }

  @Post()
  @CasbinAction('write')
  async create(@Body() body: { targetUrl: string; eventTypes: string[] }) {
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
  async update(
    @Param('id') id: string,
    @Body()
    body: { targetUrl?: string; eventTypes?: string[]; isActive?: boolean },
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
  async remove(@Param('id') id: string) {
    const [deleted] = await this.db
      .delete(webhooks)
      .where(eq(webhooks.webhookId, id))
      .returning();
    if (!deleted) throw new NotFoundException('Webhook not found');
    return { success: true };
  }
}
