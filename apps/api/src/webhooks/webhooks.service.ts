import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { webhooks } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { OUTBOX_EVENT_TYPES } from '../common/event-types';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class WebhooksService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async list() {
    return this.db.select().from(webhooks);
  }

  async listEvents() {
    return Array.from(OUTBOX_EVENT_TYPES).sort();
  }

  async create(body: CreateWebhookDto, actorUsername: string) {
    const { targetUrl, eventTypes } = body;
    const secretKey = randomBytes(32).toString('hex');

    const [created] = await this.db.transaction(async (tx) => {
      const [newWebhook] = await tx
        .insert(webhooks)
        .values({
          targetUrl,
          eventTypes,
          secretKey,
          isActive: true,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.WEBHOOK,
        entityId: newWebhook.webhookId,
        eventType: EventType.CREATED,
        entityDisplayName: newWebhook.targetUrl,
        payload: { targetUrl: newWebhook.targetUrl },
        actor: actorUsername,
      });

      return [newWebhook];
    });

    return created;
  }

  async update(id: string, body: UpdateWebhookDto, actorUsername: string) {
    const { targetUrl, eventTypes, isActive } = body;

    const [updated] = await this.db.transaction(async (tx) => {
      const [updatedWebhook] = await tx
        .update(webhooks)
        .set({
          ...(targetUrl !== undefined && { targetUrl }),
          ...(eventTypes !== undefined && { eventTypes }),
          ...(isActive !== undefined && { isActive }),
        })
        .where(eq(webhooks.webhookId, id))
        .returning();

      if (updatedWebhook) {
        await emitEvent(tx, {
          entityType: EntityType.WEBHOOK,
          entityId: updatedWebhook.webhookId,
          eventType: EventType.UPDATED,
          entityDisplayName: updatedWebhook.targetUrl,
          payload: body,
          actor: actorUsername,
        });
      }

      return [updatedWebhook];
    });

    if (!updated) throw new NotFoundException('Webhook not found');
    return updated;
  }

  async remove(id: string, actorUsername: string) {
    const [deleted] = await this.db.transaction(async (tx) => {
      const [deletedWebhook] = await tx
        .delete(webhooks)
        .where(eq(webhooks.webhookId, id))
        .returning();

      if (deletedWebhook) {
        await emitEvent(tx, {
          entityType: EntityType.WEBHOOK,
          entityId: deletedWebhook.webhookId,
          eventType: EventType.DELETED,
          entityDisplayName: deletedWebhook.targetUrl,
          payload: {},
          actor: actorUsername,
        });
      }

      return [deletedWebhook];
    });

    if (!deleted) throw new NotFoundException('Webhook not found');
    return { success: true };
  }
}
