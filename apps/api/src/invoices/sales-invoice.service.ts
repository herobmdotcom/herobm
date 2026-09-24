import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesInvoices } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { CreateSalesInvoiceDto } from './dto';
import { SALES_INVOICE_STATE } from '@herobm/shared';
import { SalesInvoiceCreationService } from './sales-invoice-creation.service';
import { SalesInvoiceProjectService } from './sales-invoice-project.service';
import { SalesInvoiceQueryService } from './sales-invoice-query.service';
import { changeSalesInvoiceStateHelper } from './sales-invoice-state.helper';

@Injectable()
export class SalesInvoiceService {
  private readonly logger = new Logger(SalesInvoiceService.name);
  private readonly creationService: SalesInvoiceCreationService;
  private readonly projectService: SalesInvoiceProjectService;
  private readonly queryService: SalesInvoiceQueryService;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
    @Optional() creationService?: SalesInvoiceCreationService,
    @Optional() projectService?: SalesInvoiceProjectService,
    @Optional() queryService?: SalesInvoiceQueryService,
  ) {
    this.creationService =
      creationService ||
      new SalesInvoiceCreationService(
        db,
        glService,
        taxService,
        appConfig,
        organizationService,
        enrichmentService,
      );
    this.projectService =
      projectService ||
      new SalesInvoiceProjectService(db, glService, taxService, appConfig);
    this.queryService = queryService || new SalesInvoiceQueryService(db);
  }

  // --- Facade delegations ---

  async createInvoice(
    salesOrderId: string,
    dto: CreateSalesInvoiceDto,
    actor: string,
  ) {
    return this.creationService.createInvoice(salesOrderId, dto, actor);
  }

  async createProjectInvoice(
    project: {
      projectId: string;
      projectNumber: string;
      customerId: string;
      currencyCode: string;
      name: string;
      tradingTermsId?: string | null;
    },
    dto: {
      invoiceDate?: string;
      notes?: string;
      lines: Array<{
        projectTaskId?: string;
        description: string;
        quantity: number;
        pricePerUnit: number;
        amount?: number;
        discountPercentage?: number;
        taxCategoryId?: string;
        productId?: string;
        glAccountId?: string;
        projectLedgerEntryId?: string;
      }>;
    },
    actor: string,
    tx?: DrizzleDB,
  ) {
    return this.projectService.createProjectInvoice(project, dto, actor, tx);
  }

  async findOne(invoiceId: string) {
    return this.queryService.findOne(invoiceId);
  }

  async findByOrder(salesOrderId: string) {
    return this.queryService.findByOrder(salesOrderId);
  }

  async findByProject(projectId: string) {
    return this.queryService.findByProject(projectId);
  }

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
    return this.queryService.findActiveInvoices(query);
  }

  // --- State Transitions & Administrative Operations ---

  async changeSalesInvoiceState(
    invoiceId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    return changeSalesInvoiceStateHelper(
      this.db,
      this.glService,
      this.logger,
      invoiceId,
      newState,
      actor,
      tx,
    );
  }

  async adminMarkPaid(invoiceId: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      if (
        invoice.stateCode === SALES_INVOICE_STATE.PAID ||
        invoice.stateCode === SALES_INVOICE_STATE.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot mark invoice as paid. Invoice is currently '${invoice.stateCode}'.`,
        );
      }

      const [updated] = await tx
        .update(salesInvoices)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Administrative override to bypass standard state machine logic
          stateCode: SALES_INVOICE_STATE.PAID,
          outstandingAmount: '0',
          baseOutstandingAmount: '0',
          modifiedOn: new Date(),
        })
        .where(eq(salesInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.SALES_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          entity: 'sales_invoice',
          entityId: invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          from: invoice.stateCode,
          to: SALES_INVOICE_STATE.PAID,
          note: 'Administrative override: Invoice manually marked as paid without GL impact',
        },
        actor,
      });

      return updated;
    });
  }
}
