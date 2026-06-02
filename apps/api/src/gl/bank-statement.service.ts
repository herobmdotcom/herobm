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
} from '../drizzle/modbm-core-schema';
import { eq, and, desc } from 'drizzle-orm';

@Injectable()
export class BankStatementService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
}
