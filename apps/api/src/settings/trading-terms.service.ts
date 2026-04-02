import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { tradingTerms } from '../drizzle/modbm-core-schema';

@Injectable()
export class TradingTermsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(tradingTerms).orderBy(tradingTerms.code);
  }
}
