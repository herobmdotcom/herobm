import { HttpException, HttpStatus } from '@nestjs/common';
import { BackordersService } from './backorders.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import {
  InventoryGap,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  getErrorMessage,
} from '@herobm/shared';
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, sql, inArray, getTableColumns } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  salesEvents,
  customers as coreAccounts,
  customerGroups,
  actors,
  opportunities,
  products as coreProducts,
  backorders,
  purchaseOrders,
  transferOrders,
  locations,
  productUoms,
  productComponents,
  tradingTerms,
  taxCategories,
} from '@herobm/db-schema';
import {
  CreateOrderDto,
  UpdateOrderDto,
  CreateOrderLineDto as AddLineDto, // Renamed to match usage
  UpdateOrderLineDto as UpdateLineDto,
} from './dto';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { findOrderLine as sharedFindOrderLine } from './shipment-helpers';
import { emitEvent } from '../common/emit-event';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';

import { TaxCategoriesService } from '../tax/tax-categories.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { verifySystemHealth } from '../common/utils/security.util';
import { PickingService } from './picking.service';
import { CustomersService } from '../customers/customers.service';
import { CreditAssessmentService } from '../customers/credit-assessment.service';
import { ProductsService } from '../products/products.service';
import {
  SALES_ORDER_TRANSITIONS as STATE_TRANSITIONS,
  getValidStates,
  computeLinePriceForStorage,
} from '@herobm/shared';
import {
  resolveEffectiveCreditHold,
  resolveEffectiveCreditLimit,
  resolveEffectiveTradingTermsId,
} from '../customers/credit-control.utils';
import { getCreditBlockedSql } from './orders.sql';
import { PdfTemplatesService } from '../pdf-templates/pdf-templates.service';
import { EmailService } from '../email/email.service';
import { EmailDocumentDto } from './dto';
import type { JwtUser } from '../auth/auth-user.decorator';
import { OrdersCoreService } from './orders-core.service';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

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

    return {
      ...order,
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
        customerName: actors.name,
        country: actors.headquartersCountry,
        isCreditBlocked: getCreditBlockedSql(),
        opportunityName: opportunities.name,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
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
      isCreditBlocked: rows[0].isCreditBlocked,
      opportunityName: rows[0].opportunityName ?? null,
    };
  }

  async findLine(lineId: string, orderId: string) {
    return sharedFindOrderLine(this.db, lineId, orderId);
  }
}
