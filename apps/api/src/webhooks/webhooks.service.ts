import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { webhooks } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { OUTBOX_EVENT_TYPES } from '../common/event-types';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class WebhooksService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async list() {
    const records = await this.db.select().from(webhooks);
    return records.map((w) => ({
      ...w,
      secretKey: w.secretKey ? `${w.secretKey.substring(0, 10)}...` : null,
    }));
  }

  async listEvents() {
    return Array.from(OUTBOX_EVENT_TYPES).sort();
  }

  async create(body: CreateWebhookDto, actorUsername: string) {
    const { targetUrl, eventTypes } = body;
    const secretKey = `whsec_${randomBytes(32).toString('hex')}`;

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
      const existingRows = await tx
        .select()
        .from(webhooks)
        .where(eq(webhooks.webhookId, id))
        .limit(1);
      const existing = existingRows[0];
      if (!existing) return [];

      const audit = calculateAuditTrail(body, existing, AuditMode.DIFF);

      if (audit.hasChanges) {
        const [updatedWebhook] = await tx
          .update(webhooks)
          .set({ ...audit.changes } as typeof webhooks.$inferInsert)
          .where(eq(webhooks.webhookId, id))
          .returning();

        if (updatedWebhook) {
          await emitEvent(tx, {
            entityType: EntityType.WEBHOOK,
            entityId: updatedWebhook.webhookId,
            eventType: EventType.UPDATED,
            entityDisplayName: updatedWebhook.targetUrl,
            payload: {
              changes: audit.changes,
              previous: audit.previousValues,
            },
            actor: actorUsername,
          });
        }

        return [updatedWebhook];
      }
      return [existing];
    });

    if (!updated) throw new NotFoundException('Webhook not found');
    return {
      ...updated,
      secretKey: updated.secretKey
        ? `${updated.secretKey.substring(0, 10)}...`
        : null,
    };
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
