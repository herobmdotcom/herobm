import {
  backorders,
  customers as coreAccounts,
  products as coreProducts,
  customerGroups,
  opportunities,
  organizations,
  productUoms,
  purchaseOrders,
  salesEvents,
  salesOrderLineItems,
  salesOrders,
  transferOrders,
} from '@herobm/db-schema';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import { BackordersService } from './backorders.service';
import { findOrderLine as sharedFindOrderLine } from './shipment-helpers';

import {
  SALES_ORDER_STATE,
  SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import { CreditAssessmentService } from '../customers/credit-assessment.service';
import { CustomersService } from '../customers/customers.service';
import { EmailService } from '../email/email.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { ProductsService } from '../products/products.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { OrdersCoreService } from './orders-core.service';
import { getCreditBlockedSql } from './orders.sql';
import { PickingService } from './picking.service';

const _VALID_STATES = getValidStates(STATE_TRANSITIONS);

import type {
  GetPricingHistoryQueryDto,
  PaginatedPricingHistoryResponseDto,
  PricingHistoryEntryDto,
} from './dto';

@Injectable()
export class OrdersQueryService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly pickingService: PickingService,
    private readonly customersService: CustomersService,
    private readonly creditAssessmentService: CreditAssessmentService,
    private readonly productsService: ProductsService,
    private readonly backordersService: BackordersService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
    private readonly pdfTemplatesService: PdfTemplatesService,
    private readonly emailService: EmailService,
    private readonly coreService: OrdersCoreService,
  ) {}

  private readonly logger = new Logger(OrdersQueryService.name);
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Get a single order with its line items and events.
   */
  async findOne(id: string) {
    const order = await this.findOrder(id);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        salesOrderId: salesOrderLineItems.salesOrderId,
        lineNumber: salesOrderLineItems.lineNumber,
        lineType: salesOrderLineItems.lineType,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productType: coreProducts.productType,
        structureType: coreProducts.structureType,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        pricePerUnit: salesOrderLineItems.pricePerUnit,
        discountPercentage: salesOrderLineItems.discountPercentage,
        amount: salesOrderLineItems.amount,
        tax: salesOrderLineItems.tax,
        totalAmount: salesOrderLineItems.totalAmount,
        unitOfMeasure: salesOrderLineItems.unitOfMeasure,
        quantityPicked: salesOrderLineItems.quantityPicked,
        taxCategoryId: salesOrderLineItems.taxCategoryId,
        fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
        isPostConfirmation: salesOrderLineItems.isPostConfirmation,
        parentLineId: salesOrderLineItems.parentLineId,
        unitCost: salesOrderLineItems.unitCost,
        baseUom: coreProducts.baseUom,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, id))
      .orderBy(salesOrderLineItems.lineNumber);

    const productIds = Array.from(
      new Set(
        lines
          .map((l) => l.productId)
          .filter(
            (id): id is string =>
              id !== null && id !== '00000000-0000-4000-8000-000000000000',
          ),
      ),
    );

    let allUoms: (typeof productUoms.$inferSelect)[] = [];
    if (productIds.length > 0) {
      allUoms = await this.db
        .select()
        .from(productUoms)
        .where(inArray(productUoms.productId, productIds));
    }

    const linesWithUoms = lines.map((line) => {
      return {
        ...line,
        productUoms: allUoms.filter((u) => u.productId === line.productId),
      };
    });

    const events = await this.db
      .select()
      .from(salesEvents)
      .where(eq(salesEvents.entityId, id))
      .orderBy(sql`${salesEvents.createdOn} DESC`);

    const backorderList = await this.db
      .select({
        lineNumber: salesOrderLineItems.lineNumber,
        productId: backorders.productId,
        productNumber: coreProducts.productNumber,
        quantity: backorders.quantity,
        stateCode: backorders.stateCode,
        purchaseOrderId: backorders.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderState: purchaseOrders.stateCode,
        transferOrderId: backorders.transferOrderId,
        transferOrderNumber: transferOrders.orderNumber,
        transferOrderState: transferOrders.stateCode,
        createdOn: backorders.createdOn,
      })
      .from(backorders)
      .leftJoin(coreProducts, eq(backorders.productId, coreProducts.productId))
      .leftJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(
        transferOrders,
        eq(backorders.transferOrderId, transferOrders.transferOrderId),
      )
      .leftJoin(
        salesOrderLineItems,
        eq(backorders.salesOrderLineId, salesOrderLineItems.salesOrderLineId),
      )
      .where(eq(backorders.salesOrderId, order.salesOrderId))
      .orderBy(salesOrderLineItems.lineNumber, backorders.createdOn);

    const totalAmount = linesWithUoms
      .reduce(
        (acc, line) => acc.plus(new Decimal(line.totalAmount || '0')),
        new Decimal(0),
      )
      .toFixed(2);

    const taxAmount = linesWithUoms
      .reduce(
        (acc, line) => acc.plus(new Decimal(line.tax || '0')),
        new Decimal(0),
      )
      .toFixed(2);

    return {
      ...order,
      totalAmount,
      taxAmount,
      taxProvider:
        this.appConfig.taxProviderMappings()[order.country || ''] || 'internal',
      lines: linesWithUoms,
      events,
      backorders: backorderList,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async findOrder(id: string) {
    if (!id || id === 'undefined') {
      throw new BadRequestException(`Invalid order ID: ${id}`);
    }

    // sales_order_id is uuid — reject non-UUID strings early
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Order '${id}' not found`);
    }

    const rows = await this.db
      .select({
        order: salesOrders,
        customerName: organizations.name,
        country: organizations.headquartersCountry,
        customerAddressLine1: organizations.headquartersAddressLine1,
        customerAddressLine2: organizations.headquartersAddressLine2,
        customerCity: organizations.headquartersCity,
        customerState: organizations.headquartersStateOrProvince,
        customerPostalCode: organizations.headquartersPostalCode,
        customerCountry: organizations.headquartersCountry,
        isCreditBlocked: getCreditBlockedSql(),
        opportunityName: opportunities.name,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(
        organizations,
        eq(coreAccounts.organizationId, organizations.organizationId),
      )
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        opportunities,
        eq(salesOrders.opportunityId, opportunities.opportunityId),
      )
      .where(eq(salesOrders.salesOrderId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Order '${id}' not found`);
    }
    return {
      ...rows[0].order,
      customerName: rows[0].customerName,
      country: rows[0].country,
      customerAddressLine1: rows[0].customerAddressLine1,
      customerAddressLine2: rows[0].customerAddressLine2,
      customerCity: rows[0].customerCity,
      customerState: rows[0].customerState,
      customerPostalCode: rows[0].customerPostalCode,
      customerCountry: rows[0].customerCountry,
      isCreditBlocked: rows[0].isCreditBlocked,
      opportunityName: rows[0].opportunityName ?? null,
    };
  }

  async findLine(lineId: string, orderId: string) {
    return sharedFindOrderLine(this.db, lineId, orderId);
  }

  /**
   * Fetch full paginated order pricing history for a specific product,
   * ranking orders for the specified customer first.
   */
  async getProductPricingHistory(
    query: GetPricingHistoryQueryDto,
  ): Promise<PaginatedPricingHistoryResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(salesOrderLineItems.productId, query.productId),
      ne(salesOrders.stateCode, SALES_ORDER_STATE.CANCELLED),
    ];
    if (query.excludeOrderId) {
      conditions.push(ne(salesOrders.salesOrderId, query.excludeOrderId));
    }
    if (query.customerOnly && query.customerId) {
      conditions.push(eq(salesOrders.customerId, query.customerId));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(salesOrderLineItems)
      .innerJoin(
        salesOrders,
        eq(salesOrderLineItems.salesOrderId, salesOrders.salesOrderId),
      )
      .where(whereClause);

    const orderBys = query.customerId
      ? [
          asc(
            sql<number>`CASE WHEN ${salesOrders.customerId} = ${query.customerId} THEN 0 ELSE 1 END`,
          ),
          desc(salesOrders.createdOn),
        ]
      : [desc(salesOrders.createdOn)];

    const rows = await this.db
      .select({
        salesOrderId: salesOrders.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        orderName: salesOrders.name,
        customerId: salesOrders.customerId,
        customerName: sql<string>`coalesce(${organizations.name}, ${coreAccounts.customerNumber}, 'Unknown')`,
        stateCode: salesOrders.stateCode,
        createdOn: salesOrders.createdOn,
        lineNumber: salesOrderLineItems.lineNumber,
        quantity: salesOrderLineItems.quantity,
        unitOfMeasure: salesOrderLineItems.unitOfMeasure,
        pricePerUnit: salesOrderLineItems.pricePerUnit,
        discountPercentage: salesOrderLineItems.discountPercentage,
        totalAmount: salesOrderLineItems.totalAmount,
        currencyCode: salesOrders.currencyCode,
      })
      .from(salesOrderLineItems)
      .innerJoin(
        salesOrders,
        eq(salesOrderLineItems.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(
        organizations,
        eq(coreAccounts.organizationId, organizations.organizationId),
      )
      .where(whereClause)
      .orderBy(...orderBys)
      .limit(limit)
      .offset(offset);

    const data: PricingHistoryEntryDto[] = rows.map((row) => ({
      salesOrderId: row.salesOrderId,
      orderNumber: row.orderNumber,
      orderName: row.orderName,
      customerId: row.customerId,
      customerName: row.customerName,
      isCurrentCustomer: query.customerId
        ? row.customerId === query.customerId
        : false,
      stateCode: row.stateCode,
      orderDate: row.createdOn ? new Date(row.createdOn).toISOString() : '',
      lineNumber: row.lineNumber,
      quantity: row.quantity,
      unitOfMeasure: row.unitOfMeasure,
      pricePerUnit: row.pricePerUnit,
      discountPercentage: row.discountPercentage,
      lineTotal: row.totalAmount,
      currencyCode: row.currencyCode,
    }));

    return {
      data,
      total: Number(count),
      page,
      limit,
    };
  }
}
