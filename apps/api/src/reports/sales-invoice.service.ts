import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { SalesQuoteData } from './sales-quote.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesInvoices,
  salesInvoiceLines,
  gstCategories,
} from '../drizzle/modbm-core-schema';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  private readonly logger = new Logger(SalesInvoiceService.name);

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
    invoiceId?: string,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersWriteService,
      this.ordersService,
      orderId,
      source,
    );

    const gstRateMap = await this.buildGstRateMap();

    if (!invoiceId) {
      return assembleOrderData(orderDetail, gstRateMap);
    }

    // Fetch the specific invoice and its lines
    const [invoice] = await this.db
      .select()
      .from(salesInvoices)
      .where(eq(salesInvoices.invoiceId, invoiceId));

    if (!invoice || invoice.salesOrderId !== orderId) {
      throw new NotFoundException(
        `Invoice ${invoiceId} not found for order ${orderId}`,
      );
    }

    const invLines = await this.db
      .select()
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.invoiceId, invoiceId));

    // Build a lookup: salesOrderLineId → invoiced quantity & price
    const invLineMap = new Map(
      invLines.map((il) => [
        il.salesOrderLineId,
        {
          quantity: il.quantityInvoiced,
          pricePerUnit: il.pricePerUnit,
        },
      ]),
    );

    // Filter order lines to only those present on this invoice, using invoiced quantities
    const filteredLines = orderDetail.lines
      .filter((l: any) => invLineMap.has(l.salesOrderLineId))
      .map((l: any) => {
        const inv = invLineMap.get(l.salesOrderLineId)!;
        return {
          ...l,
          quantity: inv.quantity,
          pricePerUnit: inv.pricePerUnit,
        };
      });

    return assembleOrderData(
      { ...orderDetail, lines: filteredLines },
      gstRateMap,
    );
  }
}
