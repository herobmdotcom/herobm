import { OrdersWriteService } from '../orders/orders-write.service';
import { SalesQuoteData } from './sales-quote.service';
import { computeLinePrice } from '@modbm/shared';

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
  gstCategoryId?: string;
  tax?: string;
  amount?: string;
  totalAmount?: string;
  unitOfMeasure?: string;
}

/**
 * Assemble the JSON data structure consumed by Typst report templates.
 *
 * When `gstRateMap` is provided (gstCategoryId → rate%), pricing is
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
  gstRateMap?: Map<string, number>,
): SalesQuoteData {
  const lines = orderDetail.lines.map((l) => {
    const qty = parseFloat(l.quantity);
    const price = parseFloat(l.pricePerUnit);
    const disc = parseFloat(l.discountPercentage || '0');

    // Resolve GST rate from the map, or reverse-engineer from stored values
    let taxRate = 0;
    if (gstRateMap && l.gstCategoryId) {
      taxRate = gstRateMap.get(l.gstCategoryId) ?? 0;
    } else if (
      parseFloat(l.amount || '0') > 0 &&
      parseFloat(l.tax || '0') > 0
    ) {
      taxRate = (parseFloat(l.tax!) / parseFloat(l.amount!)) * 100;
    }

    // Compute pricing via the shared function when we have GST data
    const pricing = gstRateMap
      ? computeLinePrice({
          quantity: qty,
          pricePerUnit: price,
          discountPercentage: disc,
          taxRate,
        })
      : {
          amount: parseFloat(l.amount || '0'),
          tax: parseFloat(l.tax || '0'),
          totalAmount: parseFloat(l.totalAmount || '0'),
        };

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    const isCustomLine = l.productId === CUSTOM_LINE_ID;

    return {
      lineNumber: l.lineNumber,
      productNumber: isCustomLine ? '' : l.productNumber || l.productId || '—',
      description: l.productDescription || '—',
      quantity: l.quantity,
      pricePerUnit: l.pricePerUnit,
      discountPercentage: l.discountPercentage || '0',
      gstRate: `${taxRate.toFixed(1)}%`,
      tax: pricing.tax.toFixed(2),
      amount: pricing.amount.toFixed(2),
      totalAmount: pricing.totalAmount.toFixed(2),
      unitOfMeasure: l.unitOfMeasure || 'EA',
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.amount), 0);
  const totalTax = lines.reduce((sum, l) => sum + parseFloat(l.tax), 0);
  const totalAmount = lines.reduce(
    (sum, l) => sum + parseFloat(l.totalAmount),
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
