import { Job, Queue } from 'bullmq';
import { ERPNextClient, JournalEntry } from '@modbm/erpnext-client';
import { outbox } from './schema';
import { eq, isNull } from 'drizzle-orm';

/**
 * Polls the outbox table for unprocessed events and enqueues them for ERPNext sync.
 */
export async function pollOutbox(db: any, syncQueue: Queue) {
  try {
    const pendingEvents = await db
      .select({ id: outbox.outboxId, payload: outbox.payload, type: outbox.eventType })
      .from(outbox)
      .where(isNull(outbox.processedAt))
      .limit(50);

    for (const event of pendingEvents) {
      // Add to BullMQ with ID dedup
      await syncQueue.add(
        'process-event',
        { eventId: event.id, type: event.type, payload: event.payload },
        { jobId: event.id, removeOnComplete: true }
      );
      
      // Mark as processed immediately (if BullMQ fails, the job remains in Redis queue)
      await db
        .update(outbox)
        .set({ processedAt: new Date() })
        .where(eq(outbox.outboxId, event.id));
    }
  } catch (err) {
    console.error('Error polling outbox:', err);
  }
}

/**
 * Maps outbox events to ERPNext Journal Entries and posts them.
 */
export async function processEvent(job: Job, erpClient: Pick<ERPNextClient, 'createJournalEntry'>) {
  const { eventId, type, payload } = job.data;
  console.log(`Processing event ${eventId} of type ${type}`);

  if (type === 'goods_received') {
    const receivedValue = parseFloat(payload.inventoryValueAdded || '0');
    const variance = parseFloat(payload.purchasePriceVariance || '0');
    
    if (receivedValue === 0 && variance === 0) return; // Nothing to post
    
    const accounts = [];
    
    if (receivedValue !== 0) {
       // Debit Inventory (Asset)
       accounts.push({
         account: 'Inventory',
         debit_in_account_currency: receivedValue,
         credit_in_account_currency: 0
       });
       // Credit GRNI (Liability)
       accounts.push({
         account: 'Goods Received Not Invoiced',
         debit_in_account_currency: 0,
         credit_in_account_currency: receivedValue
       });
    }

    if (variance !== 0) {
       // If positive variance: Actual cost > Standard cost. Debit variance, Credit GRNI
       const absVar = Math.abs(variance);
       accounts.push({
         account: 'Cost of Goods Sold', // Standard Cost variance hits COGS
         debit_in_account_currency: variance > 0 ? absVar : 0,
         credit_in_account_currency: variance > 0 ? 0 : absVar
       });
       accounts.push({
         account: 'Goods Received Not Invoiced',
         debit_in_account_currency: variance > 0 ? 0 : absVar,
         credit_in_account_currency: variance > 0 ? absVar : 0
       });
    }

    const je: JournalEntry = {
      title: `Goods Receipt ${payload.receptionNumber}`,
      company: 'ModBM',
      posting_date: new Date().toISOString().slice(0, 10),
      user_remark: `Auto-generated for Goods Receipt ${payload.receptionNumber}`,
      accounts
    };

    await erpClient.createJournalEntry(je);
    console.log(`Created Journal Entry for Goods Receipt ${payload.receptionNumber}`);

  } else if (type === 'goods_dispatched') {
    let totalCogs = 0;
    if (payload.cogsDetails) {
        payload.cogsDetails.forEach((c: any) => { totalCogs += parseFloat(c.cogsAmount || '0'); });
    }

    if (totalCogs === 0) return;

    const je: JournalEntry = {
      title: `Goods Dispatched ${payload.shipmentNumber}`,
      company: 'ModBM',
      posting_date: new Date().toISOString().slice(0, 10),
      user_remark: `Auto-generated for Shipment ${payload.shipmentNumber}`,
      accounts: [
         { account: 'Cost of Goods Sold', debit_in_account_currency: totalCogs, credit_in_account_currency: 0 },
         { account: 'Inventory', debit_in_account_currency: 0, credit_in_account_currency: totalCogs }
      ]
    };

    await erpClient.createJournalEntry(je);
    console.log(`Created Journal Entry for Shipment ${payload.shipmentNumber}`);
  }
}
