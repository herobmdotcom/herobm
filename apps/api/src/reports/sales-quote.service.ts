import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReportService } from './report.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';

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

const TEMPLATE_PATH = join(__dirname, 'templates', 'orders', 'sales-quote.typ');

@Injectable()
export class SalesQuoteService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    private readonly reportService: ReportService,
  ) {}

  private readonly logger = new Logger(SalesQuoteService.name);

  async generateSalesQuote(
    orderId: string,
    source?: string,
  ): Promise<{ pdf: Buffer; orderNumber: string }> {
    const data = await this.assembleData(orderId, source);
    const pdf = await this.reportService.compilePdf(TEMPLATE_PATH, data);

    this.logger.log(
      `Generated sales quote for order ${data.header.orderNumber} (${source || 'default'})`,
    );

    return { pdf, orderNumber: data.header.orderNumber };
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
    return assembleOrderData(orderDetail);
  }
}
