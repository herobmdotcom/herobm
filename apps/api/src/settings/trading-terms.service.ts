import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { tradingTerms } from '../drizzle/herobm-core-schema';
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
      id: r.tradingTermsId,
      code: r.code,
      description: r.description,
      days: r.days,
      type: r.type,
    }));
  }

  // @herobm-skip-audit
  async create(dto: CreateTradingTermDto) {
    return this.db.transaction(async (tx) => {
      try {
        const [record] = await tx
          .insert(tradingTerms)
          .values({
            code: dto.code,
            description: dto.description,
            days: dto.days,
            type: dto.type,
          })
          .returning();
        return {
          id: record.tradingTermsId,
          code: record.code,
          description: record.description,
          days: record.days,
          type: record.type,
        };
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '23505') {
          throw new BadRequestException(
            'A trading term with this code already exists.',
          );
        }
        throw e;
      }
    });
  }

  // @herobm-skip-audit
  async update(id: string, dto: UpdateTradingTermDto) {
    return this.db.transaction(async (tx) => {
      try {
        const [record] = await tx
          .update(tradingTerms)
          .set(dto)
          .where(eq(tradingTerms.tradingTermsId, id))
          .returning();

        if (!record) throw new NotFoundException('Trading term not found');

        return {
          id: record.tradingTermsId,
          code: record.code,
          description: record.description,
          days: record.days,
          type: record.type,
        };
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '23505') {
          throw new BadRequestException(
            'A trading term with this code already exists.',
          );
        }
        throw e;
      }
    });
  }

  // @herobm-skip-audit
  async delete(id: string) {
    try {
      const [record] = await this.db
        .delete(tradingTerms)
        .where(eq(tradingTerms.tradingTermsId, id))
        .returning();
      if (!record) throw new NotFoundException('Trading term not found');
      return { success: true };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23503') {
        throw new BadRequestException(
          'Cannot delete trading term because it is in use.',
        );
      }
      throw e;
    }
  }
}
