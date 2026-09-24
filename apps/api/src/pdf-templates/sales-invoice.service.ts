import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, asc, and, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { OrdersService } from '../orders/orders.service';
import { OrdersQueryService } from '../orders/orders-query.service';
import { SalesQuoteData } from './sales-quote.service';
import { resolveOrderDetail, assembleOrderData } from './report-data.helper';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesInvoices,
  salesInvoiceLines,
  projects,
  customers,
  organizations,
  products,
  projectLedgerEntries,
  projectResources,
} from '@herobm/db-schema';
import {
  SALES_INVOICE_STATE,
  LineType,
  computeOrderTotals,
} from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { RunHookOptionsDto } from './dto';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersQueryService: OrdersQueryService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(SalesInvoiceService.name);

  async assembleData(
    orderId: string,
    source?: string,
    invoiceId?: string,
    options?: RunHookOptionsDto & Record<string, unknown>,
  ): Promise<SalesQuoteData> {
    const orderDetail = await resolveOrderDetail(
      this.ordersQueryService,
      this.ordersService,
      orderId,
      source,
    );

    const customText = options?.customPdfText || options?.quoteIntroText;

    if (!invoiceId) {
      const data = assembleOrderData(
        orderDetail,
        this.appConfig.homeCurrency(),
      );
      if (customText) {
        data.customPdfText = customText;
        data.quoteIntroText = customText;
      }
      return data;
    }

    // Fetch the specific invoice and its lines
    const [invoice] = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        customerNameDisplay: salesInvoices.customerNameDisplay,
        dueDate: salesInvoices.dueDate,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
      })
      .from(salesInvoices)
      .leftJoin(projects, eq(salesInvoices.projectId, projects.projectId))
      .where(eq(salesInvoices.invoiceId, invoiceId));

    if (!invoice || invoice.salesOrderId !== orderId) {
      throw new NotFoundException(
        `Invoice ${invoiceId} not found for order ${orderId}`,
      );
    }

    const invLines = await this.db
      .select()
      .from(salesInvoiceLines)
      .where(eq(salesInvoiceLines.invoiceId, invoiceId));

    // Build a lookup: salesOrderLineId → invoiced quantity & price
    const invLineMap = new Map(
      invLines.map((il) => [
        il.salesOrderLineId,
        {
          quantity: il.quantityInvoiced,
          pricePerUnit: il.pricePerUnit,
        },
      ]),
    );

    const filteredLines = orderDetail.lines
      .filter(
        (l) =>
          invLineMap.has(l.salesOrderLineId) ||
          l.lineType === (LineType.COMMENT as string),
      )
      .map((l) => {
        if (l.lineType === (LineType.COMMENT as string)) {
          return {
            ...l,
            quantity: '0',
            pricePerUnit: '0',
            amount: '0',
            tax: '0',
            totalAmount: '0',
          };
        }

        const inv = invLineMap.get(l.salesOrderLineId)!;
        const originalQty = parseFloat(l.quantity || '1');
        const invoicedQty = parseFloat(inv.quantity);
        const ratio = originalQty > 0 ? invoicedQty / originalQty : 0;

        const proratedAmount = parseFloat(l.amount || '0') * ratio;
        const proratedTax = parseFloat(l.tax || '0') * ratio;

        return {
          ...l,
          quantity: inv.quantity,
          pricePerUnit: inv.pricePerUnit,
          amount: proratedAmount.toFixed(2),
          tax: proratedTax.toFixed(2),
          totalAmount: (proratedAmount + proratedTax).toFixed(2),
        };
      });

    // Build the invoice-specific report data
    const invoiceData = assembleOrderData(
      {
        ...orderDetail,
        projectNumber: invoice.projectNumber || undefined,
        customerName: invoice.customerNameDisplay || orderDetail.customerName,
        lines: filteredLines,
      },
      this.appConfig.homeCurrency(),
    );

    if (customText) {
      invoiceData.customPdfText = customText;
      invoiceData.quoteIntroText = customText;
    }

    // Compute the full (unfiltered) order total for comparison
    const fullOrderData = assembleOrderData(
      orderDetail,
      this.appConfig.homeCurrency(),
    );

    // Determine this invoice's ordinal position among all invoices for the order
    const allOrderInvoices = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.salesOrderId, orderId),
          ne(salesInvoices.stateCode, SALES_INVOICE_STATE.CANCELLED),
        ),
      )
      .orderBy(asc(salesInvoices.createdOn));

    const totalInvoices = allOrderInvoices.length;
    const sequenceNumber =
      allOrderInvoices.findIndex((i) => i.invoiceId === invoiceId) + 1;

    return {
      ...invoiceData,
      invoiceMeta: {
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString('en-IE')
          : null,
        sequenceNumber,
        totalInvoices,
        orderTotal: fullOrderData.summary.totalAmount,
      },
    } as SalesQuoteData;
  }

  async assembleProjectInvoiceData(
    invoiceId: string,
    options?: RunHookOptionsDto & Record<string, unknown>,
  ): Promise<SalesQuoteData> {
    const customText = options?.customPdfText || options?.quoteIntroText;

    const [invoice] = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: salesInvoices.customerOrderNumber,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        projectName: projects.name,
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${organizations.name})`.as(
          'customer_name',
        ),
        currencyCode: salesInvoices.currencyCode,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        createdOn: salesInvoices.createdOn,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
      })
      .from(salesInvoices)
      .leftJoin(projects, eq(salesInvoices.projectId, projects.projectId))
      .leftJoin(
        customers,
        eq(
          sql`COALESCE(${salesInvoices.customerId}, ${projects.customerId})`,
          customers.customerId,
        ),
      )
      .leftJoin(
        organizations,
        eq(customers.organizationId, organizations.organizationId),
      )
      .where(eq(salesInvoices.invoiceId, invoiceId));

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const ledgerProducts = alias(products, 'ledger_products');
    const resourceProducts = alias(products, 'resource_products');

    const linesRaw = await this.db
      .select({
        lineId: salesInvoiceLines.invoiceLineId,
        quantityInvoiced: salesInvoiceLines.quantityInvoiced,
        pricePerUnit: salesInvoiceLines.pricePerUnit,
        amount: salesInvoiceLines.amount,
        taxAmount: salesInvoiceLines.taxAmount,
        discountPercentage: salesInvoiceLines.discountPercentage,
        productId: sql<
          string | null
        >`COALESCE(${salesInvoiceLines.productId}, ${projectLedgerEntries.productId}, ${projectResources.serviceProductId})`,
        productNumber: sql<
          string | null
        >`COALESCE(${products.productNumber}, ${ledgerProducts.productNumber}, ${resourceProducts.productNumber}, ${projectResources.resourceNumber})`,
        description: sql<string>`COALESCE(${salesInvoiceLines.description}, ${products.name}, ${ledgerProducts.name}, ${resourceProducts.name}, '—')`,
      })
      .from(salesInvoiceLines)
      .leftJoin(products, eq(salesInvoiceLines.productId, products.productId))
      .leftJoin(
        projectLedgerEntries,
        eq(
          salesInvoiceLines.projectLedgerEntryId,
          projectLedgerEntries.ledgerId,
        ),
      )
      .leftJoin(
        projectResources,
        eq(projectLedgerEntries.resourceId, projectResources.resourceId),
      )
      .leftJoin(
        ledgerProducts,
        eq(projectLedgerEntries.productId, ledgerProducts.productId),
      )
      .leftJoin(
        resourceProducts,
        eq(projectResources.serviceProductId, resourceProducts.productId),
      )
      .where(eq(salesInvoiceLines.invoiceId, invoiceId));

    const invoiceTax = parseFloat(invoice.taxAmount || '0');
    const invoiceSubtotal = linesRaw.reduce(
      (sum, l) => sum + parseFloat(l.amount || '0'),
      0,
    );

    const lines = linesRaw.map((line, idx) => {
      const lineAmt = parseFloat(line.amount || '0');
      let lineTax = 0;
      if (line.taxAmount != null) {
        lineTax = parseFloat(line.taxAmount);
      } else if (invoiceTax > 0 && invoiceSubtotal > 0) {
        lineTax = (lineAmt / invoiceSubtotal) * invoiceTax;
      }
      const disc = parseFloat(line.discountPercentage || '0');
      const taxRate =
        lineAmt > 0 && lineTax > 0 ? (lineTax / lineAmt) * 100 : 0;

      return {
        lineNumber: idx + 1,
        productNumber: line.productNumber || line.productId || '—',
        description: line.description || '—',
        quantity: line.quantityInvoiced,
        pricePerUnit: line.pricePerUnit,
        discountPercentage: disc.toFixed(2),
        taxRate: `${taxRate.toFixed(1)}%`,
        tax: lineTax.toFixed(2),
        amount: lineAmt.toFixed(2),
        totalAmount: (lineAmt + lineTax).toFixed(2),
        unitOfMeasure: 'EA',
      };
    });

    const fallbackCurrency = this.appConfig.homeCurrency();
    const totals = computeOrderTotals(lines);

    let sequenceNumber = 1;
    let totalInvoices = 1;
    if (invoice.projectId) {
      const allProjectInvoices = await this.db
        .select({ invoiceId: salesInvoices.invoiceId })
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.projectId, invoice.projectId),
            ne(salesInvoices.stateCode, SALES_INVOICE_STATE.CANCELLED),
          ),
        )
        .orderBy(asc(salesInvoices.createdOn));
      totalInvoices = allProjectInvoices.length;
      sequenceNumber =
        allProjectInvoices.findIndex((i) => i.invoiceId === invoiceId) + 1;
    }

    return {
      header: {
        orderNumber: '',
        projectNumber: invoice.projectNumber || '',
        customerName: invoice.customerName || '',
        customerOrderNumber: invoice.customerOrderNumber || '',
        orderDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate).toLocaleDateString('en-IE')
          : invoice.createdOn
            ? new Date(invoice.createdOn).toLocaleDateString('en-IE')
            : '',
        currencyCode: invoice.currencyCode || fallbackCurrency,
        name: invoice.projectName || '',
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
      customPdfText: customText,
      quoteIntroText: customText,
      invoiceMeta: {
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString('en-IE')
          : null,
        sequenceNumber: sequenceNumber > 0 ? sequenceNumber : 1,
        totalInvoices: totalInvoices > 0 ? totalInvoices : 1,
      },
    };
  }
}
