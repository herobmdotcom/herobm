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
} from '@herobm/db-schema';
import { eq, asc, and, gte, lte } from 'drizzle-orm';
import {
  CreateMappingProfileDto,
  UpdateMappingProfileDto,
  CreateReconciliationRuleDto,
  UpdateReconciliationRuleDto,
} from './dto/bank-feeds.dto';
import { parse } from 'csv-parse/sync';
import { GlService } from './gl.service';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

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

  async getMappingProfiles() {
    return this.db
      .select()
      .from(csvMappingProfiles)
      .orderBy(asc(csvMappingProfiles.createdOn));
  }

  async createMappingProfile(dto: CreateMappingProfileDto) {
    return this.db.transaction(async (tx) => {
      const result = await tx
        .insert(csvMappingProfiles)
        .values({
          name: dto.name,
          dateColumn: dto.dateColumn,
          amountColumn: dto.amountColumn || '',
          debitColumn: dto.debitColumn,
          creditColumn: dto.creditColumn,
          descriptionColumn: dto.descriptionColumn,
          typeColumn: dto.typeColumn,
          payeeColumn: dto.payeeColumn,
          referenceColumn: dto.referenceColumn,
          headerRows: dto.headerRows,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.CSV_MAPPING_PROFILE,
        entityId: result[0].profileId,
        eventType: EventType.CREATED,
        entityDisplayName: result[0].name,
        payload: result[0],
      });

      return result[0];
    });
  }

  async updateMappingProfile(profileId: string, dto: UpdateMappingProfileDto) {
    const values: Partial<typeof csvMappingProfiles.$inferInsert> = {};
    if (dto.name !== undefined) values.name = dto.name;
    if (dto.dateColumn !== undefined) values.dateColumn = dto.dateColumn;
    if (dto.amountColumn !== undefined)
      values.amountColumn = dto.amountColumn || '';
    if (dto.debitColumn !== undefined) values.debitColumn = dto.debitColumn;
    if (dto.creditColumn !== undefined) values.creditColumn = dto.creditColumn;
    if (dto.descriptionColumn !== undefined)
      values.descriptionColumn = dto.descriptionColumn;
    if (dto.typeColumn !== undefined) values.typeColumn = dto.typeColumn;
    if (dto.payeeColumn !== undefined) values.payeeColumn = dto.payeeColumn;
    if (dto.referenceColumn !== undefined)
      values.referenceColumn = dto.referenceColumn;
    if (dto.headerRows !== undefined) values.headerRows = dto.headerRows;

    return this.db.transaction(async (tx) => {
      const result = await tx
        .update(csvMappingProfiles)
        .set(values)
        .where(eq(csvMappingProfiles.profileId, profileId))
        .returning();
      if (!result.length) {
        throw new NotFoundException('Mapping profile not found');
      }

      await emitEvent(tx, {
        entityType: EntityType.CSV_MAPPING_PROFILE,
        entityId: result[0].profileId,
        eventType: EventType.UPDATED,
        entityDisplayName: result[0].name,
        payload: values,
      });

      return result[0];
    });
  }

  async deleteMappingProfile(profileId: string) {
    return this.db.transaction(async (tx) => {
      const result = await tx
        .delete(csvMappingProfiles)
        .where(eq(csvMappingProfiles.profileId, profileId))
        .returning();
      if (!result.length) {
        throw new NotFoundException('Mapping profile not found');
      }

      await emitEvent(tx, {
        entityType: EntityType.CSV_MAPPING_PROFILE,
        entityId: profileId,
        eventType: EventType.DELETED,
        entityDisplayName: result[0].name,
        payload: { profileId },
      });

      return true;
    });
  }

  async getReconciliationRules() {
    return this.db
      .select()
      .from(reconciliationRules)
      .orderBy(asc(reconciliationRules.priority));
  }

  async createReconciliationRule(
    dto: CreateReconciliationRuleDto,
    actor?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const result = await tx
        .insert(reconciliationRules)
        .values({
          glAccountIds: dto.glAccountIds?.length ? dto.glAccountIds : null,
          conditionType: dto.conditionType || null,
          conditionValue: dto.conditionValue || null,
          typeCondition: dto.typeCondition || null,
          payeeConditionType: dto.payeeConditionType || null,
          payeeConditionValue: dto.payeeConditionValue || null,
          targetGlAccountId: dto.targetGlAccountId,
          amountMin: dto.amountMin?.toString(),
          amountMax: dto.amountMax?.toString(),
          costCenterId: dto.costCenterId,
          activityId: dto.activityId,
          partyType: dto.partyType,
          partyId: dto.partyId,
          memo: dto.memo,
          priority: dto.priority ?? 10,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.RECONCILIATION_RULE,
        entityId: result[0].ruleId,
        eventType: EventType.CREATED,
        entityDisplayName: `Rule ${result[0].ruleId}`,
        payload: dto,
        actor,
      });

      return result[0];
    });
  }

  async updateReconciliationRule(
    ruleId: string,
    dto: UpdateReconciliationRuleDto,
    actor?: string,
  ) {
    const values: Partial<typeof reconciliationRules.$inferInsert> = {};
    if (dto.glAccountIds !== undefined)
      values.glAccountIds = dto.glAccountIds?.length ? dto.glAccountIds : null;
    if (dto.conditionType !== undefined)
      values.conditionType = dto.conditionType;
    if (dto.conditionValue !== undefined)
      values.conditionValue = dto.conditionValue;
    if (dto.typeCondition !== undefined)
      values.typeCondition = dto.typeCondition;
    if (dto.payeeConditionType !== undefined)
      values.payeeConditionType = dto.payeeConditionType;
    if (dto.payeeConditionValue !== undefined)
      values.payeeConditionValue = dto.payeeConditionValue;
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
    if (dto.memo !== undefined) values.memo = dto.memo;
    if (dto.priority !== undefined) values.priority = dto.priority;

    return await this.db.transaction(async (tx) => {
      const result = await tx
        .update(reconciliationRules)
        .set(values)
        .where(eq(reconciliationRules.ruleId, ruleId))
        .returning();
      if (!result.length) {
        throw new NotFoundException('Rule not found');
      }

      await emitEvent(tx, {
        entityType: EntityType.RECONCILIATION_RULE,
        entityId: ruleId,
        eventType: EventType.UPDATED,
        entityDisplayName: `Rule ${ruleId}`,
        payload: dto,
        actor,
      });

      return result[0];
    });
  }

  async deleteReconciliationRule(ruleId: string, actor?: string) {
    return await this.db.transaction(async (tx) => {
      const result = await tx
        .delete(reconciliationRules)
        .where(eq(reconciliationRules.ruleId, ruleId))
        .returning();
      if (!result.length) {
        throw new NotFoundException('Rule not found');
      }

      await emitEvent(tx, {
        entityType: EntityType.RECONCILIATION_RULE,
        entityId: ruleId,
        eventType: EventType.DELETED,
        entityDisplayName: `Rule ${ruleId}`,
        payload: { deleted: true },
        actor,
      });

      return result[0];
    });
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

    const colToIndex = (col: string | null): number => {
      if (!col) return -1;
      if (/^\d+$/.test(col)) return parseInt(col, 10);
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
      }
      return index - 1;
    };

    const dateIdx = colToIndex(profile.dateColumn);
    const amountIdx = colToIndex(profile.amountColumn || '');
    const debitIdx = profile.debitColumn ? colToIndex(profile.debitColumn) : -1;
    const creditIdx = profile.creditColumn
      ? colToIndex(profile.creditColumn)
      : -1;
    const descIdx = colToIndex(profile.descriptionColumn);
    const typeIdx = profile.typeColumn ? colToIndex(profile.typeColumn) : -1;
    const payeeIdx = profile.payeeColumn ? colToIndex(profile.payeeColumn) : -1;
    const refIdx = profile.referenceColumn
      ? colToIndex(profile.referenceColumn)
      : -1;

    await this.db.transaction(async (tx) => {
      for (const record of records) {
        const dateStr = record[dateIdx];
        const desc = record[descIdx] || '';
        const type = typeIdx >= 0 ? record[typeIdx] : '';
        const payee = payeeIdx >= 0 ? record[payeeIdx] : '';
        const ref = refIdx >= 0 ? record[refIdx] : '';

        let amountStr = '';
        if (amountIdx >= 0 && record[amountIdx]) {
          amountStr = record[amountIdx];
        } else if (debitIdx >= 0 && record[debitIdx]) {
          amountStr = '-' + record[debitIdx];
        } else if (creditIdx >= 0 && record[creditIdx]) {
          amountStr = record[creditIdx];
        }

        if (!dateStr || !amountStr) continue;

        const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date();
        }

        const dateIso = parsedDate.toISOString().split('T')[0];

        const [inserted] = await tx
          .insert(bankStatementLines)
          .values({
            glAccountId,
            date: dateIso,
            description: desc,
            amount: String(amount),
            reference: ref,
            type: type || null,
            payee: payee || null,
            isReconciled: false,
            matchedJournalLineId: null,
          })
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.BANK_STATEMENT_LINE,
          entityId: inserted.lineId,
          eventType: EventType.CREATED,
          entityDisplayName: `Statement Line ${inserted.lineId}`,
          payload: {
            glAccountId,
            date: dateIso,
            description: desc,
            amount: String(amount),
          },
          actor,
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
    ignoredStatementLineIds?: string[],
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
        if (ignoredStatementLineIds?.includes(line.lineId)) {
          unmatchedCount++;
          continue;
        }

        const desc = line.description || '';
        const lineType = line.type || '';
        const linePayee = line.payee || '';
        const amount = parseFloat(line.amount);
        const dateIso = line.date;

        let matchedRule = null;
        for (const rule of rules) {
          if (
            rule.glAccountIds &&
            rule.glAccountIds.length > 0 &&
            !rule.glAccountIds.includes(glAccountId)
          ) {
            continue;
          }

          let matchesDesc = true;
          if (rule.conditionType && rule.conditionValue) {
            matchesDesc = false;
            const searchDesc = desc.toLowerCase();
            const targetVal = rule.conditionValue.toLowerCase();

            if (
              rule.conditionType === 'contains' &&
              searchDesc.includes(targetVal)
            )
              matchesDesc = true;
            if (
              rule.conditionType === 'starts_with' &&
              searchDesc.startsWith(targetVal)
            )
              matchesDesc = true;
            if (
              rule.conditionType === 'exact_match' &&
              searchDesc === targetVal
            )
              matchesDesc = true;
          }

          let matchesType = true;
          if (rule.typeCondition) {
            matchesType =
              lineType.toLowerCase() === rule.typeCondition.toLowerCase();
          }

          let matchesPayee = true;
          if (rule.payeeConditionType && rule.payeeConditionValue) {
            matchesPayee = false;
            const searchPayee = linePayee.toLowerCase();
            const targetPayeeVal = rule.payeeConditionValue.toLowerCase();
            if (
              rule.payeeConditionType === 'contains' &&
              searchPayee.includes(targetPayeeVal)
            )
              matchesPayee = true;
            if (
              rule.payeeConditionType === 'starts_with' &&
              searchPayee.startsWith(targetPayeeVal)
            )
              matchesPayee = true;
            if (
              rule.payeeConditionType === 'exact_match' &&
              searchPayee === targetPayeeVal
            )
              matchesPayee = true;
          }

          if (!matchesDesc || !matchesType || !matchesPayee) continue;

          if (rule.amountMin !== null && rule.amountMin !== undefined) {
            if (amount < parseFloat(String(rule.amountMin))) continue;
          }
          if (rule.amountMax !== null && rule.amountMax !== undefined) {
            if (amount > parseFloat(String(rule.amountMax))) continue;
          }

          matchedRule = rule;
          break;
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

            await tx.insert(glMatchGroups).values({
              matchGroupId,
              matchType: 'rule',
              ruleId: matchedRule.ruleId,
              createdBy: actor,
            });

            await emitEvent(tx, {
              entityType: EntityType.GL_MATCH_GROUP,
              entityId: matchGroupId,
              eventType: EventType.CREATED,
              entityDisplayName: `Match Group (Auto Rule)`,
              payload: { matchType: 'rule', ruleId: matchedRule.ruleId },
              actor,
            });

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

              await tx.insert(glMatchGroups).values({
                matchGroupId,
                matchType: 'auto',
                createdBy: actor,
              });

              await emitEvent(tx, {
                entityType: EntityType.GL_MATCH_GROUP,
                entityId: matchGroupId,
                eventType: EventType.CREATED,
                entityDisplayName: `Match Group (Smart Auto)`,
                payload: { matchType: 'auto' },
                actor,
              });

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
