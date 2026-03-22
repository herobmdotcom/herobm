import { Job, Queue } from 'bullmq';
import { ERPNextClient, JournalEntry } from '@modbm/erpnext-client';
import { outbox, accounts, suppliers, salesInvoices, purchaseInvoices } from './schema';
import { eq, isNull, inArray } from 'drizzle-orm';
import { relayLogger, processingLogger } from './logger';

/** Event types that have active mappers in processEvent. */
const HANDLED_EVENT_TYPES = [
  'goods_received',
  'goods_dispatched',
  'sales_invoiced',
  'purchase_invoiced',
] as const;

/**
 * Polls the outbox table for unprocessed events and enqueues them for ERPNext sync.
 */
export async function pollOutbox(db: any, syncQueue: Queue) {
  try {
    const pendingEvents = await db
      .select({ id: outbox.outboxId, payload: outbox.payload, type: outbox.eventType })
      .from(outbox)
      .where(isNull(outbox.processedAt))
      .where(inArray(outbox.eventType, [...HANDLED_EVENT_TYPES]))
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
    relayLogger.error({ err }, 'Error polling outbox');
  }
}

/**
 * Maps outbox events to ERPNext Journal Entries and posts them.
 */
export async function processEvent(job: Job, erpClient: Pick<ERPNextClient, 'createJournalEntry'>, db: any) {
  const { eventId, type, payload } = job.data;
  processingLogger.info({ eventId, eventType: type }, 'Processing event');

  if (!HANDLED_EVENT_TYPES.includes(type)) {
    processingLogger.warn({ eventId, eventType: type }, 'Unrecognized event type — skipping');
    return;
  }

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
    processingLogger.info({ eventId, eventType: type, receptionNumber: payload.receptionNumber }, 'Created Journal Entry for Goods Receipt');

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
    processingLogger.info({ eventId, eventType: type, shipmentNumber: payload.shipmentNumber, totalCogs }, 'Created Journal Entry for Shipment');

  } else if (type === 'sales_invoiced') {
    // 1. JIT Master Data Sync for Customer
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

    // 2. AR Journal Generation
    const je: JournalEntry = {
        title: `Sales Invoice ${payload.invoiceNumber}`,
        company: 'ModBM',
        posting_date: new Date().toISOString().slice(0, 10),
        user_remark: `Auto-generated for Sales Invoice ${payload.invoiceNumber}`,
        accounts: [
            { account: 'Debtors', party_type: 'Customer', party: erpId, debit_in_account_currency: payload.totalAccountsReceivable, credit_in_account_currency: 0 },
            { account: 'Sales', debit_in_account_currency: 0, credit_in_account_currency: payload.totalRevenue }
        ]
    };

    if (payload.totalTax > 0) {
        je.accounts.push({ account: 'Duties and Taxes', debit_in_account_currency: 0, credit_in_account_currency: payload.totalTax });
    }

    const journalRes = await erpClient.createJournalEntry(je);
    processingLogger.info({ eventId, eventType: type, invoiceNumber: payload.invoiceNumber, journalName: journalRes.name }, 'Created AR Journal Entry');

    // Update ModBM with traceability Link
    await db.update(salesInvoices)
      .set({ erpnextJournalId: journalRes.name })
      .where(eq(salesInvoices.invoiceId, payload.invoiceId));

  } else if (type === 'purchase_invoiced') {
    // 1. JIT Master Data Sync for Supplier
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

    // 2. AP Journal Generation
    const je: JournalEntry = {
        title: `Purchase Bill ${payload.internalBillNumber || payload.invoiceNumber}`,
        company: 'ModBM',
        posting_date: new Date().toISOString().slice(0, 10),
        user_remark: `Auto-generated for internal AP Bill ${payload.invoiceNumber} (Supplier Ref: ${payload.supplierInvoiceNumber || 'N/A'})`,
        accounts: [
            { account: 'Cost of Goods Sold', debit_in_account_currency: payload.totalExpense, credit_in_account_currency: 0 },
            { account: 'Creditors', party_type: 'Supplier', party: erpId, debit_in_account_currency: 0, credit_in_account_currency: payload.totalAccountsPayable }
        ]
    };

    if (payload.totalTax > 0) {
        je.accounts.push({ account: 'Duties and Taxes', debit_in_account_currency: payload.totalTax, credit_in_account_currency: 0 });
    }

    const journalRes = await erpClient.createJournalEntry(je);
    processingLogger.info({ eventId, eventType: type, invoiceNumber: payload.invoiceNumber, journalName: journalRes.name }, 'Created AP Journal Entry');

    // Update ModBM with AP traceability Link
    await db.update(purchaseInvoices)
      .set({ erpnextJournalId: journalRes.name })
      .where(eq(purchaseInvoices.invoiceId, payload.invoiceId));
  }
}
