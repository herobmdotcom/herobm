import { Job, Queue } from 'bullmq';
import { MockExternalClient } from './mock-external.client';
import { outbox, accounts, suppliers, webhooks } from './schema';
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
      .select({ id: outbox.outboxId, payload: outbox.payload, type: outbox.eventType })
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
        { eventId: event.id, type: event.type, payload: event.payload },
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
export async function processEvent(job: Job, extClient: any, db: any) {
  const { eventId, type, payload } = job.data;
  processingLogger.info({ eventId, eventType: type }, 'Processing event');

  // Removing early abort for HANDLED_EVENT_TYPES to allow webhooks to process everything
  // if (!HANDLED_EVENT_TYPES.includes(type)) { ... }

  try {
    let processedAny = false;

    // 1. Hardcoded integrations
    if (type === 'sales_invoiced') {
       processedAny = true;
       let extId = payload.externalId;
       if (!extId && payload.customerId) {
           try {
               processingLogger.info({ eventId, customerName: payload.customerName }, 'JIT Syncing Customer to External System');
               const res = await (extClient as any).syncInvoice({
                   customer_name: payload.customerName,
                   customer_type: 'Company',
                   customer_group: 'Commercial',
                   territory: 'All Territories'
               });
               extId = res.externalId;
               await db.update(accounts)
                 .set({ externalId: extId })
                 .where(eq(accounts.accountId, payload.customerId));
           } catch (err: any) {
               processingLogger.error({ eventId, customerName: payload.customerName, err: err.message }, 'Failed JIT Sync Customer');
               throw err;
           }
       }
    } else if (type === 'purchase_invoiced') {
       processedAny = true;
       let extId = payload.externalId;
       if (!extId && payload.supplierId) {
           try {
               processingLogger.info({ eventId, supplierName: payload.supplierName }, 'JIT Syncing Supplier to External System');
               const res = await (extClient as any).syncInvoice({
                   supplier_name: payload.supplierName,
                   supplier_type: 'Distributor',
                   supplier_group: 'Local'
               });
               extId = res.externalId;
               await db.update(suppliers)
                 .set({ externalId: extId })
                 .where(eq(suppliers.vendorId, payload.supplierId));
           } catch (err: any) {
                processingLogger.error({ eventId, supplierName: payload.supplierName, err: err.message }, 'Failed JIT Sync Supplier');
                throw err;
           }
       }
    }

    // 2. Webhooks
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.isActive, true),
          sql`${webhooks.eventTypes} @> ${JSON.stringify([type])}::jsonb OR ${webhooks.eventTypes} @> '["*"]'::jsonb`
        )
      );

    if (activeWebhooks.length > 0) {
      processedAny = true;
      const payloadString = JSON.stringify({ eventId, type, payload });
      
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
