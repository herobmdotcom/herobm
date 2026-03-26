import { Job, Queue } from 'bullmq';
import { ERPNextClient, JournalEntry } from '@modbm/erpnext-client';
import { outbox, accounts, suppliers } from './schema';
import { eq, isNull, inArray, and, or, lt } from 'drizzle-orm';
import { relayLogger, processingLogger } from './logger';

/** Event types that have active mappers in processEvent. */
const HANDLED_EVENT_TYPES = [
  'sales_invoiced',
  'purchase_invoiced',
] as const;

/**
 * Polls the outbox table for unprocessed events and enqueues them for ERPNext sync.
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
          or(isNull(outbox.lockedUntil), lt(outbox.lockedUntil, now)),
          inArray(outbox.eventType, [...HANDLED_EVENT_TYPES])
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
 * Maps outbox events to ERPNext Journal Entries and posts them.
 */
export async function processEvent(job: Job, erpClient: any, db: any) {
  const { eventId, type, payload } = job.data;
  processingLogger.info({ eventId, eventType: type }, 'Processing event');

  if (!HANDLED_EVENT_TYPES.includes(type)) {
    processingLogger.warn({ eventId, eventType: type }, 'Unrecognized event type — skipping');
    return;
  }

  try {
    if (type === 'sales_invoiced') {
      let erpId = payload.erpnextId;
    if (!erpId && payload.customerId) {
        try {
            processingLogger.info({ eventId, customerName: payload.customerName }, 'JIT Syncing Customer to ERPNext');
            const res = await (erpClient as any).createResource('Customer', {
                customer_name: payload.customerName,
                customer_type: 'Company',
                customer_group: 'Commercial',
                territory: 'All Territories'
            });
            erpId = res.name;
            await db.update(accounts)
              .set({ erpnextId: erpId })
              .where(eq(accounts.accountId, payload.customerId));
        } catch (err: any) {
            processingLogger.error({ eventId, customerName: payload.customerName, err: err.message }, 'Failed JIT Sync Customer');
            throw err;
        }
    }
  } else if (type === 'purchase_invoiced') {
    let erpId = payload.erpnextId;
    if (!erpId && payload.supplierId) {
        try {
            processingLogger.info({ eventId, supplierName: payload.supplierName }, 'JIT Syncing Supplier to ERPNext');
            const res = await (erpClient as any).createResource('Supplier', {
                supplier_name: payload.supplierName,
                supplier_type: 'Distributor',
                supplier_group: 'Local'
            });
            erpId = res.name;
            await db.update(suppliers)
              .set({ erpnextId: erpId })
              .where(eq(suppliers.vendorId, payload.supplierId));
        } catch (err: any) {
             processingLogger.error({ eventId, supplierName: payload.supplierName, err: err.message }, 'Failed JIT Sync Supplier');
             throw err;
        }
    }
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
