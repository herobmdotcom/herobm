import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  accounts,
  products,
  inventory,
  salesOrderLines,
} from '../drizzle/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getSummary() {
    const [accountCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts);

    const [productCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(products);

    const [inventoryCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventory);

    const [orderLineCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesOrderLines);

    return {
      accounts: accountCount.count,
      products: productCount.count,
      inventoryLevels: inventoryCount.count,
      orderLines: orderLineCount.count,
    };
  }
}
