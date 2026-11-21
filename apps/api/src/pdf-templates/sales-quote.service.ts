import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { AppConfigService } from '../settings/app-config.service';
import { RunHookOptionsDto } from './dto';
import { assembleOrderData, resolveOrderDetail } from './report-data.helper';

export interface SalesQuoteData {
  header: {
    orderNumber?: string;
    projectNumber?: string;
    customerName: string;
    customerAddress?: string;
    billingAddress?: string;
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
  customPdfText?: string;
  quoteIntroText?: string;
  invoiceMeta?: {
    invoiceNumber?: string;
    dueDate?: string | null;
    sequenceNumber?: number;
    totalInvoices?: number;
    orderTotal?: number;
  };
}

@Injectable()
export class SalesQuoteService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersQueryService: OrdersQueryService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(SalesQuoteService.name);

  async assembleData(
    orderId: string,
    source?: string,
    options?: RunHookOptionsDto & Record<string, unknown>,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersQueryService,
      this.ordersService,
      orderId,
      source,
    );
    const data = assembleOrderData(orderDetail, this.appConfig.homeCurrency());

    this.logger.log(
      'SalesQuoteService options received: ' + JSON.stringify(options),
    );
    const customText = options?.customPdfText || options?.quoteIntroText;
    if (customText) {
      this.logger.log('Macro text received: ' + customText);
      data.customPdfText = customText;
      data.quoteIntroText = customText;
    }

    return data;
  }
}
