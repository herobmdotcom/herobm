import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, lte, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { exchangeRates } from '@herobm/db-schema';
import { CreateExchangeRateDto, UpdateExchangeRateDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class ExchangeRatesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db
      .select()
      .from(exchangeRates)
      .orderBy(exchangeRates.currencyCode);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.exchangeRateId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Exchange rate with ID '${id}' not found`);
    }
    return rows[0];
  }

  async getRateForDate(currencyCode: string, date: Date, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.currencyCode, currencyCode),
          lte(exchangeRates.effectiveDate, date),
        ),
      )
      .orderBy(desc(exchangeRates.effectiveDate))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(
        `No exchange rate found for currency '${currencyCode}' on or before ${date.toISOString()}`,
      );
    }
    return rows[0];
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date,
    tx?: DrizzleDB,
  ): Promise<number> {
    if (fromCurrency === toCurrency) return 1.0;

    const fromRateRow = await this.getRateForDate(fromCurrency, date, tx);
    const toRateRow = await this.getRateForDate(toCurrency, date, tx);

    // Both rates are units per 1 EUR.
    // So 1 unit of fromCurrency = 1 / fromRateRow.buyRate EUR
    // Thus, fromCurrency in toCurrency = toRateRow.buyRate / fromRateRow.buyRate
    return parseFloat(toRateRow.buyRate) / parseFloat(fromRateRow.buyRate);
  }

  async create(dto: CreateExchangeRateDto, userId?: string) {
    if (
      !dto.currencyCode ||
      !dto.currencyName ||
      !dto.buyRate ||
      !dto.sellRate
    ) {
      throw new BadRequestException(
        'currencyCode, currencyName, buyRate, and sellRate are required',
      );
    }
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(exchangeRates)
        .values({
          currencyCode: dto.currencyCode.toUpperCase().trim(),
          currencyName: dto.currencyName.trim(),
          buyRate: dto.buyRate,
          sellRate: dto.sellRate,
          effectiveDate: dto.effectiveDate
            ? new Date(dto.effectiveDate)
            : new Date(),
          updatedOn: new Date(),
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.EXCHANGE_RATE,
        entityId: rows[0].exchangeRateId,
        eventType: EventType.CREATED,
        entityDisplayName: rows[0].currencyCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async update(id: string, dto: UpdateExchangeRateDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);

      if (dto.currencyName !== undefined) {
        dto.currencyName = dto.currencyName.trim();
      }
      if (dto.effectiveDate !== undefined) {
        dto.effectiveDate = new Date(dto.effectiveDate) as unknown as string;
      }

      const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

      if (audit.hasChanges) {
        const rows = await tx
          .update(exchangeRates)
          .set({
            ...audit.changes,
            updatedOn: new Date(),
          } as typeof exchangeRates.$inferInsert)
          .where(eq(exchangeRates.exchangeRateId, id))
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.EXCHANGE_RATE,
          entityId: rows[0].exchangeRateId,
          eventType: EventType.UPDATED,
          entityDisplayName: rows[0].currencyCode,
          payload: {
            changes: audit.changes,
            previous: audit.previousValues,
          },
          actor: userId,
        });

        return rows[0];
      }

      return existing;
    });
  }

  async delete(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const rate = await this.findOne(id, tx);
      await tx
        .delete(exchangeRates)
        .where(eq(exchangeRates.exchangeRateId, id));

      await emitEvent(tx, {
        entityType: EntityType.EXCHANGE_RATE,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: rate.currencyCode,
        payload: {},
        actor: userId,
      });

      return { deleted: true };
    });
  }
}
