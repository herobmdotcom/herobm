import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  customers,
  actors,
} from '@herobm/db-schema';

export interface CustomerPaymentReceiptData {
  header: {
    paymentId: string;
    paymentNumber: string;
    paymentDate: string;
    modeOfPayment: string;
    referenceNumber: string;
    currencyCode: string;
    state: string;
    customerId: string;
    customerNumber: string;
    customerName: string;
    customerAddress: string;
    customerContact: string;
  };
  lines: Array<{
    invoiceDate: string;
    invoiceNumber: string;
    customerOrderNumber: string;
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
export class CustomerPaymentReceiptService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private readonly logger = new Logger(CustomerPaymentReceiptService.name);

  async assembleData(
    paymentId: string,
    options?: Record<string, unknown>,
  ): Promise<CustomerPaymentReceiptData> {
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

    // 2. Fetch Customer & Actor details if partyId is present
    let customerDetails = {
      customerId: pmt.partyId || '',
      customerNumber: '',
      customerName: '—',
      customerAddress: '',
    };

    if (pmt.partyId) {
      const [cust] = await this.db
        .select({
          customerId: customers.customerId,
          customerNumber: customers.customerNumber,
          name: actors.name,
          headquartersAddressLine1: actors.headquartersAddressLine1,
          city: actors.headquartersCity,
          stateOrProvince: actors.headquartersStateOrProvince,
          postalCode: actors.headquartersPostalCode,
          country: actors.headquartersCountry,
        })
        .from(customers)
        .leftJoin(actors, eq(customers.actorId, actors.actorId))
        .where(eq(customers.customerId, pmt.partyId))
        .limit(1);

      if (cust) {
        const addressParts = [
          cust.headquartersAddressLine1,
          cust.city,
          cust.stateOrProvince,
          cust.postalCode,
          cust.country,
        ].filter(Boolean);

        customerDetails = {
          customerId: cust.customerId,
          customerNumber: cust.customerNumber || '',
          customerName: cust.name || '—',
          customerAddress: addressParts.join(', '),
        };
      }
    }

    // 3. Fetch Allocations linked to Sales Invoices
    const allocations = await this.db
      .select({
        allocationId: paymentAllocations.allocationId,
        referenceType: paymentAllocations.referenceType,
        referenceId: paymentAllocations.referenceId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        discountAmount: paymentAllocations.discountAmount,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: salesInvoices.customerOrderNumber,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        totalAmount: salesInvoices.totalAmount,
      })
      .from(paymentAllocations)
      .leftJoin(
        salesInvoices,
        eq(paymentAllocations.referenceId, salesInvoices.invoiceId),
      )
      .where(eq(paymentAllocations.paymentId, paymentId))
      .orderBy(asc(salesInvoices.invoiceDate));

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
        customerOrderNumber: alloc.customerOrderNumber || '—',
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
        currencyCode: pmt.currencyCode || 'AUD',
        state: pmt.stateCode,
        customerId: customerDetails.customerId,
        customerNumber: customerDetails.customerNumber,
        customerName: customerDetails.customerName,
        customerAddress: customerDetails.customerAddress,
        customerContact: '',
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
