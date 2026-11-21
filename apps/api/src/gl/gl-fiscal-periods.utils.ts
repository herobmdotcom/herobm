import {
  financialEvents,
  glFiscalPeriods,
  glSettings,
} from '@herobm/db-schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import type { DrizzleDB } from '../drizzle/drizzle.module';

/**
 * Verifies that the given entryDate does not fall into a locked or closed accounting period.
 */
export async function assertPeriodOpen(entryDate: string, db: DrizzleDB) {
  const [period] = await db
    .select()
    .from(glFiscalPeriods)
    .where(
      and(
        sql`${glFiscalPeriods.startDate} <= ${entryDate}`,
        sql`${glFiscalPeriods.endDate} >= ${entryDate}`,
      ),
    )
    .limit(1);

  if (!period) {
    return;
  }

  if (period.status === 'hard_closed') {
    throw new BadRequestException(
      `Cannot post to hard-closed accounting period '${period.periodName}' (${period.startDate} to ${period.endDate}). Postings in closed periods are forbidden.`,
    );
  }

  if (period.status === 'soft_locked') {
    throw new BadRequestException(
      `Cannot post to soft-locked accounting period '${period.periodName}' (${period.startDate} to ${period.endDate}). Period is locked for adjustments.`,
    );
  }
}

/**
 * Auto-generates 12 monthly fiscal periods for a fiscal year.
 */
export async function generateFiscalYearPeriods(
  db: DrizzleDB,
  fiscalYear: number,
  actor?: string,
) {
  const [settings] = await db
    .select({ fiscalYearStartMonth: glSettings.fiscalYearStartMonth })
    .from(glSettings)
    .limit(1);
  const startMonth = settings?.fiscalYearStartMonth || 1;

  await db.transaction(async (tx) => {
    for (let i = 0; i < 12; i++) {
      const periodNumber = i + 1;
      const monthZeroIndexed = (startMonth - 1 + i) % 12;
      const yearOffset = Math.floor((startMonth - 1 + i) / 12);
      const calendarYear = fiscalYear + yearOffset;
      const monthStr = String(monthZeroIndexed + 1).padStart(2, '0');

      const startDate = `${calendarYear}-${monthStr}-01`;
      const lastDay = new Date(calendarYear, monthZeroIndexed + 1, 0).getDate();
      const endDate = `${calendarYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      const periodName = `${calendarYear}-${monthStr}`;

      // n-plus-one-ignore: fixed 12-month calendar loop during fiscal year setup
      const [existing] = await tx
        .select()
        .from(glFiscalPeriods)
        .where(eq(glFiscalPeriods.periodName, periodName))
        .limit(1);

      if (!existing) {
        const notes = `Period ${periodNumber} of FY${fiscalYear} (created by ${actor || 'admin'})`;
        const [inserted] = await tx
          .insert(glFiscalPeriods)
          .values({
            periodName,
            fiscalYear,
            periodNumber,
            startDate,
            endDate,
            status: 'open',
            notes,
          })
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.FISCAL_PERIOD,
          entityId: inserted.periodId,
          eventType: EventType.CREATED,
          entityDisplayName: inserted.periodName,
          payload: {
            periodName: inserted.periodName,
            fiscalYear: inserted.fiscalYear,
            periodNumber: inserted.periodNumber,
            startDate: inserted.startDate,
            endDate: inserted.endDate,
            status: inserted.status,
            notes: inserted.notes,
          },
          actor,
        });
      }
    }
  });

  return getFiscalPeriods(db, { fiscalYear });
}

/**
 * Retrieves fiscal periods, optionally filtered by year and status.
 */
export async function getFiscalPeriods(
  db: DrizzleDB,
  query?: {
    fiscalYear?: number;
    status?: 'open' | 'soft_locked' | 'hard_closed';
  },
) {
  const targetYear = query?.fiscalYear || new Date().getFullYear();
  const existing = await db
    .select({ id: glFiscalPeriods.periodId })
    .from(glFiscalPeriods)
    .where(eq(glFiscalPeriods.fiscalYear, targetYear))
    .limit(1);

  if (existing.length === 0) {
    await generateFiscalYearPeriods(db, targetYear, 'system');
  }

  const conditions = [];
  if (query?.fiscalYear) {
    conditions.push(eq(glFiscalPeriods.fiscalYear, query.fiscalYear));
  }
  if (query?.status) {
    conditions.push(eq(glFiscalPeriods.status, query.status));
  }

  const periods = await db
    .select()
    .from(glFiscalPeriods)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(glFiscalPeriods.startDate);

  if (periods.length === 0) {
    return [];
  }

  const periodIds = periods.map((p) => p.periodId);
  const events = await db
    .select()
    .from(financialEvents)
    .where(
      and(
        eq(financialEvents.entityType, EntityType.FISCAL_PERIOD),
        inArray(financialEvents.entityId, periodIds),
      ),
    )
    .orderBy(sql`${financialEvents.createdOn} DESC`);

  const eventsByPeriodId = new Map<string, typeof events>();
  for (const evt of events) {
    const list = eventsByPeriodId.get(evt.entityId) || [];
    list.push(evt);
    eventsByPeriodId.set(evt.entityId, list);
  }

  return periods.map((p) => ({
    ...p,
    events: eventsByPeriodId.get(p.periodId) || [],
  }));
}

/**
 * Updates the status of an accounting period (open, soft_locked, hard_closed).
 */
export async function updatePeriodStatus(
  db: DrizzleDB,
  periodId: string,
  status: 'open' | 'soft_locked' | 'hard_closed',
  actor?: string,
  notes?: string,
) {
  return await db.transaction(async (tx) => {
    const [period] = await tx
      .select()
      .from(glFiscalPeriods)
      .where(eq(glFiscalPeriods.periodId, periodId))
      .limit(1);

    if (!period) {
      throw new NotFoundException(`Fiscal period '${periodId}' not found.`);
    }

    const updates: Record<string, unknown> = {
      status,
      modifiedOn: new Date(),
    };

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (status === 'soft_locked') {
      updates.lockedBy = actor || 'admin';
      updates.lockedAt = new Date();
    } else if (status === 'hard_closed') {
      updates.closedBy = actor || 'admin';
      updates.closedAt = new Date();
    } else if (status === 'open') {
      updates.lockedBy = null;
      updates.lockedAt = null;
      updates.closedBy = null;
      updates.closedAt = null;
    }

    const [updated] = await tx
      .update(glFiscalPeriods)
      .set(updates)
      .where(eq(glFiscalPeriods.periodId, periodId))
      .returning();

    if (status !== period.status) {
      await emitEvent(tx, {
        entityType: EntityType.FISCAL_PERIOD,
        entityId: updated.periodId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.periodName,
        payload: {
          periodName: updated.periodName,
          fiscalYear: updated.fiscalYear,
          periodNumber: updated.periodNumber,
          startDate: updated.startDate,
          endDate: updated.endDate,
          status: updated.status,
          notes: updated.notes,
        },
        actor,
      });
    } else {
      await emitEvent(tx, {
        entityType: EntityType.FISCAL_PERIOD,
        entityId: updated.periodId,
        eventType: EventType.UPDATED,
        entityDisplayName: updated.periodName,
        payload: {
          periodName: updated.periodName,
          fiscalYear: updated.fiscalYear,
          periodNumber: updated.periodNumber,
          startDate: updated.startDate,
          endDate: updated.endDate,
          status: updated.status,
          notes: updated.notes,
        },
        actor,
      });
    }

    return updated;
  });
}
