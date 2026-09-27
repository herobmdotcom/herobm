import { Decimal } from 'decimal.js';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesInvoices,
  glJournalEntries,
  glJournalLines,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { JournalLineDto } from '../gl/dto';
import { evaluateLifecycleRules } from '../orders/order-lifecycle-rules';
import { unbillProjectInvoiceHelper } from '../projects/projects-billing.service';
import {
  JOURNAL_ENTRY_SOURCE_TYPE,
  SALES_INVOICE_STATE,
  type SalesInvoiceState,
  SALES_INVOICE_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';

export const VALID_INVOICE_STATES = getValidStates(SALES_INVOICE_TRANSITIONS);

export async function changeSalesInvoiceStateHelper(
  db: DrizzleDB,
  glService: GlService,
  logger: Logger,
  invoiceId: string,
  newState: string,
  actor: string,
  tx?: DrizzleDB,
) {
  if (!VALID_INVOICE_STATES.includes(newState)) {
    throw new BadRequestException(`Invalid invoice state: '${newState}'`);
  }

  const execute = async (activeDb: DrizzleDB) => {
    const [existing] = await activeDb
      .select({
        stateCode: salesInvoices.stateCode,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .for('update')
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const allowed = SALES_INVOICE_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition invoice from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    // If transitioning to CANCELLED, we must reverse the associated GL entries synchronously
    if (newState === SALES_INVOICE_STATE.CANCELLED) {
      const [originalEntry] = await activeDb
        .select()
        .from(glJournalEntries)
        .where(
          and(
            eq(glJournalEntries.sourceType, 'sales_invoice'),
            eq(glJournalEntries.sourceId, invoiceId),
          ),
        )
        .limit(1);

      if (originalEntry) {
        const originalLines = await activeDb
          .select()
          .from(glJournalLines)
          .where(
            eq(glJournalLines.journalEntryId, originalEntry.journalEntryId),
          );

        const reversedLines: JournalLineDto[] = originalLines.map((line) => ({
          accountId: line.glAccountId,
          debit: new Decimal(line.credit).toNumber(),
          credit: new Decimal(line.debit).toNumber(),
          memo: `Cancellation Reversal: ${line.memo}`,
          costCenterId: line.costCenterId || undefined,
          activityId: line.activityId || undefined,
          partyType:
            line.partyType === 'customer' || line.partyType === 'supplier'
              ? line.partyType
              : undefined,
          partyId: line.partyId || undefined,
        }));

        await glService.postJournalEntry(
          reversedLines,
          {
            sourceId: invoiceId,
            sourceType: JOURNAL_ENTRY_SOURCE_TYPE.SALES_INVOICE_REVERSAL,
            memo: `Reversal of Sales Invoice ${existing.invoiceNumber}`,
            entryDate: new Date().toISOString().slice(0, 10),
            actor,
          },
          activeDb,
        );
      }
    }

    const [updated] = await activeDb
      .update(salesInvoices) // @herobm-skip-audit
      .set({
        stateCode: newState as SalesInvoiceState,
        modifiedOn: new Date(),
      })
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .returning();

    await emitEvent(activeDb as unknown as DrizzleDB, {
      entityType: EntityType.SALES_INVOICE,
      entityId: invoiceId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: existing.invoiceNumber,
      payload: {
        entity: 'sales_invoice',
        entityId: invoiceId,
        invoiceNumber: existing.invoiceNumber,
        from: existing.stateCode,
        to: newState,
      },
      actor,
    });

    if (newState === SALES_INVOICE_STATE.CANCELLED) {
      if (existing.salesOrderId) {
        try {
          await evaluateLifecycleRules(
            activeDb,
            existing.salesOrderId,
            {
              entity: 'sales_invoice',
              action: 'cancelled',
              id: invoiceId,
            },
            actor,
          );
        } catch (lifecycleErr) {
          logger.error(
            `Failed to evaluate lifecycle rules for SO ${existing.salesOrderId} after invoice cancellation:`,
            lifecycleErr,
          );
        }
      }

      try {
        await unbillProjectInvoiceHelper(activeDb, invoiceId, actor, logger);
      } catch (projectErr) {
        logger.error(
          `Failed to unbill project lines for invoice ${invoiceId} after cancellation:`,
          projectErr,
        );
      }
    }

    return updated;
  };

  if (tx) {
    return await execute(tx);
  } else {
    return await db.transaction(execute);
  }
}
