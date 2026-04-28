import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { eq, asc } from 'drizzle-orm';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { SalesQuoteData } from './sales-quote.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesInvoices,
  salesInvoiceLines,
  taxCategories,
} from '../drizzle/modbm-core-schema';
import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(SalesInvoiceService.name);

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
    invoiceId?: string,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersWriteService,
      this.ordersService,
      orderId,
      source,
    );

    const taxRateMap = await this.buildtaxRateMap();

    if (!invoiceId) {
      return assembleOrderData(
        orderDetail,
        this.appConfig.homeCurrency(),
        taxRateMap,
      );
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

    // Build the invoice-specific report data
    const invoiceData = assembleOrderData(
      { ...orderDetail, lines: filteredLines },
      this.appConfig.homeCurrency(),
      taxRateMap,
    );

    // Compute the full (unfiltered) order total for comparison
    const fullOrderData = assembleOrderData(
      orderDetail,
      this.appConfig.homeCurrency(),
      taxRateMap,
    );

    // Determine this invoice's ordinal position among all invoices for the order
    const allOrderInvoices = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
      })
      .from(salesInvoices)
      .where(eq(salesInvoices.salesOrderId, orderId))
      .orderBy(asc(salesInvoices.createdOn));

    const totalInvoices = allOrderInvoices.length;
    const sequenceNumber =
      allOrderInvoices.findIndex((i) => i.invoiceId === invoiceId) + 1;

    return {
      ...invoiceData,
      invoiceMeta: {
        invoiceNumber: invoice.invoiceNumber,
        sequenceNumber,
        totalInvoices,
        orderTotal: fullOrderData.summary.totalAmount,
      },
    } as SalesQuoteData;
  }
}
