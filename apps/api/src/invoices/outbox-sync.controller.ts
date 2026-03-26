import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { outbox } from '../drizzle/modbm-core-schema';
import { desc, isNull, isNotNull, sql, count, eq, and } from 'drizzle-orm';

@Controller('settings/erpnext-sync')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class OutboxSyncController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Returns a summary overview of outbox health + recent events for the sync dashboard.
   */
  @Get()
  @CasbinAction('read')
  async getSyncStatus(@Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr || '50', 10), 200);

    // Summary counts
    const [pendingResult] = await this.db
      .select({ count: count() })
      .from(outbox)
      .where(and(isNull(outbox.processedAt), isNull(outbox.lastError)));

    const [processedResult] = await this.db
      .select({ count: count() })
      .from(outbox)
      .where(isNotNull(outbox.processedAt));

    const [failedResult] = await this.db
      .select({ count: count() })
      .from(outbox)
      .where(isNotNull(outbox.lastError));

    // Per-event-type breakdown
    const byType = await this.db
      .select({
        eventType: outbox.eventType,
        total: count(),
        pending: sql<number>`COUNT(*) FILTER (WHERE ${outbox.processedAt} IS NULL AND ${outbox.lastError} IS NULL)`,
        processed: sql<number>`COUNT(*) FILTER (WHERE ${outbox.processedAt} IS NOT NULL)`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${outbox.lastError} IS NOT NULL)`,
      })
      .from(outbox)
      .groupBy(outbox.eventType)
      .orderBy(outbox.eventType);

    // Recent events (most recent first)
    const recentEvents = await this.db
      .select({
        outboxId: outbox.outboxId,
        aggregateType: outbox.aggregateType,
        aggregateId: outbox.aggregateId,
        eventType: outbox.eventType,
        payload: outbox.payload,
        createdOn: outbox.createdOn,
        processedAt: outbox.processedAt,
        lastError: outbox.lastError,
      })
      .from(outbox)
      .orderBy(desc(outbox.createdOn))
      .limit(limit);

    return {
      summary: {
        pending: pendingResult.count,
        processed: processedResult.count,
        failed: failedResult.count,
        total: pendingResult.count + processedResult.count + failedResult.count,
      },
      byType,
      recentEvents,
    };
  }

  /**
   * Returns outbox events for a specific event type (pending only by default).
   */
  @Get('events')
  @CasbinAction('read')
  async getEventsByType(
    @Query('type') eventType: string,
    @Query('status') status?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(parseInt(limitStr || '50', 10), 200);

    const conditions = [eq(outbox.eventType, eventType)];
    if (status === 'processed') {
      conditions.push(isNotNull(outbox.processedAt));
    } else if (status === 'failed') {
      conditions.push(isNotNull(outbox.lastError));
    } else {
      // default: pending only
      conditions.push(isNull(outbox.processedAt));
      conditions.push(isNull(outbox.lastError));
    }

    const events = await this.db
      .select({
        outboxId: outbox.outboxId,
        aggregateType: outbox.aggregateType,
        aggregateId: outbox.aggregateId,
        eventType: outbox.eventType,
        payload: outbox.payload,
        createdOn: outbox.createdOn,
        processedAt: outbox.processedAt,
        lastError: outbox.lastError,
      })
      .from(outbox)
      .where(and(...conditions))
      .orderBy(desc(outbox.createdOn))
      .limit(limit);

    return { events, total: events.length };
  }

  /**
   * Clears (deletes) all outbox events of a given type.
   * Affects only pending events by default; pass status=all to delete everything.
   */
  @Delete('events')
  @CasbinAction('write')
  async clearEventsByType(
    @Query('type') eventType: string,
    @Query('status') status?: string,
  ) {
    const conditions = [eq(outbox.eventType, eventType)];
    if (status === 'failed') {
      conditions.push(isNotNull(outbox.lastError));
    } else if (status !== 'all') {
      // Default: only clear pending events
      conditions.push(isNull(outbox.processedAt));
      conditions.push(isNull(outbox.lastError));
    }

    const result = await this.db
      .delete(outbox)
      .where(and(...conditions))
      .returning({ id: outbox.outboxId });

    return { deleted: result.length, eventType };
  }
}
