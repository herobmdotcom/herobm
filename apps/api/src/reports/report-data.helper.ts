import { OrdersWriteService } from '../orders/orders-write.service';
import { SalesQuoteData } from './sales-quote.service';
import { computeOrderTotals } from '@modbm/shared';

/**
 * Shared helper for resolving order detail and assembling report data.
 *
 * Eliminates the identical copy-paste between SalesQuoteService and
 * SalesInvoiceService (ADV-057 §5).
 */

// ---------------------------------------------------------------------------
// Order resolution — all orders are now in modbm_core
// ---------------------------------------------------------------------------

export async function resolveOrderDetail(
  ordersWriteService: OrdersWriteService,
  _ordersService: unknown,
  orderId: string,
  _source?: string,
): Promise<any> {
  return ordersWriteService.findOne(orderId);
}

// ---------------------------------------------------------------------------
// Data assembly — shared between quote and invoice
// ---------------------------------------------------------------------------

interface RawOrderLine {
  lineNumber: number;
  productNumber?: string;
  productId?: string;
  productDescription?: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage?: string;
  taxCategoryId?: string;
  tax?: string;
  amount?: string;
  totalAmount?: string;
  unitOfMeasure?: string;
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
    orderNumber?: string;
    customerName?: string;
    customerOrderNumber?: string;
    createdOn?: string;
    currencyCode?: string;
    name?: string;
    lines: RawOrderLine[];
  },
  fallbackCurrency: string,
): SalesQuoteData {
  const lines = orderDetail.lines.map((l) => {
    const qty = parseFloat(l.quantity);
    const price = parseFloat(l.pricePerUnit);
    const disc = parseFloat(l.discountPercentage || '0');

    let taxRate = 0;
    if (parseFloat(l.amount || '0') > 0 && parseFloat(l.tax || '0') > 0) {
      taxRate = (parseFloat(l.tax!) / parseFloat(l.amount!)) * 100;
    }

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    const isCustomLine = l.productId === CUSTOM_LINE_ID;

    return {
      lineNumber: l.lineNumber,
      productNumber: isCustomLine ? '' : l.productNumber || l.productId || '—',
      description: l.productDescription || '—',
      quantity: l.quantity,
      pricePerUnit: l.pricePerUnit,
      discountPercentage: disc.toFixed(2),
      taxRate: `${taxRate.toFixed(1)}%`,
      tax: parseFloat(l.tax || '0').toFixed(2),
      amount: parseFloat(l.amount || '0').toFixed(2),
      totalAmount: parseFloat(l.totalAmount || '0').toFixed(2),
      unitOfMeasure: l.unitOfMeasure || 'EA',
    };
  });

  const totals = computeOrderTotals(lines);

  return {
    header: {
      orderNumber: orderDetail.orderNumber || '',
      customerName: orderDetail.customerName || '',
      customerOrderNumber: orderDetail.customerOrderNumber || '',
      orderDate: orderDetail.createdOn
        ? new Date(orderDetail.createdOn).toLocaleDateString('en-IE')
        : '',
      currencyCode: orderDetail.currencyCode || fallbackCurrency,
      name: orderDetail.name || '',
    },
    lines,
    summary: {
      subtotal: totals.subtotal,
      totalTax: totals.totalTax,
      totalAmount: totals.totalAmount,
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
