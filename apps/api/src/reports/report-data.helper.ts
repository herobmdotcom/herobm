import { OrdersService } from '../orders/orders.service';
import { OrdersWriteService } from '../orders/orders-write.service';
import { SalesQuoteData } from './sales-quote.service';

/**
 * Shared helper for resolving order detail and assembling report data.
 *
 * Eliminates the identical copy-paste between SalesQuoteService and
 * SalesInvoiceService (ADV-057 §5).
 */

// ---------------------------------------------------------------------------
// Order resolution — try app, fallback ABM
// ---------------------------------------------------------------------------

export async function resolveOrderDetail(
  ordersWriteService: OrdersWriteService,
  ordersService: OrdersService,
  orderId: string,
  source?: string,
): Promise<any> {
  if (source === 'app') {
    return ordersWriteService.findOne(orderId);
  }
  if (source === 'abm') {
    return ordersService.findAbmOrder(orderId);
  }
  // Default: try app, fallback abm
  try {
    return await ordersWriteService.findOne(orderId);
  } catch {
    return ordersService.findAbmOrder(orderId);
  }
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
  tax?: string;
  amount?: string;
  totalAmount?: string;
  unitOfMeasure?: string;
}

export function assembleOrderData(orderDetail: {
  orderNumber?: string;
  customerName?: string;
  customerOrderNumber?: string;
  createdOn?: string;
  currencyCode?: string;
  name?: string;
  lines: RawOrderLine[];
}): SalesQuoteData {
  const lines = orderDetail.lines.map((l) => {
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
