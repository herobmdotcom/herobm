import { Job, Queue } from 'bullmq';
import { outbox, webhooks } from './schema';
import { eq, isNull, inArray, and, or, lt, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { relayLogger, processingLogger } from './logger';

/** Event types that have active mappers in processEvent. */
const HANDLED_EVENT_TYPES = [
  'sales_invoiced',
  'purchase_invoiced',
] as const;

/**
 * Polls the outbox table for unprocessed events and enqueues them for external sync.
 */
export async function pollOutbox(db: any, syncQueue: Queue) {
  try {
    const now = new Date();
    const pendingEvents = await db
      .select({ 
        id: outbox.outboxId, 
        entityId: outbox.entityId,
        entityType: outbox.entityType,
        createdOn: outbox.createdOn,
        payload: outbox.payload, 
        type: outbox.eventType 
      })
      .from(outbox)
      .where(
        and(
          isNull(outbox.processedAt),
          isNull(outbox.lastError),
          or(isNull(outbox.lockedUntil), lt(outbox.lockedUntil, now))
        )
      )
      .limit(50);

    for (const event of pendingEvents) {
      // Add to BullMQ with ID dedup
      await syncQueue.add(
        'process-event',
        { 
          eventId: event.id, 
          type: event.type, 
          entityId: event.entityId,
          entityType: event.entityType,
          createdOn: event.createdOn,
          payload: event.payload 
        },
        { jobId: event.id, removeOnComplete: true }
      );
      
      const lockTime = new Date(now.getTime() + 5 * 60000); // +5 minutes
      await db
        .update(outbox)
        .set({ lockedUntil: lockTime })
        .where(eq(outbox.outboxId, event.id));
    }
  } catch (err) {
    relayLogger.error({ err }, 'Error polling outbox');
  }
}

/**
 * Maps outbox events to external payloads and posts them.
 */
export async function processEvent(job: Job, db: any) {
  const { eventId, type, entityId, entityType, createdOn, payload } = job.data;
  processingLogger.info({ eventId, eventType: type, entityId: entityId }, 'Processing event');

  // Removing early abort for HANDLED_EVENT_TYPES to allow webhooks to process everything
  // if (!HANDLED_EVENT_TYPES.includes(type)) { ... }

  try {
    let processedAny = false;

    // 1. Webhooks
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.isActive, true),
          sql`${webhooks.eventTypes} @> ${JSON.stringify([type])}::text::jsonb OR ${webhooks.eventTypes} @> '["*"]'::jsonb`
        )
      );

    if (activeWebhooks.length > 0) {
      processedAny = true;
      const payloadString = JSON.stringify({ 
        eventId, 
        eventType: type, 
        entityId: entityId,
        entityType: entityType,
        timestamp: createdOn,
        payload 
      });
      
      for (const wh of activeWebhooks) {
        try {
          const signature = crypto.createHmac('sha256', wh.secretKey).update(payloadString).digest('hex');
          
          const res = await fetch(wh.targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-modbm-signature': signature
            },
            body: payloadString
          });
          
          if (!res.ok) {
            processingLogger.warn({ webhookId: wh.webhookId, status: res.status }, 'Webhook returned non-200 status');
          }
        } catch (whErr: any) {
          // BEST EFFORT DELIVERY (FIRE-AND-FORGET):
          // We intentionally swallow webhook HTTP failures (like connection errors or timeouts) 
          // to prevent a single failing webhook from blocking the outbox queue or causing 
          // duplicate events to be sent to other successful webhooks upon retry.
          processingLogger.error({ webhookId: wh.webhookId, err: whErr.message }, 'Failed to dispatch webhook');
        }
      }
    }

    if (!processedAny) {
      processingLogger.warn({ eventId, eventType: type }, 'Unrecognized event type or no webhooks — skipping');
    }

    // Terminal Success
    await db.update(outbox)
      .set({ processedAt: new Date(), lockedUntil: null })
      .where(eq(outbox.outboxId, eventId));

  } catch (err: any) {
    // Explicit Failure Record
    await db.update(outbox)
      .set({ lastError: err.message || 'Unknown processing error', lockedUntil: null })
      .where(eq(outbox.outboxId, eventId));
    
    throw err;
  }
}
