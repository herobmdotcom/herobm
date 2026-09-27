import { OrdersQueryService } from '../orders/orders-query.service';
import { SalesQuoteData } from './sales-quote.service';
import {
  computeOrderTotals,
  LineType,
  formatReportDate,
  formatReportDateTime,
  toDecimal,
} from '@herobm/shared';

/**
 * Shared helper for resolving order detail and assembling report data.
 *
 * Eliminates the identical copy-paste between SalesQuoteService and
 * SalesInvoiceService (ADV-057 §5).
 */

// ---------------------------------------------------------------------------
// Order resolution — all orders are now in herobm_core
// ---------------------------------------------------------------------------

export async function resolveOrderDetail(
  ordersQueryService: OrdersQueryService,
  _ordersService: unknown,
  orderId: string,
  _source?: string,
): Promise<Awaited<ReturnType<OrdersQueryService['findOne']>>> {
  return ordersQueryService.findOne(orderId);
}

// ---------------------------------------------------------------------------
// Data assembly — shared between quote and invoice
// ---------------------------------------------------------------------------

interface RawOrderLine {
  lineNumber: number;
  productNumber?: string | null;
  productId?: string | null;
  productDescription?: string | null;
  quantity: string;
  pricePerUnit: string;
  discountPercentage?: string | null;
  taxCategoryId?: string | null;
  tax?: string | null;
  amount?: string | null;
  totalAmount?: string | null;
  unitOfMeasure?: string | null;
  lineType?: string | null;
}

/**
 * Assemble the JSON data structure consumed by Typst report templates.
 *
 * When `taxRateMap` is provided (taxCategoryId → rate%), pricing is
 * recomputed via the shared `computeLinePrice` function — guaranteeing
 * the PDF matches the frontend display exactly.
 *
 * When omitted (ABM legacy orders), the pre-stored DB values are used.
 */
export function assembleOrderData(
  orderDetail: {
    orderNumber?: string | null;
    projectNumber?: string | null;
    customerName?: string | null;
    customerOrderNumber?: string | null;
    createdOn?: string | Date | null;
    currencyCode?: string | null;
    name?: string | null;
    lines: RawOrderLine[];
  },
  fallbackCurrency: string,
): SalesQuoteData {
  const lines = orderDetail.lines.map((l) => {
    const qty = toDecimal(l.quantity).toNumber();
    const price = toDecimal(l.pricePerUnit).toNumber();
    const disc = toDecimal(l.discountPercentage).toNumber();

    let taxRate = 0;
    const lAmountDec = toDecimal(l.amount);
    const lTaxDec = toDecimal(l.tax);
    if (lAmountDec.greaterThan(0) && lTaxDec.greaterThan(0)) {
      taxRate = lTaxDec.div(lAmountDec).times(100).toNumber();
    }

    const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
    const isComment = l.lineType === (LineType.COMMENT as string);
    const isCustomLine = l.productId === CUSTOM_LINE_ID;

    return {
      lineNumber: l.lineNumber,
      productNumber: isComment
        ? ''
        : isCustomLine
          ? ''
          : l.productNumber || l.productId || '—',
      description: l.productDescription || '—',
      quantity: isComment ? '' : l.quantity,
      pricePerUnit: isComment ? '' : l.pricePerUnit,
      discountPercentage: isComment ? '' : disc.toFixed(2),
      taxRate: isComment ? '' : `${taxRate.toFixed(1)}%`,
      tax: isComment ? '' : parseFloat(l.tax || '0').toFixed(2),
      amount: isComment ? '' : parseFloat(l.amount || '0').toFixed(2),
      totalAmount: isComment ? '' : parseFloat(l.totalAmount || '0').toFixed(2),
      unitOfMeasure: isComment ? '' : l.unitOfMeasure || 'EA',
    };
  });

  const totals = computeOrderTotals(lines);

  return {
    header: {
      orderNumber: orderDetail.orderNumber || '',
      projectNumber: orderDetail.projectNumber || '',
      customerName: orderDetail.customerName || '',
      customerOrderNumber: orderDetail.customerOrderNumber || '',
      orderDate: formatReportDate(orderDetail.createdOn, undefined, ''),
      currencyCode: orderDetail.currencyCode || fallbackCurrency,
      name: orderDetail.name || '',
    },
    lines,
    summary: {
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      totalAmount: totals.totalAmount,
    },
    generatedAt: formatReportDateTime(new Date()),
  };
}
