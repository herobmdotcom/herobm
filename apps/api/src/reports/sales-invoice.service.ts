import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReportService } from './report.service';
import { SalesQuoteData } from './sales-quote.service';

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

  /**
   * Identical data assembly to SalesQuoteService for now.
   * In a future iteration, we might want to extract this to a shared helper.
   */
  private async assembleData(
    orderId: string,
    source?: string,
  ): Promise<SalesQuoteData> {
    let orderDetail: any;

    if (source === 'app') {
      orderDetail = await this.ordersWriteService.findOne(orderId);
    } else if (source === 'abm') {
      orderDetail = await this.ordersService.findAbmOrder(orderId);
    } else {
      try {
        orderDetail = await this.ordersWriteService.findOne(orderId);
      } catch {
        orderDetail = await this.ordersService.findAbmOrder(orderId);
      }
    }

    const lines = orderDetail.lines.map((l: any) => {
      const amount = parseFloat(l.amount || '0');
      const tax = parseFloat(l.tax || '0');

      let gstRate = '0%';
      if (amount > 0 && tax > 0) {
        const rate = (tax / amount) * 100;
        gstRate = `${rate.toFixed(1)}%`;
      }

      return {
        lineNumber: l.lineNumber,
        productNumber: l.productNumber || l.productId || '—',
        description: l.productDescription || '—',
        quantity: l.quantity,
        pricePerUnit: l.pricePerUnit,
        discountPercentage: l.discountPercentage || '0',
        gstRate,
        tax: l.tax || '0.00',
        amount: l.amount || '0.00',
        totalAmount: l.totalAmount || '0.00',
        unitOfMeasure: l.unitOfMeasure || 'EA',
      };
    });

    const subtotal = lines.reduce(
      (sum: number, l: any) => sum + parseFloat(l.amount),
      0,
    );
    const totalTax = lines.reduce(
      (sum: number, l: any) => sum + parseFloat(l.tax),
      0,
    );
    const totalAmount = lines.reduce(
      (sum: number, l: any) => sum + parseFloat(l.totalAmount),
      0,
    );

    return {
      header: {
        orderNumber: orderDetail.orderNumber || '',
        customerName: orderDetail.customerName || '',
        customerOrderNumber: orderDetail.customerOrderNumber || '',
        orderDate: orderDetail.createdOn
          ? new Date(orderDetail.createdOn).toLocaleDateString('en-IE')
          : '',
        currencyCode: orderDetail.currencyCode || 'EUR',
        name: orderDetail.name || '',
      },
      lines,
      summary: {
        subtotal,
        totalTax,
        totalAmount,
      },
      generatedAt:
        new Date().toLocaleDateString('en-IE') +
        ' ' +
        new Date().toLocaleTimeString('en-IE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };
  }
}
