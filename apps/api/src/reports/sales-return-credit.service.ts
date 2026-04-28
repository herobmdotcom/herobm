import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { ReturnsWriteService } from '../orders/returns-write.service';
import { resolveOrderDetail } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { taxCategories } from '../drizzle/modbm-core-schema';
import { computeLinePrice } from '@modbm/shared';
import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class SalesReturnCreditService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersWriteService: OrdersWriteService,
    private readonly returnsWriteService: ReturnsWriteService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(SalesReturnCreditService.name);

  private async buildtaxRateMap(): Promise<Map<string, number>> {
    const rows = await this.db.select().from(taxCategories);
    return new Map(
      rows.map((r) => [r.taxCategoryId, parseFloat(r.rate ?? '0')]),
    );
  }

  async assembleData(returnId: string, source?: string): Promise<any> {
    const ret = await this.returnsWriteService.findOne(returnId);
    if (!ret) {
      throw new NotFoundException(`Return ${returnId} not found`);
    }

    const orderDetail = await resolveOrderDetail(
      this.ordersWriteService,
      this.ordersService,
      ret.salesOrderId,
      source,
    );

    const taxRateMap = await this.buildtaxRateMap();

    // Map order lines by id
    const orderLineMap = new Map<string, any>(
      orderDetail.lines.map((l: any) => [l.salesOrderLineId, l]),
    );

    const lines = [];
    let subtotal = 0;
    let totalTax = 0;
    let totalCredit = 0;
    let totalFees = 0;

    for (const rl of ret.lines) {
      const orderLine = orderLineMap.get(rl.salesOrderLineId);
      if (!orderLine) continue;

      const qty = parseFloat(rl.quantityReturned || '0');
      const unitPrice = parseFloat(orderLine.pricePerUnit || '0');
      const disc = parseFloat(orderLine.discountPercentage || '0');
      const fee = parseFloat(rl.returnFee || '0');

      let taxRate = 0;
      if (orderLine.taxCategoryId && taxRateMap.has(orderLine.taxCategoryId)) {
        taxRate = taxRateMap.get(orderLine.taxCategoryId)!;
      } else if (
        parseFloat(orderLine.amount || '0') > 0 &&
        parseFloat(orderLine.tax || '0') > 0
      ) {
        taxRate =
          (parseFloat(orderLine.tax) / parseFloat(orderLine.amount)) * 100;
      }

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: unitPrice,
        discountPercentage: disc,
        taxRate,
      });

      subtotal += pricing.amount;
      totalTax += pricing.tax;
      totalCredit += pricing.totalAmount;
      totalFees += fee;

      const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
      const isCustomLine = orderLine.productId === CUSTOM_LINE_ID;

      lines.push({
        lineNumber: orderLine.lineNumber,
        productNumber: isCustomLine
          ? ''
          : orderLine.productNumber || orderLine.productId || '—',
        description: orderLine.productDescription || '—',
        quantity: rl.quantityReturned,
        pricePerUnit: orderLine.pricePerUnit,
        discountPercentage: parseFloat(
          orderLine.discountPercentage || '0',
        ).toFixed(2),
        taxRate: `${taxRate.toFixed(1)}%`,
        tax: pricing.tax.toFixed(2),
        reason: rl.reason || '',
        fee: fee.toFixed(2),
        amount: pricing.amount.toFixed(2),
        totalAmount: pricing.totalAmount.toFixed(2),
        unitOfMeasure: orderLine.unitOfMeasure || 'EA',
      });
    }

    return {
      header: {
        orderNumber: orderDetail.orderNumber || '',
        customerName: orderDetail.customerName || '',
        customerOrderNumber: orderDetail.customerOrderNumber || '',
        orderDate: orderDetail.createdOn
          ? new Date(orderDetail.createdOn).toLocaleDateString('en-IE')
          : '',
        currencyCode: orderDetail.currencyCode || this.appConfig.homeCurrency(),
        name: orderDetail.name || '',
      },
      returnMeta: {
        returnNumber: ret.returnNumber,
        state: ret.stateCode,
        notes: ret.notes || '',
      },
      lines,
      summary: {
        subtotal: subtotal.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        totalFees: totalFees.toFixed(2),
        netCredit: (totalCredit - totalFees).toFixed(2),
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
