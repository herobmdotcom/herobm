import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { tradingTerms } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { CreateTradingTermDto, UpdateTradingTermDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class TradingTermsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    const records = await this.db
      .select()
      .from(tradingTerms)
      .orderBy(tradingTerms.code);
    return records
      .map((r) => ({
        tradingTermsId: r.tradingTermsId,
        code: r.code,
        description: r.description,
        days: r.days,
        type: r.type,
      }))
      .sort((a, b) =>
        a.code.localeCompare(b.code, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );
  }

  async create(dto: CreateTradingTermDto, actor: string = 'system') {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .insert(tradingTerms)
        .values({
          code: dto.code,
          description: dto.description,
          days: dto.days,
          type: dto.type,
          source: 'app',
          isActive: true,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: record.tradingTermsId,
        eventType: EventType.CREATED,
        entityDisplayName: `Trading Term: ${record.code}`,
        payload: dto,
        actor,
      });

      return {
        tradingTermsId: record.tradingTermsId,
        code: record.code,
        description: record.description,
        days: record.days,
        type: record.type,
      };
    });
  }

  async update(
    id: string,
    dto: UpdateTradingTermDto,
    actor: string = 'system',
  ) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .update(tradingTerms)
        .set(dto)
        .where(eq(tradingTerms.tradingTermsId, id))
        .returning();

      if (!record) throw new NotFoundException('Trading term not found');

      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: record.tradingTermsId,
        eventType: EventType.UPDATED,
        entityDisplayName: `Trading Term: ${record.code}`,
        payload: dto,
        actor,
      });

      return {
        tradingTermsId: record.tradingTermsId,
        code: record.code,
        description: record.description,
        days: record.days,
        type: record.type,
      };
    });
  }

  async delete(id: string, actor: string = 'system') {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .delete(tradingTerms)
        .where(eq(tradingTerms.tradingTermsId, id))
        .returning();
      if (!record) throw new NotFoundException('Trading term not found');

      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: `Trading Term: ${record.code}`,
        payload: { code: record.code },
        actor,
      });

      return { success: true };
    });
  }
}
