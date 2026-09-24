import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql, desc, and, gte, or, asc, lt, gt, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesInvoices,
  salesInvoiceLines,
  salesOrderLineItems,
  customers,
  products as coreProducts,
  paymentEntries,
  paymentAllocations,
  salesEvents,
  organizations,
  projects,
  projectLedgerEntries,
  projectResources,
} from '@herobm/db-schema';
import { withCursorPagination } from '../common/pagination';

@Injectable()
export class SalesInvoiceQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Fetch a specific HeroBM Sales Invoice with natively populated mappings structurally
   */
  async findOne(invoiceId: string) {
    const rows = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: sql<
          string | null
        >`COALESCE(${salesInvoices.customerOrderNumber}, ${salesOrders.customerOrderNumber})`.as(
          'customer_order_number',
        ),
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        customerId: sql<
          string | null
        >`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId}, ${projects.customerId})`.as(
          'customer_id',
        ),
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${organizations.name})`.as(
          'customer_name',
        ),
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        createdOn: salesInvoices.createdOn,
        dueDate: salesInvoices.dueDate,
        invoiceDate: salesInvoices.invoiceDate,
        notes: salesInvoices.notes,
        earlyPaymentDiscount: salesInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: salesInvoices.earlyPaymentDiscountDays,
        termsDescription: salesInvoices.termsDescription,
        metadata: salesInvoices.metadata,
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
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found directly.`);
    }

    const invoice = rows[0];

    const ledgerProducts = alias(coreProducts, 'ledger_products');
    const resourceProducts = alias(coreProducts, 'resource_products');

    // Hydrate explicitly native HeroBM line mapping structurally
    const linesRaw = await this.db
      .select({
        lineId: salesInvoiceLines.invoiceLineId,
        quantityInvoiced: salesInvoiceLines.quantityInvoiced,
        pricePerUnit: salesInvoiceLines.pricePerUnit,
        amount: salesInvoiceLines.amount,
        taxAmount: salesInvoiceLines.taxAmount,
        taxCategoryId: salesInvoiceLines.taxCategoryId,
        discountPercentage: salesInvoiceLines.discountPercentage,
        productId: sql<
          string | null
        >`COALESCE(${salesInvoiceLines.productId}, ${salesOrderLineItems.productId}, ${projectLedgerEntries.productId}, ${projectResources.serviceProductId})`,
        productNumber: sql<
          string | null
        >`COALESCE(${coreProducts.productNumber}, ${ledgerProducts.productNumber}, ${resourceProducts.productNumber}, ${projectResources.resourceNumber})`,
        description: sql<string>`COALESCE(${salesInvoiceLines.description}, ${salesOrderLineItems.productDescription}, ${coreProducts.name}, ${ledgerProducts.name}, ${resourceProducts.name})`,
        orderDiscountPercentage: salesOrderLineItems.discountPercentage,
        projectDiscountPercentage: projectLedgerEntries.discountPercentage,
        orderLineTax: salesOrderLineItems.tax,
        orderLineAmount: salesOrderLineItems.amount,
        orderLineQuantity: salesOrderLineItems.quantity,
        projectLedgerEntryId: salesInvoiceLines.projectLedgerEntryId,
      })
      .from(salesInvoiceLines)
      .leftJoin(
        salesOrderLineItems,
        eq(
          salesInvoiceLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(
          sql`COALESCE(${salesInvoiceLines.productId}, ${salesOrderLineItems.productId})`,
          coreProducts.productId,
        ),
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
        asc(salesOrderLineItems.lineNumber),
        asc(salesInvoiceLines.invoiceLineId),
      );

    const invoiceTax = parseFloat(invoice.taxAmount || '0');
    const invoiceSubtotal = linesRaw.reduce(
      (sum, l) => sum + parseFloat(l.amount || '0'),
      0,
    );

    const lines = linesRaw.map((line) => {
      let taxAmount = '0';
      if (line.taxAmount != null) {
        taxAmount = line.taxAmount;
      } else {
        const lineAmt = parseFloat(line.amount || '0');
        const lineQty = parseFloat(line.quantityInvoiced || '0');

        if (lineAmt === 0 || lineQty === 0) {
          taxAmount = '0';
        } else if (
          line.orderLineTax != null &&
          line.orderLineAmount != null &&
          parseFloat(line.orderLineAmount) > 0
        ) {
          taxAmount = (
            (lineAmt / parseFloat(line.orderLineAmount)) *
            parseFloat(line.orderLineTax)
          ).toFixed(2);
        } else if (
          line.orderLineTax != null &&
          line.orderLineQuantity != null &&
          parseFloat(line.orderLineQuantity) > 0
        ) {
          taxAmount = (
            (lineQty / parseFloat(line.orderLineQuantity)) *
            parseFloat(line.orderLineTax)
          ).toFixed(2);
        } else if (invoiceTax > 0 && invoiceSubtotal > 0) {
          taxAmount = ((lineAmt / invoiceSubtotal) * invoiceTax).toFixed(2);
        }
      }

      const discountPercentage =
        line.discountPercentage != null
          ? line.discountPercentage
          : line.orderDiscountPercentage ||
            line.projectDiscountPercentage ||
            '0';

      return {
        lineId: line.lineId,
        quantityInvoiced: line.quantityInvoiced,
        pricePerUnit: line.pricePerUnit,
        amount: line.amount,
        productId: line.productId,
        productNumber: line.productNumber,
        description: line.description,
        discountPercentage,
        taxAmount,
        taxCategoryId: line.taxCategoryId || null,
        projectLedgerEntryId: line.projectLedgerEntryId,
      };
    });

    const allocations = await this.db
      .select({
        allocationId: paymentAllocations.allocationId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        paymentId: paymentAllocations.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentDate: paymentEntries.paymentDate,
        currencyCode: paymentEntries.currencyCode,
      })
      .from(paymentAllocations)
      .innerJoin(
        paymentEntries,
        eq(paymentAllocations.paymentId, paymentEntries.paymentId),
      )
      .where(
        and(
          eq(paymentAllocations.referenceId, invoiceId),
          eq(paymentAllocations.referenceType, 'sales_invoice'),
        ),
      );

    const events = await this.db
      .select()
      .from(salesEvents)
      .where(eq(salesEvents.entityId, invoiceId))
      .orderBy(desc(salesEvents.createdOn));

    return { ...invoice, lines, allocations, events };
  }

  /**
   * Fetch all Native HeroBM Invoices strictly tied to a distinct active order
   */
  async findByOrder(salesOrderId: string) {
    const invoices = await this.db
      .select()
      .from(salesInvoices)
      .where(eq(salesInvoices.salesOrderId, salesOrderId))
      .orderBy(desc(salesInvoices.createdOn));

    // Hydrate lines for each invoice
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.invoiceId);
    if (invoiceIds.length > 0) {
      const allLines = await this.db
        .select({
          lineId: salesInvoiceLines.invoiceLineId,
          invoiceId: salesInvoiceLines.invoiceId,
          salesOrderLineId: salesInvoiceLines.salesOrderLineId,
          quantityInvoiced: salesInvoiceLines.quantityInvoiced,
          pricePerUnit: salesInvoiceLines.pricePerUnit,
          discountPercentage: salesInvoiceLines.discountPercentage,
          taxAmount: salesInvoiceLines.taxAmount,
          taxCategoryId: salesInvoiceLines.taxCategoryId,
          amount: salesInvoiceLines.amount,
        })
        .from(salesInvoiceLines)
        .where(
          sql`${salesInvoiceLines.invoiceId} IN (${sql.join(
            invoiceIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic grouping of raw DB results
      const groupedLines: Record<string, any[]> = {};
      for (const line of allLines) {
        if (!groupedLines[line.invoiceId]) {
          groupedLines[line.invoiceId] = [];
        }
        groupedLines[line.invoiceId].push(line);
      }

      return invoices.map((inv) => ({
        ...inv,
        lines: groupedLines[inv.invoiceId] || [],
      }));
    }

    return invoices;
  }

  /**
   * Fetch all Native HeroBM Invoices strictly tied to a distinct operational project
   */
  async findByProject(projectId: string) {
    const invoices = await this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: salesInvoices.customerOrderNumber,
        salesOrderId: salesInvoices.salesOrderId,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        customerId: sql<
          string | null
        >`COALESCE(${salesInvoices.customerId}, ${projects.customerId})`.as(
          'customer_id',
        ),
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${organizations.name})`.as(
          'customer_name',
        ),
        customerNameDisplay: salesInvoices.customerNameDisplay,
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        termsDescription: salesInvoices.termsDescription,
        notes: salesInvoices.notes,
        createdOn: salesInvoices.createdOn,
        modifiedOn: salesInvoices.modifiedOn,
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
      .where(eq(salesInvoices.projectId, projectId))
      .orderBy(desc(salesInvoices.createdOn));

    return invoices;
  }

  /**
   * Fetch a flattened, global list of Sales Invoices spanning multiple orders.
   * Useful for the "All Invoices" page and Customer Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number | string;
    customerId?: string;
    projectId?: string;
    invoiceId?: string;
    balanceStatus?: string;
    limit?: number;
    cursor?: unknown;
    direction?: 'next' | 'prev';
    searchTerm?: string | null;
  }) {
    const {
      days = 30,
      customerId,
      projectId,
      invoiceId,
      balanceStatus,
      limit = 100,
      cursor,
      direction = 'next',
      searchTerm,
    } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle SQL operators array typing
    const conditions: any[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(salesInvoices.invoiceId, invoiceId));
    } else if (String(days).toLowerCase() === 'mtd') {
      conditions.push(
        sql`${salesInvoices.createdOn} >= DATE_TRUNC('month', NOW())`,
      );
    } else if (Number(days) > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));
      conditions.push(gte(salesInvoices.createdOn, cutoffDate));
    }

    if (projectId) {
      conditions.push(eq(salesInvoices.projectId, projectId));
    }

    if (customerId) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          customerId,
        );

      if (isUuid) {
        conditions.push(
          or(
            eq(customers.customerId, customerId),
            eq(customers.externalId, customerId),
          ),
        );
      } else {
        conditions.push(eq(customers.externalId, customerId));
      }
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric > 0`);
    } else if (balanceStatus === 'paid') {
      conditions.push(sql`${salesInvoices.outstandingAmount}::numeric <= 0`);
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${salesInvoices.invoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesInvoices.invoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${salesOrders.orderNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${projects.projectNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${projects.projectNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${organizations.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${organizations.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesInvoices.invoiceNumber, `%${rawSearchTerm}%`),
          ilike(salesOrders.orderNumber, `%${rawSearchTerm}%`),
          ilike(projects.projectNumber, `%${rawSearchTerm}%`),
          ilike(organizations.name, `%${rawSearchTerm}%`),
        ) as import('drizzle-orm').SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.db
      .select({
        invoiceId: salesInvoices.invoiceId,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerOrderNumber: sql<
          string | null
        >`COALESCE(${salesInvoices.customerOrderNumber}, ${salesOrders.customerOrderNumber})`.as(
          'customer_order_number',
        ),
        salesOrderId: salesInvoices.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        projectId: salesInvoices.projectId,
        projectNumber: projects.projectNumber,
        customerId: sql<
          string | null
        >`COALESCE(${salesInvoices.customerId}, ${salesOrders.customerId}, ${projects.customerId})`.as(
          'customer_id',
        ),
        customerName: sql<
          string | null
        >`COALESCE(${salesInvoices.customerNameDisplay}, ${organizations.name})`.as(
          'customer_name',
        ),
        totalAmount: salesInvoices.totalAmount,
        taxAmount: salesInvoices.taxAmount,
        outstandingAmount: salesInvoices.outstandingAmount,
        currencyCode: salesInvoices.currencyCode,
        stateCode: salesInvoices.stateCode,
        invoiceDate: salesInvoices.invoiceDate,
        dueDate: salesInvoices.dueDate,
        termsDescription: salesInvoices.termsDescription,
        createdOn: salesInvoices.createdOn,
        earlyPaymentDiscount: salesInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: salesInvoices.earlyPaymentDiscountDays,
        score: scoreSql,
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
      .$dynamic();

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }

    return await withCursorPagination({
      qb: dataQuery,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        invoiceId: string;
      } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? lt : gt;
        const cursorCond = or(
          op(scoreSql, c.score),
          and(
            eq(scoreSql, c.score),
            op(salesInvoices.createdOn, new Date(c.createdOn)),
          ),
          and(
            eq(scoreSql, c.score),
            eq(salesInvoices.createdOn, new Date(c.createdOn)),
            op(salesInvoices.invoiceId, c.invoiceId),
          ),
        ) as import('drizzle-orm').SQL;
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const op = dir === 'next' ? desc : asc;
        return q.orderBy(
          op(scoreSql),
          op(salesInvoices.createdOn),
          op(salesInvoices.invoiceId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn
          ? new Date(row.createdOn).toISOString()
          : new Date().toISOString(),
        invoiceId: row.invoiceId,
      }),
    });
  }
}
