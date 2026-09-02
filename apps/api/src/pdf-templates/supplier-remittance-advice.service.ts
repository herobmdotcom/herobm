import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  purchaseInvoices,
  suppliers,
  actors,
  glSettings,
} from '@herobm/db-schema';

export interface SupplierRemittanceAdviceData {
  header: {
    paymentId: string;
    paymentNumber: string;
    paymentDate: string;
    modeOfPayment: string;
    referenceNumber: string;
    currencyCode: string;
    state: string;
    supplierId: string;
    supplierNumber: string;
    supplierName: string;
    supplierAddress: string;
    supplierContact: string;
  };
  lines: Array<{
    invoiceDate: string;
    invoiceNumber: string;
    supplierInvoiceNumber: string;
    dueDate: string;
    grossAmount: string;
    discountAmount: string;
    allocatedAmount: string;
  }>;
  summary: {
    totalGross: string;
    totalDiscount: string;
    totalPaid: string;
    unallocatedAmount: string;
  };
  customPdfText?: string;
  quoteIntroText?: string;
  generatedAt: string;
}

@Injectable()
export class SupplierRemittanceAdviceService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly logger = new Logger(SupplierRemittanceAdviceService.name);

  async assembleData(
    paymentId: string,
    options?: Record<string, unknown>,
  ): Promise<SupplierRemittanceAdviceData> {
    // 1. Fetch Payment Entry
    const [pmt] = await this.db
      .select({
        paymentId: paymentEntries.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentType: paymentEntries.paymentType,
        partyId: paymentEntries.partyId,
        paymentDate: paymentEntries.paymentDate,
        modeOfPayment: paymentEntries.modeOfPayment,
        totalAmount: paymentEntries.totalAmount,
        unallocatedAmount: paymentEntries.unallocatedAmount,
        currencyCode: paymentEntries.currencyCode,
        referenceNumber: paymentEntries.referenceNumber,
        stateCode: paymentEntries.stateCode,
        createdOn: paymentEntries.createdOn,
      })
      .from(paymentEntries)
      .where(eq(paymentEntries.paymentId, paymentId))
      .limit(1);

    if (!pmt) {
      throw new NotFoundException(`Payment '${paymentId}' not found`);
    }

    const [gl] = await this.db
      .select({ baseCurrency: glSettings.baseCurrency })
      .from(glSettings)
      .limit(1);
    const baseCurrency = gl?.baseCurrency || 'AUD';

    // 2. Fetch Supplier & Actor details if partyId is present
    let supplierDetails: {
      supplierId: string;
      supplierNumber: string;
      supplierName: string;
      supplierAddress: string;
    } = {
      supplierId: pmt.partyId || '',
      supplierNumber: '',
      supplierName: '—',
      supplierAddress: '',
    };

    if (pmt.partyId) {
      const [supp] = await this.db
        .select({
          vendorId: suppliers.vendorId,
          vendorNumber: suppliers.vendorNumber,
          name: actors.name,
          headquartersAddressLine1: actors.headquartersAddressLine1,
          city: actors.headquartersCity,
          stateOrProvince: actors.headquartersStateOrProvince,
          postalCode: actors.headquartersPostalCode,
          country: actors.headquartersCountry,
        })
        .from(suppliers)
        .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
        .where(eq(suppliers.vendorId, pmt.partyId))
        .limit(1);

      if (supp) {
        const addressParts = [
          supp.headquartersAddressLine1,
          supp.city,
          supp.stateOrProvince,
          supp.postalCode,
          supp.country,
        ].filter(Boolean);

        supplierDetails = {
          supplierId: supp.vendorId,
          supplierNumber: supp.vendorNumber || '',
          supplierName: supp.name || '—',
          supplierAddress: addressParts.join(', '),
        };
      }
    }

    // 3. Fetch Allocations linked to Purchase Invoices
    const allocations = await this.db
      .select({
        allocationId: paymentAllocations.allocationId,
        referenceType: paymentAllocations.referenceType,
        referenceId: paymentAllocations.referenceId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        discountAmount: paymentAllocations.discountAmount,
        invoiceNumber: purchaseInvoices.invoiceNumber,
        supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        invoiceDate: purchaseInvoices.invoiceDate,
        dueDate: purchaseInvoices.dueDate,
        totalAmount: purchaseInvoices.totalAmount,
      })
      .from(paymentAllocations)
      .leftJoin(
        purchaseInvoices,
        eq(paymentAllocations.referenceId, purchaseInvoices.invoiceId),
      )
      .where(eq(paymentAllocations.paymentId, paymentId))
      .orderBy(asc(purchaseInvoices.invoiceDate));

    let totalGross = 0;
    let totalDiscount = 0;

    const lines = allocations.map((alloc) => {
      const gross = alloc.totalAmount
        ? parseFloat(alloc.totalAmount)
        : parseFloat(alloc.allocatedAmount || '0');
      const discount = alloc.discountAmount
        ? parseFloat(alloc.discountAmount)
        : 0;
      const allocated = parseFloat(alloc.allocatedAmount || '0');

      totalGross += gross;
      totalDiscount += discount;

      const invDateStr = alloc.invoiceDate
        ? new Date(alloc.invoiceDate).toLocaleDateString('en-IE')
        : '—';
      const dueDateStr = alloc.dueDate
        ? new Date(alloc.dueDate).toLocaleDateString('en-IE')
        : '—';

      return {
        invoiceDate: invDateStr,
        invoiceNumber: alloc.invoiceNumber || '—',
        supplierInvoiceNumber: alloc.supplierInvoiceNumber || '—',
        dueDate: dueDateStr,
        grossAmount: gross.toFixed(2),
        discountAmount: discount > 0 ? discount.toFixed(2) : '0.00',
        allocatedAmount: allocated.toFixed(2),
      };
    });

    const totalPaid = parseFloat(pmt.totalAmount || '0');
    const unallocated = parseFloat(pmt.unallocatedAmount || '0');
    const now = new Date();

    const pmtDateStr = pmt.paymentDate
      ? new Date(pmt.paymentDate).toLocaleDateString('en-IE')
      : now.toLocaleDateString('en-IE');

    const customText =
      (options?.customPdfText as string) || (options?.quoteIntroText as string);

    return {
      header: {
        paymentId: pmt.paymentId,
        paymentNumber: pmt.paymentNumber,
        paymentDate: pmtDateStr,
        modeOfPayment: pmt.modeOfPayment || 'EFT',
        referenceNumber: pmt.referenceNumber || '',
        currencyCode: pmt.currencyCode || baseCurrency,
        state: pmt.stateCode,
        supplierId: supplierDetails.supplierId,
        supplierNumber: supplierDetails.supplierNumber,
        supplierName: supplierDetails.supplierName,
        supplierAddress: supplierDetails.supplierAddress,
        supplierContact: '',
      },
      lines,
      summary: {
        totalGross: totalGross.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        unallocatedAmount: unallocated.toFixed(2),
      },
      customPdfText: customText || undefined,
      quoteIntroText: customText || undefined,
      generatedAt: now.toISOString().replace('T', ' ').substring(0, 19),
    };
  }
}
