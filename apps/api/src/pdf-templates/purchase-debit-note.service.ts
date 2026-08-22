import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  suppliers,
  actors,
  products,
} from '@herobm/db-schema';

export interface PurchaseDebitNoteData {
  header: {
    debitNoteNumber: string;
    debitNoteDate: string;
    state: string;
    supplierReference: string;
    orderNumber: string;
    returnNumber: string;
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
    pricePerUnit: string;
    tax: string;
    amount: string;
  }>;
  summary: {
    subtotal: string;
    totalTax: string;
    feeAmount: string;
    totalAmount: string;
  };
  customPdfText?: string;
  quoteIntroText?: string;
  generatedAt: string;
}

@Injectable()
export class PurchaseDebitNoteService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly logger = new Logger(PurchaseDebitNoteService.name);

  async assembleData(
    debitNoteId: string,
    options?: Record<string, unknown>,
  ): Promise<PurchaseDebitNoteData> {
    const [dn] = await this.db
      .select({
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        stateCode: purchaseDebitNotes.stateCode,
        supplierReferenceNumber: purchaseDebitNotes.supplierReferenceNumber,
        totalAmount: purchaseDebitNotes.totalAmount,
        taxAmount: purchaseDebitNotes.taxAmount,
        feeAmount: purchaseDebitNotes.feeAmount,
        currencyCode: purchaseDebitNotes.currencyCode,
        notes: purchaseDebitNotes.notes,
        createdOn: purchaseDebitNotes.createdOn,
        purchaseOrderId: purchaseDebitNotes.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        returnId: purchaseDebitNotes.returnId,
        returnNumber: purchaseOrderReturns.returnNumber,
        vendorId: purchaseDebitNotes.vendorId,
        vendorName: actors.name,
        headquartersAddressLine1: actors.headquartersAddressLine1,
        city: actors.headquartersCity,
        stateOrProvince: actors.headquartersStateOrProvince,
        postalCode: actors.headquartersPostalCode,
        country: actors.headquartersCountry,
      })
      .from(purchaseDebitNotes)
      .leftJoin(
        purchaseOrders,
        eq(purchaseDebitNotes.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(
        purchaseOrderReturns,
        eq(purchaseDebitNotes.returnId, purchaseOrderReturns.returnId),
      )
      .leftJoin(suppliers, eq(purchaseDebitNotes.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
      .limit(1);

    if (!dn) {
      throw new NotFoundException(
        `Purchase debit note '${debitNoteId}' not found`,
      );
    }

    const debitNoteLines = await this.db
      .select({
        debitNoteLineId: purchaseDebitNoteLines.debitNoteLineId,
        quantityInvoiced: purchaseDebitNoteLines.quantityInvoiced,
        pricePerUnit: purchaseDebitNoteLines.pricePerUnit,
        amount: purchaseDebitNoteLines.amount,
        taxAmount: purchaseDebitNoteLines.taxAmount,
        description: purchaseDebitNoteLines.description,
        productNumber: products.productNumber,
        productName: products.name,
        lineDescription: purchaseOrderLineItems.productDescription,
      })
      .from(purchaseDebitNoteLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseDebitNoteLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .where(eq(purchaseDebitNoteLines.debitNoteId, debitNoteId));

    let subtotal = 0;
    let totalTax = 0;
    const lines = debitNoteLines.map((l, index) => {
      const qty = parseFloat(l.quantityInvoiced || '0');
      const unitPrice = parseFloat(l.pricePerUnit || '0');
      const lineAmt = parseFloat(l.amount || (qty * unitPrice).toString());
      const lineTax = parseFloat(l.taxAmount || '0');

      subtotal += lineAmt;
      totalTax += lineTax;

      return {
        lineNumber: index + 1,
        productNumber: l.productNumber || '—',
        description: l.description || l.lineDescription || l.productName || '—',
        quantity: qty.toFixed(2),
        pricePerUnit: unitPrice.toFixed(2),
        tax: lineTax.toFixed(2),
        amount: lineAmt.toFixed(2),
      };
    });

    const totalAmount = parseFloat(
      dn.totalAmount?.toString() || (subtotal + totalTax).toString(),
    );
    const feeAmount = parseFloat(dn.feeAmount?.toString() || '0');

    const supplierAddressParts = [
      dn.headquartersAddressLine1,
      dn.city,
      dn.stateOrProvince,
      dn.postalCode,
      dn.country,
    ].filter(Boolean);

    const customText =
      (options?.customPdfText as string) || (options?.quoteIntroText as string);

    const debitNoteDateStr = dn.createdOn
      ? new Date(dn.createdOn).toLocaleDateString('en-IE')
      : new Date().toLocaleDateString('en-IE');

    return {
      header: {
        debitNoteNumber: dn.debitNoteNumber,
        debitNoteDate: debitNoteDateStr,
        state: dn.stateCode,
        supplierReference: dn.supplierReferenceNumber || '',
        orderNumber: dn.orderNumber || '',
        returnNumber: dn.returnNumber || '',
        currencyCode: dn.currencyCode || 'USD',
        supplierName: dn.vendorName || '—',
        supplierAddress: supplierAddressParts.join(', '),
        supplierContact: '',
        notes: dn.notes || '',
      },
      lines,
      summary: {
        subtotal: subtotal.toFixed(2),
        totalTax: parseFloat(
          dn.taxAmount?.toString() || totalTax.toString(),
        ).toFixed(2),
        feeAmount: feeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      },
      customPdfText: customText || undefined,
      quoteIntroText: customText || undefined,
      generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
  }
}
