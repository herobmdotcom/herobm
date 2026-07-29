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
} from '../drizzle/schema';
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
export class OrderLinesService {
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

  private readonly logger = new Logger(OrderLinesService.name);
  // ABM tax_category text mapping has been migrated directly into herobm_core.products schema
  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Add a line item to an existing order.
   */
  async addLine(orderId: string, dto: AddLineDto, actor: string) {
    const order = await this.ordersQueryService.findOrder(orderId);

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      throw new BadRequestException(
        `Cannot add lines to order in state '${order.stateCode}'`,
      );
    }

    const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
    if (dto.productId) {
      await this.coreService.validateProduct(dto.productId);

      // Check if product already exists in this order (exempting Custom Lines)
      if (dto.productId !== CUSTOM_LINE_ID) {
        const existingLine = await this.db
          .select({ id: salesOrderLineItems.salesOrderLineId })
          .from(salesOrderLineItems)
          .where(
            sql`${salesOrderLineItems.salesOrderId} = ${orderId} AND ${salesOrderLineItems.productId} = ${dto.productId}`,
          )
          .limit(1);

        if (existingLine.length > 0) {
          throw new BadRequestException(
            `Product '${dto.productId}' is already present in this order.`,
          );
        }
      }
    }

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.coreService.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const isExternalTax = lineTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : lineTax.rate;

