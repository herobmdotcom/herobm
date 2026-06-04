import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  bankStatementLines,
  glJournalLines,
  glJournalEntries,
  glAccounts,
  glMatchGroups,
  reconciliationRules,
} from '../drizzle/modbm-core-schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateBankStatementLineDto } from './dto/bank-statement.dto';
import { GlService } from './gl.service';

@Injectable()
export class BankStatementService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async getLines(glAccountId: string, isReconciled?: boolean) {
    let conditions = eq(bankStatementLines.glAccountId, glAccountId);
    if (isReconciled !== undefined) {
      conditions = and(
        conditions,
        eq(bankStatementLines.isReconciled, isReconciled),
      ) as any;
    }

    const lines = await this.db
      .select({
        lineId: bankStatementLines.lineId,
        date: bankStatementLines.date,
        description: bankStatementLines.description,
        amount: bankStatementLines.amount,
        reference: bankStatementLines.reference,
        isReconciled: bankStatementLines.isReconciled,
        matchGroupId: bankStatementLines.matchGroupId,
        matchedJournalLineId: bankStatementLines.matchedJournalLineId,
        matchedJournalLine: {
          debit: glJournalLines.debit,
          credit: glJournalLines.credit,
          memo: glJournalLines.memo,
          entryDate: glJournalEntries.entryDate,
          isReconciled: glJournalLines.isReconciled,
        },
      })
      .from(bankStatementLines)
      .leftJoin(
        glJournalLines,
        eq(
          bankStatementLines.matchedJournalLineId,
          glJournalLines.journalLineId,
        ),
      )
      .leftJoin(
        glJournalEntries,
        eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
      )
      .where(conditions)
      .orderBy(desc(bankStatementLines.date));

