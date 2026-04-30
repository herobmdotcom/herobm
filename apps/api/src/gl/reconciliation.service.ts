import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { glReconciliations, glJournalLines, glAccounts, glJournalEntries, accounts, suppliers } from '../drizzle/modbm-core-schema';
import { eq, and, sql, isNull, lte, asc, or, not } from 'drizzle-orm';
import { CreateReconciliationDto, CreateAdjustmentDto } from './dto';
import { GlService, JournalMeta } from './gl.service';

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService
  ) {}
  async getReconciliations() {
    try {
      return await this.db.select({
        reconciliationId: glReconciliations.reconciliationId,
        glAccountId: glReconciliations.glAccountId,
        accountName: glAccounts.name,
        statementDate: glReconciliations.statementDate,
        statementBalance: glReconciliations.statementBalance,
        status: glReconciliations.status,
        createdOn: glReconciliations.createdOn,
        postedOn: glReconciliations.postedOn
      })
      .from(glReconciliations)
      .leftJoin(glAccounts, eq(glReconciliations.glAccountId, glAccounts.glAccountId))
      .orderBy(asc(glReconciliations.createdOn));
    } catch (err) {
      console.error('getReconciliations error:', err);
      throw err;
    }
  }

  async getReconciliation(id: string) {
    const records = await this.db.select({
      reconciliationId: glReconciliations.reconciliationId,
      glAccountId: glReconciliations.glAccountId,
      accountName: glAccounts.name,
      statementDate: glReconciliations.statementDate,
      statementBalance: glReconciliations.statementBalance,
      status: glReconciliations.status,
    })
    .from(glReconciliations)
    .leftJoin(glAccounts, eq(glReconciliations.glAccountId, glAccounts.glAccountId))
    .where(eq(glReconciliations.reconciliationId, id));

    if (!records.length) {
      throw new NotFoundException('Reconciliation not found');
    }

    const rec = records[0];

    // Calculate opening balance (sum of all POSTED lines for this account that are NOT this reconciliation)
    const openingRes = await this.db.select({
      total: sql<number>`SUM(${glJournalLines.debit} - ${glJournalLines.credit})`
    })
    .from(glJournalLines)
    .where(
      and(
        eq(glJournalLines.glAccountId, rec.glAccountId),
        eq(glJournalLines.isReconciled, true),
        // we exclude the current reconciliation just in case it is already posted
        not(eq(glJournalLines.reconciliationId, id))
      )
    );

    const openingBalance = openingRes[0]?.total ? Number(openingRes[0].total) : 0;

    // Calculate cleared balance (sum of all lines linked to THIS reconciliation)
    const clearedRes = await this.db.select({
      total: sql<number>`SUM(${glJournalLines.debit} - ${glJournalLines.credit})`
    })
    .from(glJournalLines)
    .where(eq(glJournalLines.reconciliationId, id));

    const clearedBalance = clearedRes[0]?.total ? Number(clearedRes[0].total) : 0;

    return {
      ...rec,
      statementBalance: Number(rec.statementBalance),
      openingBalance,
      clearedBalance,
      variance: Number(rec.statementBalance) - (openingBalance + clearedBalance)
    };
  }

  async createReconciliation(data: CreateReconciliationDto) {
    const result = await this.db.insert(glReconciliations).values({
      glAccountId: data.glAccountId,
      statementDate: data.statementDate,
      statementBalance: String(data.statementBalance),
      status: 'draft',
      createdBy: data.createdBy,
    }).returning({ reconciliationId: glReconciliations.reconciliationId });
    return result[0];
  }

  async getLines(id: string) {
    const recs = await this.db.select().from(glReconciliations).where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    const rec = recs[0];

    // Return lines for this account where:
    // entryDate <= statementDate AND
    // (reconciliationId IS NULL OR reconciliationId = THIS)
    const lines = await this.db.select({
      journalLineId: glJournalLines.journalLineId,
      journalEntryId: glJournalLines.journalEntryId,
      entryDate: glJournalEntries.entryDate,
      entryNumber: glJournalEntries.entryNumber,
      memo: glJournalLines.memo,
      entryMemo: glJournalEntries.memo,
      debit: glJournalLines.debit,
      credit: glJournalLines.credit,
      isCleared: sql<boolean>`${glJournalLines.reconciliationId} = ${id}`,
      partyType: glJournalLines.partyType,
      partyId: glJournalLines.partyId,
      partyName: sql<string>`COALESCE(${accounts.name}, ${suppliers.name})`
    })
      .from(glJournalLines)
      .innerJoin(glJournalEntries, eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId))
      .leftJoin(accounts, eq(glJournalLines.partyId, sql<string>`${accounts.accountId}::text`))
      .leftJoin(suppliers, eq(glJournalLines.partyId, sql<string>`${suppliers.vendorId}::text`))
      .where(
        and(
          eq(glJournalLines.glAccountId, rec.glAccountId),
          lte(sql`DATE(${glJournalEntries.entryDate})`, sql`DATE(${rec.statementDate})`),
          or(
            isNull(glJournalLines.reconciliationId),
            eq(glJournalLines.reconciliationId, id)
          )
        )
      )
      .orderBy(asc(glJournalEntries.entryDate));

    return lines.map((line: any) => ({
      ...line,
      debit: Number(line.debit),
      credit: Number(line.credit)
    }));
  }

  async toggleLine(reconciliationId: string, journalLineId: string, isCleared: boolean) {
    const recs = await this.db.select().from(glReconciliations).where(eq(glReconciliations.reconciliationId, reconciliationId));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === 'posted') throw new BadRequestException('Reconciliation is already posted');

    await this.db.update(glJournalLines)
      .set({
        reconciliationId: isCleared ? reconciliationId : null
      })
      .where(eq(glJournalLines.journalLineId, journalLineId));
    return { success: true };
  }

  async postReconciliation(id: string) {
    const details = await this.getReconciliation(id);
    if (details.status === 'posted') {
      throw new BadRequestException('Already posted');
    }

    if (Math.abs(details.variance) > 0.001) {
      throw new BadRequestException('Variance must be zero before posting');
    }

    // Mark all lines linked to this reconciliation as fully reconciled
    await this.db.update(glJournalLines)
      .set({ isReconciled: true })
      .where(eq(glJournalLines.reconciliationId, id));

    // Mark reconciliation as posted
    await this.db.update(glReconciliations)
      .set({ status: 'posted', postedOn: new Date() })
      .where(eq(glReconciliations.reconciliationId, id));

    return { success: true };
  }

  async discardReconciliation(id: string) {
    const recs = await this.db.select().from(glReconciliations).where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === 'posted') throw new BadRequestException('Cannot discard a posted reconciliation');

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
    const recs = await this.db.select().from(glReconciliations).where(eq(glReconciliations.reconciliationId, id));
    if (!recs.length) throw new NotFoundException('Reconciliation not found');
    if (recs[0].status === 'posted') throw new BadRequestException('Reconciliation is already posted');

    const rec = recs[0];

    // Fetch the primary account code
    const primaryAccs = await this.db.select({ code: glAccounts.accountCode }).from(glAccounts).where(eq(glAccounts.glAccountId, rec.glAccountId));
    if (!primaryAccs.length) throw new NotFoundException('Primary GL Account not found');
    const primaryAccountCode = primaryAccs[0].code;

    // Fetch the offset account code
    const offsetAccs = await this.db.select({ code: glAccounts.accountCode }).from(glAccounts).where(eq(glAccounts.glAccountId, dto.offsetAccountId));
    if (!offsetAccs.length) throw new NotFoundException('Offset GL Account not found');
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

    const newJournalId = await this.glService.postJournalEntry([primaryLine, offsetLine], meta);

    // After creating the journal entry, we want to auto-clear the line for the primary account
    // We just find the line belonging to primaryAccountCode in this new journal entry
    const newLines = await this.db.select({ journalLineId: glJournalLines.journalLineId })
      .from(glJournalLines)
      .where(
        and(
          eq(glJournalLines.journalEntryId, newJournalId.journalEntryId),
          eq(glJournalLines.glAccountId, rec.glAccountId)
        )
      )
      .limit(1);

    if (newLines.length) {
      await this.toggleLine(id, newLines[0].journalLineId, true);
    }

    return { success: true, journalEntryId: newJournalId.journalEntryId };
  }
}
