import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  csvMappingProfiles,
  reconciliationRules,
  bankStatementLines,
  glAccounts,
  glJournalLines,
  glJournalEntries,
} from '../drizzle/modbm-core-schema';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import {
  CreateMappingProfileDto,
  CreateReconciliationRuleDto,
} from './dto/bank-feeds.dto';
import { parse } from 'csv-parse/sync';
import { GlService } from './gl.service';

@Injectable()
export class BankFeedsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async parseCsvHeaders(fileBuffer: Buffer) {
    const records = parse(fileBuffer, {
      skip_empty_lines: true,
      from_line: 1,
      to_line: 6,
    });

    if (!records || records.length === 0) {
      throw new Error('CSV file is empty or invalid.');
    }

    return {
      headers: records[0],
      sampleRows: records.slice(1),
    };
  }

  async getMappingProfiles(glAccountId: string) {
    return this.db
      .select()
      .from(csvMappingProfiles)
      .where(eq(csvMappingProfiles.glAccountId, glAccountId))
      .orderBy(asc(csvMappingProfiles.createdOn));
  }

  async createMappingProfile(dto: CreateMappingProfileDto) {
    const result = await this.db
      .insert(csvMappingProfiles)
      .values({
        glAccountId: dto.glAccountId,
        name: dto.name,
        dateColumn: dto.dateColumn,
        amountColumn: dto.amountColumn,
        descriptionColumn: dto.descriptionColumn,
        referenceColumn: dto.referenceColumn,
        headerRows: dto.headerRows,
      })
      .returning();
    return result[0];
  }

  async getReconciliationRules() {
    return this.db
      .select()
      .from(reconciliationRules)
      .orderBy(asc(reconciliationRules.priority));
  }

  async createReconciliationRule(dto: CreateReconciliationRuleDto) {
    const result = await this.db
      .insert(reconciliationRules)
      .values({
        glAccountId: dto.glAccountId,
        conditionType: dto.conditionType,
        conditionValue: dto.conditionValue,
        targetGlAccountId: dto.targetGlAccountId,
        priority: dto.priority ?? 10,
      })
      .returning();
    return result[0];
  }

  async deleteReconciliationRule(ruleId: string) {
    const result = await this.db
      .delete(reconciliationRules)
      .where(eq(reconciliationRules.ruleId, ruleId))
      .returning();
    if (!result.length) {
      throw new NotFoundException('Rule not found');
    }
    return result[0];
  }

  async importCsv(fileBuffer: Buffer, glAccountId: string, profileId: string) {
    // 1. Get mapping profile
    const profiles = await this.db
      .select()
      .from(csvMappingProfiles)
      .where(eq(csvMappingProfiles.profileId, profileId));

    if (!profiles.length)
      throw new NotFoundException('Mapping profile not found');
    const profile = profiles[0];

    // 2. Get Rules
    const rules = await this.getReconciliationRules();

    // 3. Get GL Account
    const accs = await this.db
      .select({ code: glAccounts.accountCode })
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, glAccountId));
    if (!accs.length) throw new NotFoundException('GL Account not found');
    const bankAccountCode = accs[0].code;

    // 4. Parse CSV
    const records = parse(fileBuffer, {
      skip_empty_lines: true,
      from_line: (profile.headerRows || 0) + 1,
    });

    let autoMatchedCount = 0;
    let smartMatchedCount = 0;
    let unmatchedCount = 0;

    await this.db.transaction(async (tx) => {
      for (const record of records) {
        const dateStr = record[profile.dateColumn];
        const amountStr = record[profile.amountColumn];
        const desc = record[profile.descriptionColumn] || '';
        const ref = profile.referenceColumn
          ? record[profile.referenceColumn]
          : '';

        if (!dateStr || !amountStr) continue;

        const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date();
        }

        const dateIso = parsedDate.toISOString().split('T')[0];

        let matchedRule = null;
        for (const rule of rules) {
          if (rule.glAccountId && rule.glAccountId !== glAccountId) continue;

          let matches = false;
          const searchDesc = desc.toLowerCase();
          const targetVal = rule.conditionValue.toLowerCase();

          if (
            rule.conditionType === 'contains' &&
            searchDesc.includes(targetVal)
          )
            matches = true;
          if (
            rule.conditionType === 'starts_with' &&
            searchDesc.startsWith(targetVal)
          )
            matches = true;
          if (rule.conditionType === 'exact_match' && searchDesc === targetVal)
            matches = true;

          if (matches) {
            matchedRule = rule;
            break;
          }
        }

        if (matchedRule) {
          const targetAccs = await tx
            .select({
              code: glAccounts.accountCode,
              id: glAccounts.glAccountId,
            })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, matchedRule.targetGlAccountId));
          if (targetAccs.length) {
            const targetAccountCode = targetAccs[0].code;

            const isDeposit = amount > 0;
            const absAmount = Math.abs(amount);

            const lines = [
              {
                accountCode: bankAccountCode,
                debit: isDeposit ? absAmount : 0,
                credit: isDeposit ? 0 : absAmount,
                memo: desc,
              },
              {
                accountCode: targetAccountCode,
                debit: isDeposit ? 0 : absAmount,
                credit: isDeposit ? absAmount : 0,
                memo: desc,
              },
            ];

            const meta = {
              sourceType: 'manual' as const,
              memo: `Auto-reconciled: ${desc}`,
              entryDate: dateIso,
              actor: 'system',
            };

            await this.glService.postJournalEntry(lines, meta, tx);

            await tx.insert(bankStatementLines).values({
              glAccountId,
              date: dateIso,
              description: desc,
              amount: String(amount),
              reference: ref,
              isReconciled: true,
            });
            autoMatchedCount++;
            continue;
          }
        }

        let smartMatchedJournalLineId: string | null = null;
        if (!matchedRule) {
          const isDeposit = amount > 0;
          const absAmount = Math.abs(amount);

          const dateObj = new Date(dateIso);
          const minDate = new Date(dateObj);
          minDate.setDate(minDate.getDate() - 3);
          const maxDate = new Date(dateObj);
          maxDate.setDate(maxDate.getDate() + 3);

          const minDateIso = minDate.toISOString().split('T')[0];
          const maxDateIso = maxDate.toISOString().split('T')[0];

          const queryMatches = await tx
            .select({
              journalLineId: glJournalLines.journalLineId,
            })
            .from(glJournalLines)
            .innerJoin(
              glJournalEntries,
              eq(
                glJournalLines.journalEntryId,
                glJournalEntries.journalEntryId,
              ),
            )
            .where(
              and(
                eq(glJournalLines.glAccountId, glAccountId),
                eq(glJournalLines.isReconciled, false),
                isDeposit
                  ? eq(glJournalLines.debit, String(absAmount))
                  : eq(glJournalLines.credit, String(absAmount)),
                gte(glJournalEntries.entryDate, minDateIso),
                lte(glJournalEntries.entryDate, maxDateIso),
              ),
            );

          if (queryMatches.length === 1) {
            smartMatchedJournalLineId = queryMatches[0].journalLineId;
            smartMatchedCount++;
          } else {
            unmatchedCount++;
          }
        }

        await tx.insert(bankStatementLines).values({
          glAccountId,
          date: dateIso,
          description: desc,
          amount: String(amount),
          reference: ref,
          isReconciled: false,
          matchedJournalLineId: smartMatchedJournalLineId,
        });
      }
    });

    return { autoMatchedCount, smartMatchedCount, unmatchedCount };
  }
}
