import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReportService } from './report.service';
import { SalesQuoteData } from './sales-quote.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';

const TEMPLATE_PATH = join(
  __dirname,
  'templates',
  'orders',
  'sales-invoice.typ',
);

@Injectable()
export class SalesInvoiceService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    private readonly reportService: ReportService,
  ) {}

  private readonly logger = new Logger(SalesInvoiceService.name);

  async generateSalesInvoice(
    orderId: string,
    source?: string,
  ): Promise<{ pdf: Buffer; orderNumber: string }> {
    const data = await this.assembleData(orderId, source);
    const pdf = await this.reportService.compilePdf(TEMPLATE_PATH, data);

    this.logger.log(
      `Generated sales invoice for order ${data.header.orderNumber} (${source || 'default'})`,
    );

    return { pdf, orderNumber: data.header.orderNumber };
  }

  private async assembleData(
    orderId: string,
    source?: string,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersWriteService,
      this.ordersService,
      orderId,
      source,
    );
    return assembleOrderData(orderDetail);
  }
}
