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

@Injectable()
export class TradingTermsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    const records = await this.db
      .select()
      .from(tradingTerms)
      .orderBy(tradingTerms.code);
    return records.map((r) => ({
      tradingTermsId: r.tradingTermsId,
      code: r.code,
      description: r.description,
      days: r.days,
      type: r.type,
    }));
  }

  // @herobm-skip-audit
  async create(dto: CreateTradingTermDto) {
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
      return {
        tradingTermsId: record.tradingTermsId,
        code: record.code,
        description: record.description,
        days: record.days,
        type: record.type,
      };
    });
  }

  // @herobm-skip-audit
  async update(id: string, dto: UpdateTradingTermDto) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .update(tradingTerms)
        .set(dto)
        .where(eq(tradingTerms.tradingTermsId, id))
        .returning();

      if (!record) throw new NotFoundException('Trading term not found');

      return {
        tradingTermsId: record.tradingTermsId,
        code: record.code,
        description: record.description,
        days: record.days,
        type: record.type,
      };
    });
  }

  // @herobm-skip-audit
  async delete(id: string) {
    const [record] = await this.db
      .delete(tradingTerms)
      .where(eq(tradingTerms.tradingTermsId, id))
      .returning();
    if (!record) throw new NotFoundException('Trading term not found');
    return { success: true };
  }
}
