import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturnShipments,
  suppliers,
  actors,
  products,
} from '@herobm/db-schema';

export interface PurchaseReturnSlipData {
  header: {
    returnNumber: string;
    returnDate: string;
    state: string;
    orderNumber: string;
    packingSlipNumber: string;
    trackingNumber: string;
    currencyCode: string;
    supplierName: string;
    supplierAddress: string;
    supplierContact: string;
    notes: string;
  };
  lines: Array<{
    lineNumber: number;
    productNumber: string;
    description: string;
    quantity: string;
    uom: string;
    reason: string;
    pricePerUnit: string;
    amount: string;
  }>;
  summary: {
    subtotal: string;
    totalAmount: string;
  };
  customPdfText?: string;
  quoteIntroText?: string;
  generatedAt: string;
}

@Injectable()
export class PurchaseReturnSlipService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly logger = new Logger(PurchaseReturnSlipService.name);

  async assembleData(
    returnId: string,
    options?: Record<string, unknown>,
  ): Promise<PurchaseReturnSlipData> {
    const [ret] = await this.db
      .select({
        returnId: purchaseOrderReturns.returnId,
        returnNumber: purchaseOrderReturns.returnNumber,
        stateCode: purchaseOrderReturns.stateCode,
        notes: purchaseOrderReturns.notes,
        createdOn: purchaseOrderReturns.createdOn,
        purchaseOrderId: purchaseOrderReturns.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        currencyCode: purchaseOrders.currencyCode,
        vendorId: purchaseOrders.vendorId,
        vendorName: actors.name,
        headquartersAddressLine1: actors.headquartersAddressLine1,
        city: actors.headquartersCity,
        stateOrProvince: actors.headquartersStateOrProvince,
        postalCode: actors.headquartersPostalCode,
        country: actors.headquartersCountry,
      })
      .from(purchaseOrderReturns)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReturns.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(suppliers, eq(purchaseOrders.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) {
      throw new NotFoundException(`Purchase return '${returnId}' not found`);
    }

    const returnLines = await this.db
      .select({
        returnLineId: purchaseOrderReturnLines.returnLineId,
        quantityReturned: purchaseOrderReturnLines.quantityReturned,
        reason: purchaseOrderReturnLines.reason,
        returnFee: purchaseOrderReturnLines.returnFee,
        productNumber: products.productNumber,
        productName: products.name,
        baseUom: products.baseUom,
        lineDescription: purchaseOrderLineItems.productDescription,
        pricePerUnit: purchaseOrderLineItems.pricePerUnit,
      })
      .from(purchaseOrderReturnLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseOrderReturnLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .where(eq(purchaseOrderReturnLines.returnId, returnId));

    const [shipment] = await this.db
      .select({
        shipmentNumber: purchaseOrderReturnShipments.shipmentNumber,
        trackingNumber: purchaseOrderReturnShipments.trackingNumber,
      })
      .from(purchaseOrderReturnShipments)
      .where(eq(purchaseOrderReturnShipments.returnId, returnId))
      .limit(1);

    let subtotal = 0;
    const lines = returnLines.map((l, index) => {
      const qty = parseFloat(l.quantityReturned || '0');
      const unitPrice = parseFloat(l.pricePerUnit || '0');
      const amount = qty * unitPrice;
      subtotal += amount;

      return {
        lineNumber: index + 1,
        productNumber: l.productNumber || '—',
        description: l.lineDescription || l.productName || '—',
        quantity: qty.toFixed(2),
        uom: l.baseUom || 'EA',
        reason: l.reason || '',
        pricePerUnit: unitPrice.toFixed(2),
        amount: amount.toFixed(2),
      };
    });

    const supplierAddressParts = [
      ret.headquartersAddressLine1,
      ret.city,
      ret.stateOrProvince,
      ret.postalCode,
      ret.country,
    ].filter(Boolean);

    const customText =
      (options?.customPdfText as string) || (options?.quoteIntroText as string);

    const returnDateStr = ret.createdOn
      ? new Date(ret.createdOn).toLocaleDateString('en-IE')
      : new Date().toLocaleDateString('en-IE');

    return {
      header: {
        returnNumber: ret.returnNumber,
        returnDate: returnDateStr,
        state: ret.stateCode,
        orderNumber: ret.orderNumber || '—',
        packingSlipNumber: shipment?.shipmentNumber || '',
        trackingNumber: shipment?.trackingNumber || '',
        currencyCode: ret.currencyCode || 'USD',
        supplierName: ret.vendorName || '—',
        supplierAddress: supplierAddressParts.join(', '),
        supplierContact: '',
        notes: ret.notes || '',
      },
      lines,
      summary: {
        subtotal: subtotal.toFixed(2),
        totalAmount: subtotal.toFixed(2),
      },
      customPdfText: customText || undefined,
      quoteIntroText: customText || undefined,
      generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
  }
}