    return lines;
  }

  async confirmMatch(
    lineId: string,
    _actor: string,
    reconciliationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const bsLine = await tx
        .select()
        .from(bankStatementLines)
        .where(eq(bankStatementLines.lineId, lineId));
      if (!bsLine.length)
        throw new NotFoundException('Bank statement line not found');

      const line = bsLine[0];
      if (line.isReconciled)
        throw new BadRequestException('Line is already reconciled');
      if (!line.matchedJournalLineId)
        throw new BadRequestException('No matched journal line to confirm');

      const jl = await tx
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalLineId, line.matchedJournalLineId));
      if (!jl.length)
        throw new NotFoundException('Matched journal line not found');

      // Update journal line to cleared (isReconciled or linked to draft)
      if (reconciliationId) {
        await tx
          .update(glJournalLines)
          .set({ reconciliationId })
          .where(eq(glJournalLines.journalLineId, line.matchedJournalLineId));
      } else {
        await tx
          .update(glJournalLines)
          .set({ isReconciled: true })
          .where(eq(glJournalLines.journalLineId, line.matchedJournalLineId));
      }

      // Update bank statement line to reconciled
      await tx
        .update(bankStatementLines)
        .set({ isReconciled: true })
        .where(eq(bankStatementLines.lineId, lineId));

      return { success: true };
    });
  }

  async manualMatch(
    lineId: string,
    journalLineId: string,
    _actor: string,
    reconciliationId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const bsLine = await tx
        .select()
        .from(bankStatementLines)
        .where(eq(bankStatementLines.lineId, lineId));
      if (!bsLine.length)
        throw new NotFoundException('Bank statement line not found');

      if (bsLine[0].isReconciled)
        throw new BadRequestException('Line is already reconciled');

      const jl = await tx
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.journalLineId, journalLineId));
      if (!jl.length) throw new NotFoundException('Journal line not found');

      // Update journal line
      if (reconciliationId) {
        await tx
          .update(glJournalLines)
          .set({ reconciliationId })
          .where(eq(glJournalLines.journalLineId, journalLineId));
      } else {
        await tx
          .update(glJournalLines)
          .set({ isReconciled: true })
          .where(eq(glJournalLines.journalLineId, journalLineId));
      }

      // Link and reconcile bank statement line
      await tx
        .update(bankStatementLines)
        .set({ matchedJournalLineId: journalLineId, isReconciled: true })
        .where(eq(bankStatementLines.lineId, lineId));

      return { success: true };
    });
  }

  async createLinesBulk(dtos: CreateBankStatementLineDto[], _actor: string) {
    if (!dtos.length) return { success: true };

    await this.db.insert(bankStatementLines).values(
      dtos.map((d) => ({
        glAccountId: d.glAccountId,
        date: d.date,
        description: d.description,
        amount: String(d.amount),
        reference: d.reference,
        isReconciled: false,
      })),
    );

    return { success: true };
  }

  async matchBulk(
    bankLineIds: string[],
    journalLineIds: string[],
    reconciliationId: string,
    _actor: string,
  ) {
    if (!bankLineIds.length || !journalLineIds.length) {
      throw new BadRequestException(
        'Must provide both bank lines and journal lines',
      );
    }

    return this.db.transaction(async (tx) => {
      // 1. Verify bank lines
      const bLines = await tx
        .select()
        .from(bankStatementLines)
        .where(inArray(bankStatementLines.lineId, bankLineIds));

      if (bLines.length !== bankLineIds.length) {
        throw new NotFoundException('One or more bank lines not found');
      }
      if (bLines.some((l) => l.isReconciled)) {
        throw new BadRequestException(
          'One or more bank lines are already reconciled',
        );
      }

      // 2. Verify journal lines
      const jLines = await tx
        .select()
        .from(glJournalLines)
        .where(inArray(glJournalLines.journalLineId, journalLineIds));

      if (jLines.length !== journalLineIds.length) {
        throw new NotFoundException('One or more journal lines not found');
      }
      if (jLines.some((l) => l.isReconciled || l.reconciliationId)) {
        throw new BadRequestException(
          'One or more journal lines are already reconciled or assigned',
        );
      }

      // 3. Verify sums match exactly
      const sumBank = bLines.reduce((acc, l) => acc + Number(l.amount), 0);
      const sumJournal = jLines.reduce(
        (acc, l) => acc + Number(l.debit) - Number(l.credit),
        0,
      );

      // Using a small epsilon to avoid floating point precision issues
      if (Math.abs(sumBank - sumJournal) > 0.001) {
        throw new BadRequestException(
          `Sums do not match (Bank: ${sumBank}, Journal: ${sumJournal})`,
        );
      }

      const matchGroupId = uuidv4();

      // 3.5 Record match group
      await tx.insert(glMatchGroups).values({
        matchGroupId,
        matchType: 'manual',
        createdBy: _actor,
      });

      // 4. Update journal lines
      await tx
        .update(glJournalLines)
        .set({
          reconciliationId,
          matchGroupId,
        })
        .where(inArray(glJournalLines.journalLineId, journalLineIds));

      // 5. Update bank lines
      await tx
        .update(bankStatementLines)
        .set({
          isReconciled: true,
          matchedJournalLineId: null, // Legacy, clear it
          matchGroupId,
        })
        .where(inArray(bankStatementLines.lineId, bankLineIds));

      return { success: true };
    });
  }

  async unmatch(matchGroupId: string, actor: string) {
    if (!matchGroupId)
      throw new BadRequestException('matchGroupId is required');

    return this.db.transaction(async (tx) => {
      const jLines = await tx
        .select()
        .from(glJournalLines)
        .where(eq(glJournalLines.matchGroupId, matchGroupId));

      await tx
        .update(bankStatementLines)
        .set({ isReconciled: false, matchGroupId: null })
        .where(eq(bankStatementLines.matchGroupId, matchGroupId));

      if (jLines.length > 0) {
        await tx
          .update(glJournalLines)
          .set({
            isReconciled: false,
            matchGroupId: null,
            reconciliationId: null,
          })
          .where(eq(glJournalLines.matchGroupId, matchGroupId));

        await tx
          .delete(glMatchGroups)
          .where(eq(glMatchGroups.matchGroupId, matchGroupId));

        const entryIds = [...new Set(jLines.map((jl) => jl.journalEntryId))];
        const entries = await tx
          .select()
          .from(glJournalEntries)
          .where(inArray(glJournalEntries.journalEntryId, entryIds));

        for (const entry of entries) {
          if (
            entry.sourceType === 'manual' &&
            entry.memo?.startsWith('Auto-reconciled:')
          ) {
            const linesToReverse = await tx
              .select()
              .from(glJournalLines)
              .where(eq(glJournalLines.journalEntryId, entry.journalEntryId));

            const glAccIds = [
              ...new Set(linesToReverse.map((l) => l.glAccountId)),
            ];
            const accs = await tx
              .select()
              .from(glAccounts)
              .where(inArray(glAccounts.glAccountId, glAccIds));
            const accMap = new Map(
              accs.map((a) => [a.glAccountId, a.accountCode]),
            );

            const jeLines = linesToReverse.map((line) => ({
              accountCode: accMap.get(line.glAccountId)!,
              debit: Number(line.credit),
              credit: Number(line.debit),
              memo: `Reversal of: ${line.memo}`,
            }));

            const meta = {
              sourceType: 'manual' as const,
              memo: `Reversal of Auto-reconciled entry: ${entry.entryNumber}`,
              entryDate: new Date().toISOString().split('T')[0],
              actor,
            };

            const reversalEntry = await this.glService.postJournalEntry(
              jeLines,
              meta,
              tx,
            );

            await tx
              .update(glJournalEntries)
              .set({
                isReversed: true,
                reversedBy: reversalEntry.journalEntryId,
              })
              .where(eq(glJournalEntries.journalEntryId, entry.journalEntryId));

            await tx
              .update(glJournalEntries)
              .set({
                isReversed: true,
              })
              .where(
                eq(
                  glJournalEntries.journalEntryId,
                  reversalEntry.journalEntryId,
                ),
              );
          }
        }
      }

      return { success: true };
    });
  }

  async getMatchGroup(matchGroupId: string) {
    const records = await this.db
      .select({
        matchGroup: glMatchGroups,
        ruleName: reconciliationRules.conditionValue,
      })
      .from(glMatchGroups)
      .leftJoin(
        reconciliationRules,
        eq(glMatchGroups.ruleId, reconciliationRules.ruleId),
      )
      .where(eq(glMatchGroups.matchGroupId, matchGroupId));

    if (!records.length) {
      return null;
    }

    const { matchGroup, ruleName } = records[0];
    return {
      matchGroupId: matchGroup.matchGroupId,
      matchType: matchGroup.matchType,
      ruleName: ruleName || null,
      createdBy: matchGroup.createdBy,
      createdOn: matchGroup.createdOn,
    };
  }
}
