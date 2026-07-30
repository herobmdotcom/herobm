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
  products as coreProducts,
  backorders,
  purchaseOrders,
  transferOrders,
  locations,
  productUoms,
  productComponents,
  tradingTerms,
  taxCategories,
  actors,
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
import { OrdersQueryService } from './orders-query.service';

const VALID_STATES = getValidStates(STATE_TRANSITIONS);

// DTOs imported from ./dto

@Injectable()
export class OrderNotificationService {
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
    private readonly ordersQueryService: OrdersQueryService,
  ) {}

  private readonly logger = new Logger(OrderNotificationService.name);
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  async emailDocument(id: string, dto: EmailDocumentDto, user: JwtUser) {
    // 1. Verify order state
    const order = await this.ordersQueryService.findOne(id);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    const hookSlug = dto.hookSlug || 'sales-order-quote';

    if (hookSlug === 'sales-order-quote') {
      if (
        order.stateCode !== SALES_ORDER_STATE.DRAFT &&
        order.stateCode !== SALES_ORDER_STATE.QUOTED
      ) {
        throw new HttpException(
          'Can only email quotes for orders in draft or quoted state',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const targetId = dto.targetId || id;
    const contextSlug = dto.contextSlug || DATA_SOURCE_CONTEXT.SALES_ORDER;

    // 2. Generate PDF using the standard hook
    const { pdfBuffer, fileName } = await this.pdfTemplatesService.runHook(
      hookSlug,
      targetId,
      contextSlug,
      user,
      { customPdfText: dto.customPdfText },
    );

    const base64Pdf = pdfBuffer.toString('base64');

    // 3. Queue email
    await this.db.transaction(async (tx) => {
      await this.emailService.queueEmail(tx, {
        entityType: 'sales_order',
        entityId: id,
        toAddress: dto.emailAddress,
        subject: dto.subject,
        htmlBody: dto.body?.replace(/\n/g, '<br />') || '', // The macro text goes here, convert newlines to HTML
        attachments: [
          {
            filename: fileName || `Document-${order.orderNumber}.pdf`,
            contentType: 'application/pdf',
            content: base64Pdf,
          },
        ],
        actor: user.username,
      });
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
}
