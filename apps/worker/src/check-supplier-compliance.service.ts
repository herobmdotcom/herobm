import { Job } from 'bullmq';
import { eq, lt, and, inArray, sql } from 'drizzle-orm';
import { suppliers, supplierExpiries, systemEvents, outbox } from '@herobm/db-schema';
import { relayLogger as logger } from './logger';
import { randomUUID } from 'crypto';

/**
 * BullMQ processor for the system maintenance queue.
 * Checks for suppliers with expired compliance documentation and blocks them.
 */
export async function checkSupplierCompliance(job: Job, db: any) {
  try {
    logger.info('Starting supplier compliance check job.');

    // 1. Find all vendorIds that have an expired compliance document
    const expiredDocs = await db
      .select({ vendorId: supplierExpiries.vendorId })
      .from(supplierExpiries)
      .where(lt(supplierExpiries.expiryDate, sql`CURRENT_DATE`));

    if (expiredDocs.length === 0) {
      logger.info('No expired compliance documents found.');
      return { blockedCount: 0 };
    }

    const expiredVendorIds = Array.from(new Set(expiredDocs.map((doc: any) => doc.vendorId)));
    
    // 2. Find suppliers that need to be blocked
    const suppliersToBlock = await db
      .select({ vendorId: suppliers.vendorId })
      .from(suppliers)
      .where(
        and(
          inArray(suppliers.vendorId, expiredVendorIds as any[]),
          eq(suppliers.isPurchasingBlocked, false)
        )
      );

    if (suppliersToBlock.length === 0) {
      logger.info('No new suppliers need to be blocked.');
      return { blockedCount: 0 };
    }

    const vendorIdsToBlock = suppliersToBlock.map((s: any) => s.vendorId);
    logger.info(`Found ${vendorIdsToBlock.length} suppliers to block for compliance breach.`);

    // 3. Block them and emit events in a transaction
    await db.transaction(async (tx: any) => {
      await tx
        .update(suppliers)
        .set({
          isPurchasingBlocked: true,
          purchasingBlockReason: 'compliance_breach',
          blockNotes: 'System automatically blocked due to expired compliance documentation.',
        })
        .where(inArray(suppliers.vendorId, vendorIdsToBlock as any[]));

      for (const vendorId of vendorIdsToBlock) {
        // Emit SUPPLIER.STATUS_CHANGED and SUPPLIER.UPDATED
        
        const now = new Date();
        const actor = 'system-worker';
        const payload = {
          isPurchasingBlocked: true,
          purchasingBlockReason: 'compliance_breach',
        };

        const statusEventId = randomUUID();
        await tx.insert(systemEvents).values({
          eventId: statusEventId,
          entityType: 'supplier',
          entityId: vendorId,
          eventType: 'status_changed',
          payload,
          actor,
          createdOn: now,
        });

        await tx.insert(outbox).values({
          outboxId: statusEventId,
          entityType: 'supplier',
          entityId: vendorId,
          eventType: 'status_changed',
          payload,
          createdOn: now,
        });

        const updateEventId = randomUUID();
        await tx.insert(systemEvents).values({
          eventId: updateEventId,
          entityType: 'supplier',
          entityId: vendorId,
          eventType: 'updated',
          payload,
          actor,
          createdOn: now,
        });

        await tx.insert(outbox).values({
          outboxId: updateEventId,
          entityType: 'supplier',
          entityId: vendorId,
          eventType: 'updated',
          payload,
          createdOn: now,
        });
      }
    });

    logger.info(`Successfully blocked ${vendorIdsToBlock.length} suppliers.`);
    return { blockedCount: vendorIdsToBlock.length };
  } catch (error: any) {
    logger.error({ err: error.message }, 'Failed to run supplier compliance check');
    throw error;
  }
}
