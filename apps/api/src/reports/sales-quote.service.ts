import { Injectable, Inject, Logger } from '@nestjs/common';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { taxCategories } from '../drizzle/modbm-core-schema';

export interface SalesQuoteData {
  header: {
    orderNumber: string;
    customerName: string;
    customerOrderNumber: string;
    orderDate: string;
    currencyCode: string;
    name: string;
  };
  lines: Array<{
    lineNumber: number;
    productNumber: string;
    description: string;
    quantity: string;
    pricePerUnit: string;
    discountPercentage: string;
    taxRate: string;
    tax: string;
    amount: string;
    totalAmount: string;
    unitOfMeasure: string;
  }>;
  summary: {
    subtotal: number;
    totalTax: number;
    totalAmount: number;
  };
  generatedAt: string;
}

@Injectable()
export class SalesQuoteService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  private readonly logger = new Logger(SalesQuoteService.name);

  /** Build a taxCategoryId → rate% map from the tax_categories table. */
  private async buildtaxRateMap(): Promise<Map<string, number>> {
    const rows = await this.db.select().from(taxCategories);
    return new Map(
      rows.map((r) => [r.taxCategoryId, parseFloat(r.rate ?? '0')]),
    );
  }

  async assembleData(
    orderId: string,
    source?: string,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersWriteService,
      this.ordersService,
      orderId,
      source,
    );
    const taxRateMap = await this.buildtaxRateMap();
    return assembleOrderData(orderDetail, taxRateMap);
  }
}
