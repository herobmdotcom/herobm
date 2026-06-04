import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  csvMappingProfiles,
  reconciliationRules,
  bankStatementLines,
  glAccounts,
  glJournalLines,
  glJournalEntries,
  glMatchGroups,
  glSettings,
} from '../drizzle/modbm-core-schema';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import {
  CreateMappingProfileDto,
  CreateReconciliationRuleDto,
  UpdateReconciliationRuleDto,
} from './dto/bank-feeds.dto';
import { parse } from 'csv-parse/sync';
import { GlService } from './gl.service';

@Injectable()
export class BankFeedsService {
  private readonly logger = new Logger(BankFeedsService.name);

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
        amountMin: dto.amountMin?.toString(),
        amountMax: dto.amountMax?.toString(),
        costCenterId: dto.costCenterId,
        activityId: dto.activityId,
        partyType: dto.partyType,
        partyId: dto.partyId,
        priority: dto.priority ?? 10,
      })
      .returning();
    return result[0];
  }

  async updateReconciliationRule(
    ruleId: string,
    dto: UpdateReconciliationRuleDto,
  ) {
    const values: any = {};
    if (dto.glAccountId !== undefined) values.glAccountId = dto.glAccountId;
    if (dto.conditionType !== undefined)
      values.conditionType = dto.conditionType;
    if (dto.conditionValue !== undefined)
      values.conditionValue = dto.conditionValue;
    if (dto.targetGlAccountId !== undefined)
      values.targetGlAccountId = dto.targetGlAccountId;
    if (dto.amountMin !== undefined)
      values.amountMin = dto.amountMin?.toString();
    if (dto.amountMax !== undefined)
      values.amountMax = dto.amountMax?.toString();
    if (dto.costCenterId !== undefined) values.costCenterId = dto.costCenterId;
    if (dto.activityId !== undefined) values.activityId = dto.activityId;
    if (dto.partyType !== undefined) values.partyType = dto.partyType;
    if (dto.partyId !== undefined) values.partyId = dto.partyId;
    if (dto.priority !== undefined) values.priority = dto.priority;

    const result = await this.db
      .update(reconciliationRules)
      .set(values)
      .where(eq(reconciliationRules.ruleId, ruleId))
      .returning();
    if (!result.length) {
      throw new NotFoundException('Rule not found');
    }
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

  async importCsv(
    fileBuffer: Buffer,
    glAccountId: string,
    profileId: string,
    actor: string = 'system',
  ) {
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

        await tx.insert(bankStatementLines).values({
          glAccountId,
          date: dateIso,
          description: desc,
          amount: String(amount),
          reference: ref,
          isReconciled: false,
          matchedJournalLineId: null,
        });
      }
    });

    return await this.executeAutoMatching(glAccountId, actor);
  }

  async executeAutoMatching(
    glAccountId: string,
    actor: string = 'system',
    reconciliationId?: string,
    dryRun: boolean = false,
  ) {
    let autoMatchedCount = 0;
    let smartMatchedCount = 0;
    let unmatchedCount = 0;

    const rules = await this.getReconciliationRules();

    // Fetch settings for tolerance parameters
    const settingsRows = await this.db.select().from(glSettings).limit(1);
    const settings = settingsRows.length > 0 ? settingsRows[0] : null;

    // Get GL Account info
    const accs = await this.db
      .select({ code: glAccounts.accountCode })
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, glAccountId));
    if (!accs.length) throw new NotFoundException('GL Account not found');
    const bankAccountCode = accs[0].code;

    const smartMatches: {
      bankLineIds: string[];
      journalLineIds: string[];
      confidence: 'high' | 'medium';
      date: string;
      description: string;
      amount: number;
    }[] = [];

    const proposedRuleMatches: {
      bankLineId: string;
      date: string;
      description: string;
      amount: number;
      ruleId: string;
      targetGlAccountId: string;
    }[] = [];

    await this.db.transaction(async (tx) => {
      // Get all unreconciled bank lines for this account
      const lines = await tx
        .select()
        .from(bankStatementLines)
        .where(
          and(
            eq(bankStatementLines.glAccountId, glAccountId),
            eq(bankStatementLines.isReconciled, false),
          ),
        );

      for (const line of lines) {
        const desc = line.description || '';
        const amount = parseFloat(line.amount);
        const dateIso = line.date;

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

          if (rule.amountMin !== null && rule.amountMin !== undefined) {
            if (amount < parseFloat(rule.amountMin as any)) continue;
          }
          if (rule.amountMax !== null && rule.amountMax !== undefined) {
            if (amount > parseFloat(rule.amountMax as any)) continue;
          }

          if (matches) {
            matchedRule = rule;
            break;
          }
        }

        if (matchedRule) {
          const targetAccs = await tx
            .select({
              id: glAccounts.glAccountId,
            })
            .from(glAccounts)
            .where(eq(glAccounts.glAccountId, matchedRule.targetGlAccountId));

          if (targetAccs.length) {
            const isDeposit = amount > 0;
            const absAmount = Math.abs(amount);

            if (dryRun) {
              proposedRuleMatches.push({
                bankLineId: line.lineId,
                date: line.date,
                description: line.description || '',
                amount,
                ruleId: matchedRule.ruleId,
                targetGlAccountId: matchedRule.targetGlAccountId,
              });
              autoMatchedCount++;
              continue;
            }

            const jeLines = [
              {
                accountId: glAccountId,
                debit: isDeposit ? absAmount : 0,
                credit: isDeposit ? 0 : absAmount,
                memo: desc,
              },
              {
                accountId: matchedRule.targetGlAccountId,
                debit: isDeposit ? 0 : absAmount,
                credit: isDeposit ? absAmount : 0,
                memo: desc,
                costCenterId: matchedRule.costCenterId ?? undefined,
                activityId: matchedRule.activityId ?? undefined,
                partyType:
                  (matchedRule.partyType as 'customer' | 'supplier') ??
                  undefined,
                partyId: matchedRule.partyId ?? undefined,
              },
            ];

            const meta = {
              sourceType: 'manual' as const, // Uses 'manual' because 'auto_rule' isn't in schema, but memo flags it
              memo: `Auto-reconciled: ${desc}`,
              entryDate: dateIso,
              actor: 'system',
            };

            const je = await this.glService.postJournalEntry(jeLines, meta, tx);
            const matchGroupId = randomUUID();

            // Find the journal line that hits the bank account
            const bankJeLine = await tx
              .select()
              .from(glJournalLines)
              .where(
                and(
                  eq(glJournalLines.journalEntryId, je.journalEntryId),
                  eq(glJournalLines.glAccountId, glAccountId),
                ),
              );

            if (bankJeLine.length === 0) {
              this.logger.error(
                `Failed to find journal line for bank account ${glAccountId} in JE ${je.journalEntryId}`,
              );
              throw new Error(
                `Auto-match failed: Ledger entry created but bank journal line could not be found to mark as reconciled.`,
              );
            }

            await tx
              .update(glJournalLines)
              .set({
                isReconciled: true,
                matchGroupId,
                reconciliationId: reconciliationId || null,
              })
              .where(
                eq(glJournalLines.journalLineId, bankJeLine[0].journalLineId),
              );

            await tx
              .update(bankStatementLines)
              .set({ isReconciled: true, matchGroupId })
              .where(eq(bankStatementLines.lineId, line.lineId));

            await tx.insert(glMatchGroups).values({
              matchGroupId,
              matchType: 'rule',
              ruleId: matchedRule.ruleId,
              createdBy: actor,
            });

            autoMatchedCount++;
            continue;
          }
        }

        // Smart Matches (Suggestions)
        const isDeposit = amount > 0;
        const absAmount = Math.abs(amount);

        const dateObj = new Date(dateIso);
        const minDate = new Date(dateObj);
        minDate.setDate(
          minDate.getDate() - (settings?.bankMatchDateToleranceDays || 3),
        );
        const maxDate = new Date(dateObj);
        maxDate.setDate(
          maxDate.getDate() + (settings?.bankMatchDateToleranceDays || 3),
        );

        const minDateIso = minDate.toISOString().split('T')[0];
        const maxDateIso = maxDate.toISOString().split('T')[0];

        const queryMatches = await tx
          .select({
            journalLineId: glJournalLines.journalLineId,
            entryDate: glJournalEntries.entryDate,
          })
          .from(glJournalLines)
          .innerJoin(
            glJournalEntries,
            eq(glJournalLines.journalEntryId, glJournalEntries.journalEntryId),
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

        if (queryMatches.length > 0) {
          const exactMatches = queryMatches.filter(
            (m) => m.entryDate === dateIso,
          );
          if (
            (exactMatches.length === 1 && queryMatches.length === 1) ||
            queryMatches.length === 1
          ) {
            const confidence = exactMatches.length === 1 ? 'high' : 'medium';
            if (!dryRun) {
              const matchGroupId = randomUUID();

              await tx
                .update(glJournalLines)
                .set({
                  isReconciled: true,
                  matchGroupId,
                  reconciliationId: reconciliationId || null,
                })
                .where(
                  eq(
                    glJournalLines.journalLineId,
                    queryMatches[0].journalLineId,
                  ),
                );

              await tx
                .update(bankStatementLines)
                .set({ isReconciled: true, matchGroupId })
                .where(eq(bankStatementLines.lineId, line.lineId));

              await tx.insert(glMatchGroups).values({
                matchGroupId,
                matchType: 'auto',
                createdBy: actor,
              });
            } else {
              smartMatches.push({
                bankLineIds: [line.lineId],
                journalLineIds: [queryMatches[0].journalLineId],
                confidence,
                date: line.date,
                description: line.description || '',
                amount,
              });
            }
            smartMatchedCount++;
          } else {
            unmatchedCount++;
          }
        } else {
          unmatchedCount++;
        }
      }
    });

    return {
      autoMatchedCount,
      smartMatchedCount,
      unmatchedCount,
      smartMatches,
      proposedRuleMatches,
    };
  }
}
