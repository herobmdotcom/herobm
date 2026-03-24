import { Injectable, Inject, Logger } from '@nestjs/common';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { gstCategories } from '../drizzle/modbm-core-schema';

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
    gstRate: string;
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

  /** Build a gstCategoryId → rate% map from the gst_categories table. */
  private async buildGstRateMap(): Promise<Map<string, number>> {
    const rows = await this.db.select().from(gstCategories);
    return new Map(
      rows.map((r) => [r.gstCategoryId, parseFloat(r.rate ?? '0')]),
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
    const gstRateMap = await this.buildGstRateMap();
    return assembleOrderData(orderDetail, gstRateMap);
  }
}
