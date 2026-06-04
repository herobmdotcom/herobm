import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glReconciliations,
  glJournalLines,
  glAccounts,
  glJournalEntries,
  customers,
  suppliers,
} from '../drizzle/modbm-core-schema';
import { eq, and, sql, isNull, lte, asc, or, not } from 'drizzle-orm';
import { CreateReconciliationDto, CreateAdjustmentDto } from './dto';
import { RECONCILIATION_STATE } from '@modbm/shared';
import { GlService, JournalMeta } from './gl.service';

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}
  async getReconciliations() {
    try {
      return await this.db
        .select({
          reconciliationId: glReconciliations.reconciliationId,
          glAccountId: glReconciliations.glAccountId,
          accountName: glAccounts.name,
          statementDate: glReconciliations.statementDate,
          statementBalance: glReconciliations.statementBalance,
          status: glReconciliations.status,
          createdOn: glReconciliations.createdOn,
          postedOn: glReconciliations.postedOn,
        })
        .from(glReconciliations)
        .leftJoin(
          glAccounts,
          eq(glReconciliations.glAccountId, glAccounts.glAccountId),
        )
        .orderBy(asc(glReconciliations.createdOn));
    } catch (err) {
      console.error('getReconciliations error:', err);
      throw err;
    }
  }

  async getReconciliation(id: string) {
    const records = await this.db
      .select({
        reconciliationId: glReconciliations.reconciliationId,
        glAccountId: glReconciliations.glAccountId,
        accountName: glAccounts.name,
        statementDate: glReconciliations.statementDate,
        statementBalance: glReconciliations.statementBalance,
        status: glReconciliations.status,
      })
      .from(glReconciliations)
      .leftJoin(
        glAccounts,
        eq(glReconciliations.glAccountId, glAccounts.glAccountId),
      )
      .where(eq(glReconciliations.reconciliationId, id));

    if (!records.length) {
      throw new NotFoundException('Reconciliation not found');
    }

    const rec = records[0];

    // Calculate opening balance (sum of all POSTED lines for this account that are NOT this reconciliation)
    const openingRes = await this.db
      .select({
        total: sql<number>`SUM(${glJournalLines.debit} - ${glJournalLines.credit})`,
      })
      .from(glJournalLines)
      .where(
        and(
          eq(glJournalLines.glAccountId, rec.glAccountId),
          eq(glJournalLines.isReconciled, true),
          // we exclude the current reconciliation just in case it is already posted
          not(eq(glJournalLines.reconciliationId, id)),
        ),
      );

    const openingBalance = openingRes[0]?.total
      ? Number(openingRes[0].total)
      : 0;

    // Calculate cleared balance (sum of all lines linked to THIS reconciliation)
    const clearedRes = await this.db
      .select({
        total: sql<number>`SUM(${glJournalLines.debit} - ${glJournalLines.credit})`,
      })
      .from(glJournalLines)
      .where(eq(glJournalLines.reconciliationId, id));

    const clearedBalance = clearedRes[0]?.total
      ? Number(clearedRes[0].total)
      : 0;

    return {
      ...rec,
      statementBalance: Number(rec.statementBalance),
      openingBalance,
      clearedBalance,
      variance:
        Number(rec.statementBalance) - (openingBalance + clearedBalance),
    };
  }

  async createReconciliation(data: CreateReconciliationDto) {
    const result = await this.db
      .insert(glReconciliations)
      .values({
        glAccountId: data.glAccountId,
        statementDate: data.statementDate,
        statementBalance: String(data.statementBalance),
        status: RECONCILIATION_STATE.DRAFT,
        createdBy: data.createdBy,
      })
      .returning({ reconciliationId: glReconciliations.reconciliationId });
    return result[0];
  }

  async getLines(id: string) {
    const recs = await this.db
      .select()
      .from(glReconciliations)
      .where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    const rec = recs[0];

    // Return lines for this account where:
    // entryDate <= statementDate AND
    const lines = await this.db
      .select({
        journalLineId: glJournalLines.journalLineId,
        journalEntryId: glJournalLines.journalEntryId,
        entryDate: glJournalEntries.entryDate,
        entryNumber: glJournalEntries.entryNumber,
        memo: glJournalLines.memo,
        entryMemo: glJournalEntries.memo,
        debit: glJournalLines.debit,
        credit: glJournalLines.credit,
        isCleared: sql<boolean>`${glJournalLines.reconciliationId} IS NOT NULL`,
        matchGroupId: glJournalLines.matchGroupId,
        partyType: glJournalLines.partyType,
        partyId: glJournalLines.partyId,
        partyName: sql<string>`COALESCE(${customers.name}, ${suppliers.name})`,
        sourceId: glJournalEntries.sourceId,
        createdAt: glJournalEntries.createdOn,
      })
      .from(glJournalLines)
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .leftJoin(
        customers,
        eq(glJournalLines.partyId, sql<string>`${customers.customerId}::text`),
      )
      .leftJoin(
        suppliers,
        eq(glJournalLines.partyId, sql<string>`${suppliers.vendorId}::text`),
      )
      .where(
        and(
          eq(glJournalLines.glAccountId, rec.glAccountId),
          lte(
            sql`DATE(${glJournalEntries.entryDate})`,
            sql`DATE(${rec.statementDate})`,
          ),
          or(
            isNull(glJournalLines.reconciliationId),
            eq(glJournalLines.reconciliationId, id),
          ),
          eq(glJournalEntries.isReversed, false),
        ),
      )
      .orderBy(
        asc(glJournalEntries.entryDate),
        asc(glJournalEntries.createdOn),
      );

    const mappedLines = lines.map((line: any) => ({
      ...line,
      debit: Number(line.debit),
      credit: Number(line.credit),
      isCleared: Boolean(line.isCleared),
    }));

    // Post-query sort to guarantee split lines perfectly follow their parent line
    const parentLines: any[] = [];
    const splitLinesByParent = new Map<string, any[]>();

    for (const line of mappedLines) {
      if (
        line.sourceId &&
        mappedLines.some((l) => l.journalLineId === line.sourceId)
      ) {
        if (!splitLinesByParent.has(line.sourceId)) {
          splitLinesByParent.set(line.sourceId, []);
        }
        splitLinesByParent.get(line.sourceId)!.push(line);
      } else {
        parentLines.push(line);
      }
    }

    const finalSortedLines: any[] = [];
    for (const parent of parentLines) {
      finalSortedLines.push(parent);
      const children = splitLinesByParent.get(parent.journalLineId);
      if (children) {
        // Enforce exact order for the children of a split: Reversal, Split A, Split B
        children.sort((a, b) => {
          const aMemo = a.memo || '';
          const bMemo = b.memo || '';
          if (aMemo.startsWith('Reversal')) return -1;
          if (bMemo.startsWith('Reversal')) return 1;
          if (aMemo.startsWith('Split A')) return -1;
          if (bMemo.startsWith('Split A')) return 1;
          if (aMemo.startsWith('Split B')) return -1;
          if (bMemo.startsWith('Split B')) return 1;
          return 0;
        });
        finalSortedLines.push(...children);
      }
    }

    // Fallback: If any children were missed because their parent wasn't in parentLines
    // (e.g. parent is outside the date filter), just append them to the end so they aren't lost
    for (const line of mappedLines) {
      if (
        !finalSortedLines.some((l) => l.journalLineId === line.journalLineId)
      ) {
        finalSortedLines.push(line);
      }
    }

    return finalSortedLines;
  }

  async toggleLine(
    reconciliationId: string,
    journalLineId: string,
    isCleared: boolean,
    amount?: number,
  ) {
    const recs = await this.db
      .select()
      .from(glReconciliations)
      .where(eq(glReconciliations.reconciliationId, reconciliationId));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === RECONCILIATION_STATE.POSTED)
      throw new BadRequestException('Reconciliation is already posted');

    // Fetch the target journal line
    const lines = await this.db
      .select({
        lineId: glJournalLines.journalLineId,
        accountCode: glAccounts.accountCode,
        debit: glJournalLines.debit,
        credit: glJournalLines.credit,
        memo: glJournalLines.memo,
        partyType: glJournalLines.partyType,
        partyId: glJournalLines.partyId,
        costCenterId: glJournalLines.costCenterId,
        activityId: glJournalLines.activityId,
        entryDate: glJournalEntries.entryDate,
      })
      .from(glJournalLines)
      .innerJoin(
        glAccounts,
        eq(glJournalLines.glAccountId, glAccounts.glAccountId),
      )
      .innerJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(eq(glJournalLines.journalLineId, journalLineId));

    if (!lines.length) throw new NotFoundException('Journal line not found');
    const targetLine = lines[0];

    const lineTotal =
      Number(targetLine.debit || 0) + Number(targetLine.credit || 0);
    const isDebit = Number(targetLine.debit || 0) > 0;

    if (isCleared && amount !== undefined && amount < lineTotal) {
      // PERFORM SPLIT — GL entry + line linking are atomic
      const remainingAmount = lineTotal - amount;

      const baseMemo = targetLine.memo ? targetLine.memo : '';

      await this.db.transaction(async (tx) => {
        // 1. Generate Split Journal Entry
        const splitLines = [
          // Reversal Line
          {
            accountCode: targetLine.accountCode,
            debit: isDebit ? 0 : lineTotal,
            credit: isDebit ? lineTotal : 0,
            memo: `Reversal: ${baseMemo}`.trim(),
            partyType: targetLine.partyType as 'customer' | 'supplier' | null,
            partyId: targetLine.partyId,
            costCenterId: targetLine.costCenterId ?? undefined,
            activityId: targetLine.activityId ?? undefined,
          },
          // Cleared Portion (Split A)
          {
            accountCode: targetLine.accountCode,
            debit: isDebit ? amount : 0,
            credit: isDebit ? 0 : amount,
            memo: `Split A: ${baseMemo}`.trim(),
            partyType: targetLine.partyType as 'customer' | 'supplier' | null,
            partyId: targetLine.partyId,
            costCenterId: targetLine.costCenterId ?? undefined,
            activityId: targetLine.activityId ?? undefined,
          },
          // Remaining Portion (Split B)
          {
            accountCode: targetLine.accountCode,
            debit: isDebit ? remainingAmount : 0,
            credit: isDebit ? 0 : remainingAmount,
            memo: `Split B: ${baseMemo}`.trim(),
            partyType: targetLine.partyType as 'customer' | 'supplier' | null,
            partyId: targetLine.partyId,
            costCenterId: targetLine.costCenterId ?? undefined,
            activityId: targetLine.activityId ?? undefined,
          },
        ];

        const meta = {
          entryDate:
            targetLine.entryDate || new Date().toISOString().split('T')[0],
          memo: `Split of line ${journalLineId}`,
          sourceId: journalLineId,
          sourceType: 'adjustment' as const,
          actor: 'system',
        };
        const result = await this.glService.postJournalEntry(
          splitLines,
          meta,
          tx,
        );

        // 2. Fetch the newly created lines to link them appropriately
        const newLines = await tx
          .select()
          .from(glJournalLines)
          .where(eq(glJournalLines.journalEntryId, result.journalEntryId));

        const reversalLine = newLines.find((l) =>
          l.memo?.startsWith('Reversal:'),
        );
        const clearedLine = newLines.find((l) =>
          l.memo?.startsWith('Split A:'),
        );
        const remainingLine = newLines.find((l) =>
          l.memo?.startsWith('Split B:'),
        );

        // Link the original line and the reversal line to perfectly offset each other
        await tx
          .update(glJournalLines)
          .set({ reconciliationId })
          .where(eq(glJournalLines.journalLineId, journalLineId));

        if (reversalLine) {
          await tx
            .update(glJournalLines)
            .set({ reconciliationId })
            .where(
              eq(glJournalLines.journalLineId, reversalLine.journalLineId),
            );
        }

        // Link the cleared portion
        if (clearedLine) {
          await tx
            .update(glJournalLines)
            .set({ reconciliationId })
            .where(eq(glJournalLines.journalLineId, clearedLine.journalLineId));
        }

        // Ensure remaining portion is explicitly unlinked
        if (remainingLine) {
          await tx
            .update(glJournalLines)
            .set({ reconciliationId: null })
            .where(
              eq(glJournalLines.journalLineId, remainingLine.journalLineId),
            );
        }
      });
    } else {
      // Standard clearing / un-clearing
      await this.db
        .update(glJournalLines)
        .set({
          reconciliationId: isCleared ? reconciliationId : null,
        })
        .where(eq(glJournalLines.journalLineId, journalLineId));
    }

    return { success: true };
  }

  async postReconciliation(id: string) {
    const details = await this.getReconciliation(id);
    if (details.status === RECONCILIATION_STATE.POSTED) {
      throw new BadRequestException('Already posted');
    }

    if (Math.abs(details.variance) > 0.001) {
      throw new BadRequestException('Variance must be zero before posting');
    }

    // Mark all lines linked to this reconciliation as fully reconciled
    await this.db
      .update(glJournalLines)
      .set({ isReconciled: true })
      .where(eq(glJournalLines.reconciliationId, id));

    // Mark reconciliation as posted
    await this.db
      .update(glReconciliations)
      .set({ status: RECONCILIATION_STATE.POSTED, postedOn: new Date() })
      .where(eq(glReconciliations.reconciliationId, id));

    return { success: true };
  }

  async discardReconciliation(id: string) {
    const recs = await this.db
      .select()
      .from(glReconciliations)
      .where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === RECONCILIATION_STATE.POSTED)
      throw new BadRequestException('Cannot discard a posted reconciliation');

    await this.db.transaction(async (tx) => {
      // Unlink and un-clear any journal lines associated with this draft
      await tx
        .update(glJournalLines)
        .set({ reconciliationId: null, isReconciled: false })
        .where(eq(glJournalLines.reconciliationId, id));

      // Delete the draft reconciliation record
      await tx
        .delete(glReconciliations)
        .where(eq(glReconciliations.reconciliationId, id));
    });

    return { success: true };
  }

  async createAdjustment(id: string, dto: CreateAdjustmentDto, actor?: string) {
    const recs = await this.db
      .select()
      .from(glReconciliations)
      .where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === RECONCILIATION_STATE.POSTED)
      throw new BadRequestException('Reconciliation is already posted');

    const rec = recs[0];

    // Fetch the primary account code
    const primaryAccs = await this.db
      .select({ code: glAccounts.accountCode })
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, rec.glAccountId));
    if (!primaryAccs.length)
      throw new NotFoundException('Primary GL Account not found');
    const primaryAccountCode = primaryAccs[0].code;

    // Fetch the offset account code
    const offsetAccs = await this.db
      .select({ code: glAccounts.accountCode })
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, dto.offsetAccountId));
    if (!offsetAccs.length)
      throw new NotFoundException('Offset GL Account not found');
    const offsetAccountCode = offsetAccs[0].code;

    const primaryLine = {
      accountCode: primaryAccountCode,
      debit: dto.type === 'debit' ? dto.amount : 0,
      credit: dto.type === 'credit' ? dto.amount : 0,
      memo: dto.memo,
    };

    const offsetLine = {
      accountCode: offsetAccountCode,
      debit: dto.type === 'credit' ? dto.amount : 0, // opposite
      credit: dto.type === 'debit' ? dto.amount : 0,
      memo: dto.memo,
    };

    const meta: JournalMeta = {
      sourceType: 'manual',
      memo: dto.memo,
      entryDate: dto.date,
      actor: actor,
    };

    // GL entry + auto-clearing are atomic
    const result = await this.db.transaction(async (tx) => {
      const newJournalId = await this.glService.postJournalEntry(
        [primaryLine, offsetLine],
        meta,
        tx,
      );

      // After creating the journal entry, auto-clear the line for the primary account
      const newLines = await tx
        .select({ journalLineId: glJournalLines.journalLineId })
        .from(glJournalLines)
        .where(
          and(
            eq(glJournalLines.journalEntryId, newJournalId.journalEntryId),
            eq(glJournalLines.glAccountId, rec.glAccountId),
          ),
        )
        .limit(1);

      if (newLines.length) {
        // Simple clear — just set the reconciliationId directly
        await tx
          .update(glJournalLines)
          .set({ reconciliationId: id })
          .where(eq(glJournalLines.journalLineId, newLines[0].journalLineId));
      }

      return {
        journalEntryId: newJournalId.journalEntryId,
        journalLineId: newLines.length ? newLines[0].journalLineId : undefined,
      };
    });

    return {
      success: true,
      journalEntryId: result.journalEntryId,
      journalLineId: result.journalLineId,
    };
  }
}