    const lineDiscount = dto.discountPercentage ?? '0';

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Lock the order to prevent concurrent addLine races
      await tx
        .select({ id: salesOrders.salesOrderId })
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, orderId))
        .for('update');

      // 2. Get next line number safely within the transaction
      const maxLine = await tx
        .select({
          max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)`,
        })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderId, orderId));

      let currentLineNumber = (maxLine[0]?.max ?? 0) + 1;

      let isKit = false;
      const parentPrice = parseFloat(dto.pricePerUnit || '0');
      if (dto.productId) {
        const prodInfo = await this.coreService.lookupProduct(
          dto.productId,
          tx,
        );
        if (prodInfo.structureType === 'kit') {
          isKit = true;
        }
      }

      const parentLineId = randomUUID();
      const insertValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
      let parentLine: typeof salesOrderLineItems.$inferInsert | null = null;

      if (isKit) {
        const parentPriceToUse = parentPrice > 0 ? parentPrice.toString() : '0';
        const parentComputed = this.coreService.computeLineAmount(
          dto.quantity,
          parentPriceToUse,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: parentPriceToUse,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: parentComputed.amount,
          tax: parentComputed.tax,
          totalAmount: parentComputed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          parentLineId: null,
        };
        insertValues.push(parentLine);

        const components = await this.coreService.getKitComponents(
          dto.productId!,
          tx,
        );
        for (const comp of components) {
          const compTax = await this.coreService.resolveTaxForLine(
            order.customerId ?? '',
            comp.childProductId,
            undefined,
            tx,
          );

          const childQtyStr = this.coreService.calculateComponentQuantity(
            dto.quantity,
            comp.quantity,
            comp.parentQuantity || '1',
            comp.fractionalBehavior || 'allow_fractional',
            dto.productId!,
          );

          let childPrice = '0';
          if (parentPrice <= 0) {
            childPrice = comp.listPrice || '0';
          }

          const childComputed = this.coreService.computeLineAmount(
            childQtyStr,
            childPrice,
            '0',
            compTax.rate,
          );

          insertValues.push({
            salesOrderLineId: randomUUID(),
            salesOrderId: orderId,
            lineNumber: currentLineNumber++,
            productId: comp.childProductId,
            productDescription: comp.name,
            quantity: childQtyStr,
            pricePerUnit: childPrice,
            discountPercentage: '0',
            taxCategoryId: compTax.taxCategoryId,
            amount: childComputed.amount,
            tax: childComputed.tax,
            totalAmount: childComputed.totalAmount,
            unitOfMeasure: comp.baseUom || 'EA',
            fulfillmentLocationId: order.fulfillmentLocationId,
            parentLineId: parentLineId,
          });
        }
      } else {
        const computed = this.coreService.computeLineAmount(
          dto.quantity,
          dto.pricePerUnit,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: dto.pricePerUnit,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          parentLineId: null,
        };
        insertValues.push(parentLine);
      }

      await tx.insert(salesOrderLineItems).values(insertValues);

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.coreService.setTaxIsStale(orderId, isExternalTax, tx);

      const [[product], [taxCategory]] = await Promise.all([
        dto.productId
          ? tx
              .select({ name: coreProducts.name })
              .from(coreProducts)
              .where(eq(coreProducts.productId, dto.productId))
          : Promise.resolve([null]),
        taxCategoryId
          ? tx
              .select({ title: taxCategories.title })
              .from(taxCategories)
              .where(eq(taxCategories.taxCategoryId, taxCategoryId))
          : Promise.resolve([null]),
      ]);

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: order.orderNumber,
        payload: {
          lineId: parentLineId,
          productId: dto.productId,
          productName: product?.name,
          quantity: dto.quantity,
          taxCategoryId,
          taxCategoryName: taxCategory?.title,
        },
        actor,
      });

      return parentLine;
    });

    return result;
  }

  /**
   * Add a line item post-confirmation explicitly natively without state locking.
   */
  async addPostConfirmationLine(
    orderId: string,
    dto: AddLineDto,
    actor: string,
  ) {
    const order = await this.ordersQueryService.findOrder(orderId);

    if (
      [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
        order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
      )
    ) {
      throw new BadRequestException(
        `Cannot add post-confirmation lines to order in state '${order.stateCode}'`,
      );
    }

    const CUSTOM_LINE_ID = '00000000-0000-4000-8000-000000000000';
    if (dto.productId) {
      await this.coreService.validateProduct(dto.productId);

      // Check if product already exists in this order (exempting Custom Lines)
      if (dto.productId !== CUSTOM_LINE_ID) {
        const existingLine = await this.db
          .select({ id: salesOrderLineItems.salesOrderLineId })
          .from(salesOrderLineItems)
          .where(
            sql`${salesOrderLineItems.salesOrderId} = ${orderId} AND ${salesOrderLineItems.productId} = ${dto.productId}`,
          )
          .limit(1);

        if (existingLine.length > 0) {
          throw new BadRequestException(
            `Product '${dto.productId}' is already present in this order.`,
          );
        }
      }
    }

    // Get next line number
    const maxLine = await this.db
      .select({
        max: sql<number>`COALESCE(MAX(${salesOrderLineItems.lineNumber}), 0)`,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId));

    let currentLineNumber = (maxLine[0]?.max ?? 0) + 1;

    // Resolve GST: product × customer intersection, with per-line override
    const lineTax = await this.coreService.resolveTaxForLine(
      order.customerId ?? '',
      dto.productId,
      dto.taxCategoryId,
    );
    const taxCategoryId = lineTax.taxCategoryId;
    const isExternalTax = lineTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : lineTax.rate;

    const lineDiscount = dto.discountPercentage ?? '0';

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      let isKit = false;
      const parentPrice = parseFloat(dto.pricePerUnit || '0');
      if (dto.productId) {
        const prodInfo = await this.coreService.lookupProduct(
          dto.productId,
          tx,
        );
        if (prodInfo.structureType === 'kit') {
          isKit = true;
        }
      }

      const parentLineId = randomUUID();
      const insertValues: (typeof salesOrderLineItems.$inferInsert)[] = [];
      let parentLine: typeof salesOrderLineItems.$inferInsert | null = null;

      if (isKit) {
        const parentPriceToUse = parentPrice > 0 ? parentPrice.toString() : '0';
        const parentComputed = this.coreService.computeLineAmount(
          dto.quantity,
          parentPriceToUse,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: parentPriceToUse,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: parentComputed.amount,
          tax: parentComputed.tax,
          totalAmount: parentComputed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          isPostConfirmation: true,
          parentLineId: null,
        };
        insertValues.push(parentLine);

        const components = await this.coreService.getKitComponents(
          dto.productId!,
          tx,
        );
        for (const comp of components) {
          const compTax = await this.coreService.resolveTaxForLine(
            order.customerId ?? '',
            comp.childProductId,
            undefined,
            tx,
          );

          const childQtyStr = this.coreService.calculateComponentQuantity(
            dto.quantity,
            comp.quantity,
            comp.parentQuantity || '1',
            comp.fractionalBehavior || 'allow_fractional',
            dto.productId!,
          );

          let childPrice = '0';
          if (parentPrice <= 0) {
            childPrice = comp.listPrice || '0';
          }

          const childComputed = this.coreService.computeLineAmount(
            childQtyStr,
            childPrice,
            '0',
            compTax.rate,
          );

          insertValues.push({
            salesOrderLineId: randomUUID(),
            salesOrderId: orderId,
            lineNumber: currentLineNumber++,
            productId: comp.childProductId,
            productDescription: comp.name,
            quantity: childQtyStr,
            pricePerUnit: childPrice,
            discountPercentage: '0',
            taxCategoryId: compTax.taxCategoryId,
            amount: childComputed.amount,
            tax: childComputed.tax,
            totalAmount: childComputed.totalAmount,
            unitOfMeasure: comp.baseUom || 'EA',
            fulfillmentLocationId: order.fulfillmentLocationId,
            isPostConfirmation: true,
            parentLineId: parentLineId,
          });
        }
      } else {
        const computed = this.coreService.computeLineAmount(
          dto.quantity,
          dto.pricePerUnit,
          lineDiscount,
          taxRate,
        );

        parentLine = {
          salesOrderLineId: parentLineId,
          salesOrderId: orderId,
          lineNumber: currentLineNumber++,
          productId: dto.productId,
          productDescription: dto.productDescription,
          quantity: dto.quantity,
          pricePerUnit: dto.pricePerUnit,
          discountPercentage: lineDiscount,
          taxCategoryId,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
          unitOfMeasure: dto.unitOfMeasure,
          fulfillmentLocationId: order.fulfillmentLocationId,
          isPostConfirmation: true,
          parentLineId: null,
        };
        insertValues.push(parentLine);
      }

      await tx.insert(salesOrderLineItems).values(insertValues);

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.coreService.setTaxIsStale(orderId, isExternalTax, tx);

      const [[product], [taxCategory]] = await Promise.all([
        dto.productId
          ? tx
              .select({ name: coreProducts.name })
              .from(coreProducts)
              .where(eq(coreProducts.productId, dto.productId))
          : Promise.resolve([null]),
        taxCategoryId
          ? tx
              .select({ title: taxCategories.title })
              .from(taxCategories)
              .where(eq(taxCategories.taxCategoryId, taxCategoryId))
          : Promise.resolve([null]),
      ]);

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.POST_CONFIRMATION_LINE_ADDED,
        entityDisplayName: order.orderNumber,
        payload: {
          lineId: parentLineId,
          productId: dto.productId,
          productName: product?.name,
          quantity: dto.quantity,
          taxCategoryId,
          taxCategoryName: taxCategory?.title,
          pricePerUnit: dto.pricePerUnit,
        },
        actor,
      });

      return parentLine;
    });

    return result;
  }

  /**
   * Update a line item.
   */
  async updateLine(
    orderId: string,
    lineId: string,
    dto: UpdateLineDto,
    actor: string,
  ) {
    const order = await this.ordersQueryService.findOrder(orderId);
    const existingLine = await this.ordersQueryService.findLine(
      lineId,
      orderId,
    );

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        )
      ) {
        throw new BadRequestException(
          `Cannot update normal lines on order in state '${order.stateCode}'`,
        );
      }
    }

    // Resolve GST: DTO override → existing line category → default product/customer resolution
    const resolvedTax = await this.coreService.resolveTaxForLine(
      order.customerId ?? '',
      existingLine.productId ?? undefined,
      dto.taxCategoryId ?? existingLine.taxCategoryId ?? undefined,
    );
    const taxCategoryId = resolvedTax.taxCategoryId;
    const isExternalTax = resolvedTax.taxProvider !== 'internal';
    const taxRate = isExternalTax ? 0 : resolvedTax.rate;

    const quantity = dto.quantity ?? existingLine.quantity;
    const pricePerUnit = dto.pricePerUnit ?? existingLine.pricePerUnit;
    const discountPercentage =
      dto.discountPercentage ?? existingLine.discountPercentage ?? '0';

    const computed = this.coreService.computeLineAmount(
      quantity,
      pricePerUnit,
      discountPercentage,
      taxRate,
    );

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existingLine, AuditMode.DIFF);

      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({
          ...audit.changes,
          amount: computed.amount,
          tax: computed.tax,
          totalAmount: computed.totalAmount,
        })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      // Proactively propagate updates to child component lines if this is a parent kit
      const childLines = await tx
        .select()
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.parentLineId, lineId));

      if (childLines.length > 0) {
        const oldParentQty = parseFloat(existingLine.quantity);
        const newParentQty = parseFloat(quantity);
        const qtyRatio = oldParentQty !== 0 ? newParentQty / oldParentQty : 0;

        const newParentPrice = parseFloat(pricePerUnit);

        for (const child of childLines) {
          const newChildQty = parseFloat(child.quantity) * qtyRatio;
          let newChildPrice = parseFloat(child.pricePerUnit);

          if (dto.pricePerUnit !== undefined) {
            if (newParentPrice > 0) {
              newChildPrice = 0;
            } else {
              const childProd = await this.coreService.lookupProduct(
                child.productId!,
                tx,
              );
              newChildPrice = parseFloat(childProd.listPrice || '0');
            }
          }

          const childTax = await this.coreService.resolveTaxForLine(
            order.customerId ?? '',
            child.productId ?? undefined,
            undefined,
            tx,
          );

          const childComputed = this.coreService.computeLineAmount(
            newChildQty.toString(),
            newChildPrice.toString(),
            child.discountPercentage ?? '0',
            childTax.rate,
          );

          await tx
            .update(salesOrderLineItems)
            .set({
              quantity: newChildQty.toString(),
              pricePerUnit: newChildPrice.toString(),
              amount: childComputed.amount,
              tax: childComputed.tax,
              totalAmount: childComputed.totalAmount,
            })
            .where(
              eq(salesOrderLineItems.salesOrderLineId, child.salesOrderLineId),
            );
        }
      }

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await this.coreService.setTaxIsStale(orderId, isExternalTax, tx);

      if (audit.hasChanges) {
        await emitEvent(tx, {
          entityType: EntityType.SALES_ORDER,
          entityId: orderId,
          eventType: EventType.LINE_UPDATED,
          entityDisplayName: order.orderNumber,
          payload: {
            lineId,
            changes: audit.changes,
            previousValues: audit.previousValues,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  /**
   * Remove a line item.
   */
  async removeLine(orderId: string, lineId: string, actor: string) {
    const order = await this.ordersQueryService.findOrder(orderId);
    const existingLine = await this.ordersQueryService.findLine(
      lineId,
      orderId,
    );

    if (
      [
        SALES_ORDER_STATE.INVOICED,
        SALES_ORDER_STATE.SHIPPED,
        SALES_ORDER_STATE.CANCELLED,
      ].includes(order.stateCode as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
    ) {
      const isPostConfLine = existingLine.isPostConfirmation === true;
      if (
        !isPostConfLine ||
        [SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.CANCELLED].includes(
          order.stateCode as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        )
      ) {
        throw new BadRequestException(
          `Cannot remove normal lines from order in state '${order.stateCode}'`,
        );
      }
    }

    await this.db.transaction(async (tx: DrizzleDB) => {
      // Find all child component lines of this line if it's a parent kit
      const childLines = await tx
        .select({ id: salesOrderLineItems.salesOrderLineId })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.parentLineId, lineId));

      const childLineIds = childLines.map((c) => c.id);

      if (childLineIds.length > 0) {
        // Delete child backorders
        await tx
          .delete(backorders)
          .where(inArray(backorders.salesOrderLineId, childLineIds));

        // Delete child lines
        await tx
          .delete(salesOrderLineItems)
          .where(inArray(salesOrderLineItems.salesOrderLineId, childLineIds));
      }

      // Delete associated demand records for parent
      await tx
        .delete(backorders)
        .where(eq(backorders.salesOrderLineId, lineId));

      // Delete parent line
      await tx
        .delete(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId));

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      const resolvedTax = await this.coreService.resolveTaxForLine(
        order.customerId ?? '',
        existingLine.productId ?? undefined,
        undefined,
        tx,
      );
      const isExternalTax = resolvedTax.taxProvider !== 'internal';
      await this.coreService.setTaxIsStale(orderId, isExternalTax, tx);

      const [product] = existingLine.productId
        ? await tx
            .select({ name: coreProducts.name })
            .from(coreProducts)
            .where(eq(coreProducts.productId, existingLine.productId))
        : [null];

      await emitEvent(tx, {
        entityType: EntityType.SALES_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: order.orderNumber,
        payload: {
          lineId,
          productId: existingLine.productId,
          productName: product?.name,
          quantity: existingLine.quantity,
        },
        actor,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
}
