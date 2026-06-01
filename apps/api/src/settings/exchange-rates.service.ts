import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { exchangeRates } from '../drizzle/modbm-core-schema';
import { CreateExchangeRateDto, UpdateExchangeRateDto } from './dto';

@Injectable()
export class ExchangeRatesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db
      .select()
      .from(exchangeRates)
      .orderBy(exchangeRates.currencyCode);
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.exchangeRateId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Exchange rate with ID '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateExchangeRateDto) {
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
    try {
      const rows = await this.db
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
      return rows[0];
    } catch (err: unknown) {
      if ((err as any)?.code === '23505') {
        throw new BadRequestException(
          `Exchange rate for currency '${dto.currencyCode}' already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateExchangeRateDto) {
    await this.findOne(id);

    const rows = await this.db
      .update(exchangeRates)
      .set({
        ...(dto.currencyName !== undefined && {
          currencyName: dto.currencyName.trim(),
        }),
        ...(dto.buyRate !== undefined && { buyRate: dto.buyRate }),
        ...(dto.sellRate !== undefined && { sellRate: dto.sellRate }),
        ...(dto.effectiveDate !== undefined && {
          effectiveDate: new Date(dto.effectiveDate),
        }),
        updatedOn: new Date(),
      })
      .where(eq(exchangeRates.exchangeRateId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.db
      .delete(exchangeRates)
      .where(eq(exchangeRates.exchangeRateId, id));
    return { deleted: true };
  }
}
