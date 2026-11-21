import {
  customers,
  organizations,
  products,
  projectLedgerEntries,
  projectResources,
  projects,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLineItems,
  salesOrders,
} from '@herobm/db-schema';
import {
  SALES_INVOICE_STATE,
  computeOrderTotals,
  formatReportDate,
  formatReportDateTime,
  toDecimal,
} from '@herobm/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { OrdersQueryService } from '../orders/orders-query.service';
import { OrdersService } from '../orders/orders.service';
import { AppConfigService } from '../settings/app-config.service';
import { RunHookOptionsDto } from './dto';
import { assembleOrderData, resolveOrderDetail } from './report-data.helper';
import { SalesQuoteData } from './sales-quote.service';

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
    if (invoiceId) {
      return this.assembleInvoiceData(invoiceId, options);
    }

    const orderDetail = await resolveOrderDetail(
      this.ordersQueryService,
      this.ordersService,
      orderId,
      source,
    );

    const customText = options?.customPdfText || options?.quoteIntroText;
    const data = assembleOrderData(orderDetail, this.appConfig.homeCurrency());
    if (customText) {
      data.customPdfText = customText;
      data.quoteIntroText = customText;
    }
    return data;
  }

  async assembleProjectInvoiceData(
    invoiceId: string,
    options?: RunHookOptionsDto & Record<string, unknown>,
  ): Promise<SalesQuoteData> {
    return this.assembleInvoiceData(invoiceId, options);
  }

  async assembleInvoiceData(
    invoiceId: string,
    options?: RunHookOptionsDto & Record<string, unknown>,
  ): Promise<SalesQuoteData> {
    const customText = options?.customPdfText || options?.quoteIntroText;

    const [invoice] = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        orderCustomerOrderNumber: salesOrders.customerOrderNumber,
        orderTotalAmount: salesOrders.baseTotalAmount,
        deliveryName: salesOrders.deliveryName,
        deliveryCompanyName: salesOrders.deliveryCompanyName,
        deliveryPhone: salesOrders.deliveryPhone,
        deliveryAddressLine1: salesOrders.deliveryAddressLine1,
        deliveryAddressLine2: salesOrders.deliveryAddressLine2,
        deliveryCity: salesOrders.deliveryCity,
        deliveryState: salesOrders.deliveryState,
        deliveryPostalCode: salesOrders.deliveryPostalCode,
        deliveryCountry: salesOrders.deliveryCountry,
        customerOrderNumber: salesInvoices.customerOrderNumber,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        projectName: projects.name,
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${organizations.name})`.as(
          'customer_name',
        ),
        customerAddressLine1: organizations.headquartersAddressLine1,
        customerAddressLine2: organizations.headquartersAddressLine2,
        customerCity: organizations.headquartersCity,
        customerState: organizations.headquartersStateOrProvince,
        customerPostalCode: organizations.headquartersPostalCode,
        customerCountry: organizations.headquartersCountry,
        currencyCode: salesInvoices.currencyCode,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        createdOn: salesInvoices.createdOn,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
      })
      .from(salesInvoices)
      .leftJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(projects, eq(salesInvoices.projectId, projects.projectId))
      .leftJoin(
        customers,
        eq(
          sql`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId}, ${projects.customerId})`,
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

    const soProducts = alias(products, 'so_products');
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
        unitOfMeasure: salesOrderLineItems.unitOfMeasure,
        productId: sql<
          string | null
        >`COALESCE(${salesInvoiceLines.productId}, ${salesOrderLineItems.productId}, ${projectLedgerEntries.productId}, ${projectResources.serviceProductId})`,
        productNumber: sql<
          string | null
        >`COALESCE(${products.productNumber}, ${soProducts.productNumber}, ${ledgerProducts.productNumber}, ${resourceProducts.productNumber}, ${projectResources.resourceNumber})`,
        description: sql<string>`COALESCE(${salesInvoiceLines.description}, ${salesOrderLineItems.productDescription}, ${products.name}, ${soProducts.name}, ${ledgerProducts.name}, ${resourceProducts.name}, '—')`,
      })
      .from(salesInvoiceLines)
      .leftJoin(
        salesOrderLineItems,
        eq(
          salesInvoiceLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(products, eq(salesInvoiceLines.productId, products.productId))
      .leftJoin(
        soProducts,
        eq(salesOrderLineItems.productId, soProducts.productId),
      )
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
      .where(eq(salesInvoiceLines.invoiceId, invoiceId))
      .orderBy(
        asc(sql`COALESCE(${salesOrderLineItems.lineNumber}, 999999)`),
        asc(salesInvoiceLines.invoiceLineId),
      );

    const invoiceTax = toDecimal(invoice.taxAmount);
    const invoiceSubtotal = linesRaw.reduce(
      (sum, l) => sum.plus(toDecimal(l.amount)),
      toDecimal(0),
    );

    const lines = linesRaw.map((line, idx) => {
      const lineAmt = toDecimal(line.amount);
      let lineTax = toDecimal(0);
      if (line.taxAmount != null) {
        lineTax = toDecimal(line.taxAmount);
      } else if (invoiceTax.greaterThan(0) && invoiceSubtotal.greaterThan(0)) {
        lineTax = lineAmt.div(invoiceSubtotal).times(invoiceTax);
      }
      const disc = toDecimal(line.discountPercentage);
      const taxRate =
        lineAmt.greaterThan(0) && lineTax.greaterThan(0)
          ? lineTax.div(lineAmt).times(100)
          : toDecimal(0);

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
        totalAmount: lineAmt.plus(lineTax).toFixed(2),
        unitOfMeasure: line.unitOfMeasure || 'EA',
      };
    });

    const fallbackCurrency = this.appConfig.homeCurrency();
    const totals = computeOrderTotals(lines);

    let sequenceNumber = 1;
    let totalInvoices = 1;
    let orderTotal: number | undefined = undefined;

    if (invoice.salesOrderId) {
      const allOrderInvoices = await this.db
        .select({ invoiceId: salesInvoices.invoiceId })
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.salesOrderId, invoice.salesOrderId),
            ne(salesInvoices.stateCode, SALES_INVOICE_STATE.CANCELLED),
          ),
        )
        .orderBy(asc(salesInvoices.createdOn));
      totalInvoices = allOrderInvoices.length;
      sequenceNumber =
        allOrderInvoices.findIndex((i) => i.invoiceId === invoiceId) + 1;
      if (invoice.orderTotalAmount) {
        orderTotal = toDecimal(invoice.orderTotalAmount).toNumber();
      }
    } else if (invoice.projectId) {
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

    const billingAddressParts = [
      invoice.customerAddressLine1,
      invoice.customerAddressLine2,
      [invoice.customerCity, invoice.customerState, invoice.customerPostalCode]
        .filter(Boolean)
        .join(' '),
      invoice.customerCountry,
    ].filter(Boolean);
    const billingAddress = billingAddressParts.join(', ');

    const deliveryAddressParts = [
      invoice.deliveryAddressLine1,
      invoice.deliveryAddressLine2,
      [invoice.deliveryCity, invoice.deliveryState, invoice.deliveryPostalCode]
        .filter(Boolean)
        .join(' '),
      invoice.deliveryCountry,
    ].filter(Boolean);
    const deliveryAddress = deliveryAddressParts.join(', ');

    const customerAddress = billingAddress || deliveryAddress || undefined;

    return {
      header: {
        orderNumber: invoice.orderNumber || '',
        projectNumber: invoice.projectNumber || '',
        customerName: invoice.customerName || '',
        customerAddress,
        billingAddress: billingAddress || undefined,
        customerOrderNumber:
          invoice.customerOrderNumber || invoice.orderCustomerOrderNumber || '',
        orderDate: formatReportDate(
          invoice.invoiceDate || invoice.createdOn,
          undefined,
          '',
        ),
        currencyCode: invoice.currencyCode || fallbackCurrency,
        name: invoice.projectName || '',
      },
      lines,
      summary: {
        subtotal: totals.subtotal,
        totalTax: totals.totalTax,
        totalAmount: totals.totalAmount,
      },
      generatedAt: formatReportDateTime(new Date()),
      customPdfText: customText,
      quoteIntroText: customText,
      invoiceMeta: {
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate
          ? formatReportDate(invoice.dueDate, undefined, '')
          : null,
        sequenceNumber: sequenceNumber > 0 ? sequenceNumber : 1,
        totalInvoices: totalInvoices > 0 ? totalInvoices : 1,
        orderTotal,
      },
    };
  }
}
