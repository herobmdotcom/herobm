import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  suppliers as coreSuppliers,
  products,
  locations,
  taxCategories,
  organizations,
  supplierExpiries,
} from '@herobm/db-schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import {
  PURCHASE_ORDER_STATE,
  computeLinePriceForStorage,
  ORGANIZATION_STATE,
  PRODUCT_STATE,
  BACKORDER_STATE,
  normalizeUomCode,
  LineType,
  getErrorMessage,
} from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import { calculateAuditTrail, AuditMode } from '../common/audit';

import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import { PurchaseOrdersQueryService } from './purchase-orders-query.service';
import { BackordersService } from '../orders/backorders.service';
import { resolvePurchaseTaxForLine } from './purchase-orders-tax.utils';

@Injectable()
export class PurchaseOrdersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly suppliersService: SuppliersService,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly appConfig: AppConfigService,
    private readonly queryService: PurchaseOrdersQueryService,
    @Inject(forwardRef(() => BackordersService))
    private readonly backordersService: BackordersService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersWriteService.name);

  async resolveTaxForLine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    tx: any,
    vendorId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    return resolvePurchaseTaxForLine(
      tx,
      vendorId,
      this.suppliersService,
      this.taxResolutionEngine,
      this.appConfig,
      productId,
      taxCategoryIdOverride,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      if (!createDto.deliveryLocationId) {
        throw new BadRequestException(
          'Delivery location is mandatory for all purchase orders.',
        );
      }

      const [loc] = await tx
        .select()
        .from(locations)
        .where(eq(locations.locationId, createDto.deliveryLocationId))
        .limit(1);

      if (!loc) {
        throw new BadRequestException('Invalid delivery location ID.');
      }

      const [supplier] = await tx
        .select({ stateCode: organizations.stateCode })
        .from(coreSuppliers)
        .leftJoin(
          organizations,
          eq(coreSuppliers.organizationId, organizations.organizationId),
        )
        .where(eq(coreSuppliers.vendorId, createDto.vendorId))
        .limit(1);

      if (!supplier) {
        throw new BadRequestException('Supplier not found.');
      }
      if (supplier.stateCode !== ORGANIZATION_STATE.ACTIVE) {
        throw new BadRequestException(
          'Cannot create purchase order for an inactive supplier.',
        );
      }

      const expiredDocs = await tx
        .select({ id: supplierExpiries.expiryId })
        .from(supplierExpiries)
        .where(
          and(
            eq(supplierExpiries.vendorId, createDto.vendorId),
            sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
          ),
        )
        .limit(1);

      if (expiredDocs.length > 0) {
        throw new BadRequestException(
          'Supplier has expired compliance documentation. Cannot create purchase order.',
        );
      }

      const poCurrencyCode =
        createDto.currencyCode || this.appConfig.homeCurrency();
      const fx = await getExchangeRateForCurrency(
        tx as DrizzleDB,
        poCurrencyCode,
        createDto.orderDate ? new Date(createDto.orderDate) : new Date(),
      );

      let order;
      try {
        const [inserted] = await tx
          .insert(purchaseOrders)
          .values({
            purchaseOrderId: createDto.purchaseOrderId,
            orderNumber: createDto.orderNumber,
            name: createDto.name,
            vendorId: createDto.vendorId,
            currencyCode: poCurrencyCode,
            exchangeRate: fx.rate.toString(),
            notes: createDto.notes,
            createdBy: userId,
            stateCode: PURCHASE_ORDER_STATE.DRAFT,
            deliveryLocationId: createDto.deliveryLocationId,
            referenceNumber: createDto.referenceNumber,
            expectedDate: createDto.expectedDate
              ? new Date(createDto.expectedDate)
              : null,
            baseTotalAmount: '0',
          })
          .returning();
        order = inserted;
      } catch (err: unknown) {
        this.logger.error('PO INSERT ERROR:', getErrorMessage(err) || err);
        throw err;
      }

      if (createDto.lines && createDto.lines.length > 0) {
        const productIdsToValidate: string[] = [];
        for (const l of createDto.lines) {
          if (
            l.lineType !== LineType.COMMENT &&
            l.productId &&
            l.productId !== '00000000-0000-4000-8000-000000000000' &&
            !productIdsToValidate.includes(l.productId)
          ) {
            productIdsToValidate.push(l.productId);
          }
        }

        const productRows =
          productIdsToValidate.length > 0
            ? await tx
                .select({
                  productId: products.productId,
                  stateCode: products.stateCode,
                })
                .from(products)
                .where(inArray(products.productId, productIdsToValidate))
            : [];

        const productMap = new Map(productRows.map((p) => [p.productId, p]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        const lineValues: any[] = [];
        let index = 0;
        for (const line of createDto.lines) {
          const isComment = line.lineType === LineType.COMMENT;
          if (isComment) {
            lineValues.push({
              purchaseOrderId: order.purchaseOrderId,
              lineNumber: index + 1,
              lineType: LineType.COMMENT,
              productId: null,
              productDescription: line.productDescription,
              quantity: '0',
              pricePerUnit: '0',
              discountPercentage: '0',
              unitOfMeasure: null,
              amount: '0',
              tax: '0',
              totalAmount: '0',
              taxCategoryId: null,
            });
            index++;
            continue;
          }

          const isCustom =
            line.productId === '00000000-0000-4000-8000-000000000000';
          if (!isCustom && line.productId) {
            const product = productMap.get(line.productId);

            if (!product) {
              throw new BadRequestException(
                `Product '${line.productId}' not found.`,
              );
            }
            if (product.stateCode !== PRODUCT_STATE.ACTIVE) {
              throw new BadRequestException(
                `Cannot use product '${line.productId}' as it is not active.`,
              );
            }
          }

          const { taxCategoryId, rate } = await this.resolveTaxForLine(
            tx,
            createDto.vendorId,
            line.productId,
            line.taxCategoryId,
          );
          const disc = parseFloat(line.discountPercentage || '0');
          if (isNaN(disc) || disc < 0 || disc > 100) {
            throw new BadRequestException(
              `Line ${index + 1}: Discount percentage must be between 0 and 100`,
            );
          }
          const pricing = computeLinePriceForStorage({
            quantity: parseFloat(line.quantity || '0'),
            pricePerUnit: parseFloat(line.pricePerUnit || '0'),
            discountPercentage: disc,
            taxRate: rate,
          });

          lineValues.push({
            purchaseOrderId: order.purchaseOrderId,
            lineNumber: index + 1,
            lineType: LineType.PRODUCT,
            productId: line.productId,
            productDescription: line.productDescription,
            quantity: line.quantity.toString(),
            pricePerUnit: line.pricePerUnit.toString(),
            discountPercentage: line.discountPercentage?.toString() || '0',
            unitOfMeasure: normalizeUomCode(line.unitOfMeasure),
            amount: pricing.amount,
            tax: pricing.tax,
            totalAmount: pricing.totalAmount,
            taxCategoryId,
          });
          index++;
        }

        await tx.insert(purchaseOrderLineItems).values(lineValues);
      }

      const [vendor] = await tx
        .select({ name: organizations.name })
        .from(coreSuppliers)
        .leftJoin(
          organizations,
          eq(coreSuppliers.organizationId, organizations.organizationId),
        )
        .where(eq(coreSuppliers.vendorId, createDto.vendorId));

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: order.purchaseOrderId,
        eventType: EventType.CREATED,
        entityDisplayName: order.orderNumber,
        payload: {
          orderNumber: order.orderNumber,
          vendorId: createDto.vendorId,
          vendorName: vendor?.name,
          lineCount: createDto.lines?.length || 0,
        },
        actor: userId,
      });

      return this.queryService.findOne(order.purchaseOrderId, tx);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async addLine(orderId: string, lineDto: any, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      await tx
        .select({ id: purchaseOrders.purchaseOrderId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseOrderId, orderId))
        .for('update');

      const existing = await this.queryService.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only add lines to draft purchase orders',
        );
      }

      const maxLine = existing.lines.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        (max: number, l: any) => Math.max(max, l.lineNumber || 0),
        0,
      );

      const isComment = lineDto.lineType === (LineType.COMMENT as string);

      let taxCategoryId: string | null = null;
      let rate = 0;
      let qty = 0;
      let price = 0;
      let disc = 0;

      let pricing = {
        amount: '0',
        tax: '0',
        totalAmount: '0',
      };

      let product: { name: string; stateCode: string } | undefined;

      if (!isComment) {
        const result = await tx
          .select({ name: products.name, stateCode: products.stateCode })
          .from(products)
          .where(eq(products.productId, lineDto.productId))
          .limit(1);
        product = result[0];

        if (!product) {
          throw new BadRequestException(
            `Product '${lineDto.productId}' not found.`,
          );
        }
        if (product.stateCode !== PRODUCT_STATE.ACTIVE) {
          throw new BadRequestException(
            `Cannot use product '${lineDto.productId}' as it is not active.`,
          );
        }

        qty = parseFloat(lineDto.quantity || '1');
        price = parseFloat(lineDto.pricePerUnit || '0');
        disc = parseFloat(lineDto.discountPercentage || '0');
        if (isNaN(disc) || disc < 0 || disc > 100) {
          throw new BadRequestException(
            'Discount percentage must be between 0 and 100',
          );
        }
        const resolved = await this.resolveTaxForLine(
          tx,
          existing.vendorId,
          lineDto.productId,
          lineDto.taxCategoryId,
        );
        taxCategoryId = resolved.taxCategoryId;
        rate = resolved.rate;

        pricing = computeLinePriceForStorage({
          quantity: qty,
          pricePerUnit: price,
          discountPercentage: disc,
          taxRate: rate,
        });
      }

      await tx.insert(purchaseOrderLineItems).values({
        purchaseOrderId: orderId,
        lineNumber: maxLine + 1,
        lineType: isComment ? LineType.COMMENT : LineType.PRODUCT,
        productId: isComment ? null : lineDto.productId,
        productDescription: lineDto.productDescription,
        quantity: isComment ? '0' : lineDto.quantity?.toString() || '1',
        pricePerUnit: isComment ? '0' : lineDto.pricePerUnit?.toString() || '0',
        discountPercentage: isComment
          ? '0'
          : lineDto.discountPercentage?.toString() || '0',
        unitOfMeasure: isComment
          ? null
          : normalizeUomCode(lineDto.unitOfMeasure),
        amount: pricing.amount,
        tax: pricing.tax,
        totalAmount: pricing.totalAmount,
        taxCategoryId,
        quantityReceived: '0',
      });

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_ADDED,
        entityDisplayName: existing.orderNumber,
        payload: {
          productId: lineDto.productId,
          productName: product?.name,
          quantity: lineDto.quantity,
          pricePerUnit: lineDto.pricePerUnit,
        },
        actor,
      });

      return this.queryService.findOne(orderId, tx);
    });
  }

  async updateLine(
    orderId: string,
    lineId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    lineDto: any,
    actor: string = 'system',
  ) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.queryService.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only update lines on draft purchase orders',
        );
      }

      if (lineDto.discountPercentage !== undefined) {
        const disc = parseFloat(lineDto.discountPercentage.toString());
        if (isNaN(disc) || disc < 0 || disc > 100) {
          throw new BadRequestException(
            'Discount percentage must be between 0 and 100',
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const updateFields: any = {};
      if (lineDto.quantity !== undefined)
        updateFields.quantity = lineDto.quantity.toString();
      if (lineDto.pricePerUnit !== undefined)
        updateFields.pricePerUnit = lineDto.pricePerUnit.toString();
      if (lineDto.discountPercentage !== undefined)
        updateFields.discountPercentage = lineDto.discountPercentage.toString();
      if (lineDto.productDescription !== undefined)
        updateFields.productDescription = lineDto.productDescription;
      if (lineDto.unitOfMeasure !== undefined)
        updateFields.unitOfMeasure = lineDto.unitOfMeasure;
      if (lineDto.taxCategoryId !== undefined)
        updateFields.taxCategoryId = lineDto.taxCategoryId;

      if (
        lineDto.quantity !== undefined ||
        lineDto.pricePerUnit !== undefined ||
        lineDto.discountPercentage !== undefined ||
        lineDto.taxCategoryId !== undefined
      ) {
        const line = existing.lines.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          (l: any) => l.purchaseOrderLineId === lineId,
        );
        const isComment =
          (lineDto.lineType ?? line?.lineType) === (LineType.COMMENT as string);

        const qty = isComment
          ? 0
          : parseFloat(lineDto.quantity?.toString() || line?.quantity || '0');
        const price = isComment
          ? 0
          : parseFloat(
              lineDto.pricePerUnit?.toString() || line?.pricePerUnit || '0',
            );
        const disc = isComment
          ? 0
          : parseFloat(
              lineDto.discountPercentage?.toString() ||
                line?.discountPercentage ||
                '0',
            );

        let targetGst = line?.taxCategoryId;
        if (lineDto.taxCategoryId !== undefined) {
          targetGst = lineDto.taxCategoryId;
        }

        let rate = 0;
        if (!isComment) {
          const resolved = await this.resolveTaxForLine(
            tx,
            existing.vendorId,
            line?.productId,
            targetGst,
          );
          updateFields.taxCategoryId = resolved.taxCategoryId;
          rate = resolved.rate;
        } else {
          updateFields.taxCategoryId = null;
        }

        const pricing = isComment
          ? { amount: '0', tax: '0', totalAmount: '0' }
          : computeLinePriceForStorage({
              quantity: qty,
              pricePerUnit: price,
              discountPercentage: disc,
              taxRate: rate,
            });
        updateFields.amount = pricing.amount;
        updateFields.tax = pricing.tax;
        updateFields.totalAmount = pricing.totalAmount;
      }

      await tx
        .update(purchaseOrderLineItems)
        .set(updateFields)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_UPDATED,
        entityDisplayName: existing.orderNumber,
        payload: {
          lineId,
          changes: updateFields,
        },
        actor,
      });

      return this.queryService.findOne(orderId, tx);
    });
  }

  async removeLine(orderId: string, lineId: string, actor: string = 'system') {
    return await this.db.transaction(async (tx) => {
      const existing = await this.queryService.findOne(orderId, tx);
      if (existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT) {
        throw new BadRequestException(
          'Can only remove lines from draft purchase orders',
        );
      }

      await this.backordersService.unlinkDemandForPoLine(tx, lineId, actor);

      await tx
        .delete(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, lineId));

      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: orderId,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: existing.orderNumber,
        payload: { lineId },
        actor,
      });

      return this.queryService.findOne(orderId, tx);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async update(id: string, updateDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.queryService.findOne(id, tx);
      if (
        existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT &&
        existing.stateCode !== PURCHASE_ORDER_STATE.ORDERED &&
        existing.stateCode !== PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          `Cannot update purchase orders in state ${existing.stateCode}`,
        );
      }

      if (
        existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT &&
        updateDto.lines
      ) {
        throw new BadRequestException(
          'Cannot update lines on non-draft purchase orders',
        );
      }

      if (
        existing.stateCode !== PURCHASE_ORDER_STATE.DRAFT &&
        updateDto.currencyCode &&
        updateDto.currencyCode !== existing.currencyCode
      ) {
        throw new BadRequestException(
          'Cannot update currency on non-draft purchase orders',
        );
      }

      await tx
        .update(purchaseOrders)
        .set({
          name: updateDto.name,
          vendorId: updateDto.vendorId,
          currencyCode: updateDto.currencyCode,
          notes: updateDto.notes,
          // eslint-disable-next-line no-restricted-syntax -- External API integration boundaries where exact types are unknown.
          stateCode: updateDto.stateCode,
          deliveryLocationId: updateDto.deliveryLocationId,
          referenceNumber: updateDto.referenceNumber,
          expectedDate: updateDto.expectedDate
            ? new Date(updateDto.expectedDate)
            : null,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseOrders.purchaseOrderId, id));

      if (updateDto.lines) {
        await tx
          .delete(purchaseOrderLineItems)
          .where(eq(purchaseOrderLineItems.purchaseOrderId, id));

        if (updateDto.lines.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const lineValues: any[] = [];
          let index = 0;
          for (const line of updateDto.lines) {
            const qty = parseFloat(line.quantity || '0');
            const price = parseFloat(line.pricePerUnit || '0');
            const disc = parseFloat(line.discountPercentage || '0');
            const { taxCategoryId, rate } = await this.resolveTaxForLine(
              tx,
              existing.vendorId,
              line.productId,
              line.taxCategoryId,
            );
            const pricing = computeLinePriceForStorage({
              quantity: qty,
              pricePerUnit: price,
              discountPercentage: disc,
              taxRate: rate,
            });
            lineValues.push({
              purchaseOrderId: id,
              lineNumber: index + 1,
              productId: line.productId,
              productDescription: line.productDescription,
              quantity: line.quantity.toString(),
              pricePerUnit: line.pricePerUnit.toString(),
              unitOfMeasure: line.unitOfMeasure || 'EA',
              amount: pricing.amount,
              tax: pricing.tax,
              totalAmount: pricing.totalAmount,
              taxCategoryId,
            });
            index++;
          }
          await tx.insert(purchaseOrderLineItems).values(lineValues);
        }

        const audit = calculateAuditTrail(updateDto, existing, AuditMode.DIFF);
        if (audit.hasChanges) {
          await emitEvent(tx as unknown as DrizzleDB, {
            entityType: EntityType.PURCHASE_ORDER,
            entityId: id,
            eventType: EventType.UPDATED,
            entityDisplayName: existing.orderNumber,
            payload: {
              changes: audit.changes,
              previousValues: audit.previousValues,
              linesCount: updateDto.lines?.length,
            },
            actor: userId,
          });
        }
      }

      return this.queryService.findOne(id, tx);
    });
  }

  /**
   * Record received quantities on purchase order lines and synchronize PO lifecycle state.
   * @herobm-skip-audit - Line receipt updates delegated within goods received transaction; state change emits EventType.STATUS_CHANGED
   */
  async recordReceiptQuantities(
    tx: DrizzleDB,
    receipts: { purchaseOrderLineId: string; quantity: number }[],
    actor: string = 'system',
  ) {
    if (!receipts || receipts.length === 0) return;

    const touchedPoIds = new Set<string>();

    for (const receipt of receipts) {
      if (receipt.quantity <= 0) continue;

      const [poLine] = await tx
        .select({
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
          quantity: purchaseOrderLineItems.quantity,
          quantityReceived: purchaseOrderLineItems.quantityReceived,
        })
        .from(purchaseOrderLineItems)
        .where(
          eq(
            purchaseOrderLineItems.purchaseOrderLineId,
            receipt.purchaseOrderLineId,
          ),
        );

      if (!poLine) {
        throw new NotFoundException(
          `Purchase Order Line ${receipt.purchaseOrderLineId} not found`,
        );
      }

      await tx
        .update(purchaseOrderLineItems)
        .set({
          quantityReceived: sql`CAST(COALESCE(quantity_received, '0') AS NUMERIC) + CAST(${receipt.quantity} AS NUMERIC)`,
        })
        .where(
          eq(
            purchaseOrderLineItems.purchaseOrderLineId,
            receipt.purchaseOrderLineId,
          ),
        );

      touchedPoIds.add(poLine.purchaseOrderId);
    }

    for (const poId of touchedPoIds) {
      await this.syncReceiptState(tx, poId, actor, 'goods_receipt', false);
    }
  }

  private async syncReceiptState(
    tx: DrizzleDB,
    poId: string,
    actor: string,
    reason: string,
    fallbackToOrdered = false,
  ) {
    const [po] = await tx
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: purchaseOrders.stateCode,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (!po) return;

    const allLines = await tx
      .select({
        quantity: purchaseOrderLineItems.quantity,
        quantityReceived: purchaseOrderLineItems.quantityReceived,
      })
      .from(purchaseOrderLineItems)
      .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

    const isFullyReceived =
      allLines.length > 0 &&
      allLines.every(
        (l) => parseFloat(l.quantityReceived || '0') >= parseFloat(l.quantity),
      );

    const hasPartialReceipt = allLines.some(
      (l) => parseFloat(l.quantityReceived || '0') > 0,
    );

    const newState = isFullyReceived
      ? PURCHASE_ORDER_STATE.RECEIVED
      : hasPartialReceipt
        ? PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED
        : fallbackToOrdered
          ? PURCHASE_ORDER_STATE.ORDERED
          : po.stateCode;

    if (newState !== po.stateCode) {
      await this.changePurchaseOrderState(tx, poId, newState, actor, reason);
    }
  }

  /**
   * Formal state transition helper for Purchase Orders.
   * Ensures transitions follow state machine and emits domain events.
   */
  async changePurchaseOrderState(
    tx: DrizzleDB,
    poId: string,
    newState: string,
    actor: string,
    reason?: string,
  ) {
    const [po] = await tx
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: purchaseOrders.stateCode,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    if (!po) {
      throw new NotFoundException(`Purchase Order ${poId} not found`);
    }

    if (newState === po.stateCode) return;

    await tx
      .update(purchaseOrders)
      .set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle enum mismatch
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, poId));

    await emitEvent(tx, {
      entityType: EntityType.PURCHASE_ORDER,
      entityId: poId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: po.orderNumber,
      actor,
      payload: {
        fromState: po.stateCode,
        toState: newState,
        reason,
      },
    });
  }

  /**
   * Revert receipt quantities on purchase order lines (e.g. during goods receipt cancellation or purchase return).
   * @herobm-skip-audit - Line receipt reversals delegated within return/cancellation transaction; state change emits EventType.STATUS_CHANGED
   */
  async revertReceiptQuantities(
    tx: DrizzleDB,
    reversals: { purchaseOrderLineId: string; quantity: number }[],
    actor: string = 'system',
  ) {
    if (!reversals || reversals.length === 0) return;

    const touchedPoIds = new Set<string>();

    for (const reversal of reversals) {
      if (reversal.quantity <= 0) continue;

      const [poLine] = await tx
        .select({
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
        })
        .from(purchaseOrderLineItems)
        .where(
          eq(
            purchaseOrderLineItems.purchaseOrderLineId,
            reversal.purchaseOrderLineId,
          ),
        );

      if (!poLine) continue;

      await tx
        .update(purchaseOrderLineItems)
        .set({
          quantityReceived: sql`GREATEST(0, CAST(COALESCE(quantity_received, '0') AS NUMERIC) - CAST(${reversal.quantity} AS NUMERIC))`,
        })
        .where(
          eq(
            purchaseOrderLineItems.purchaseOrderLineId,
            reversal.purchaseOrderLineId,
          ),
        );

      touchedPoIds.add(poLine.purchaseOrderId);
    }

    for (const poId of touchedPoIds) {
      await this.syncReceiptState(tx, poId, actor, 'receipt_reversal', true);
    }
  }

  /**
   * Create a draft Purchase Order and its lines from backorder demand requisition.
   */
  async createFromRequisition(
    tx: DrizzleDB,
    params: {
      orderNumber: string;
      vendorId: string;
      deliveryLocationId: string;
      currencyCode: string;
      notes: string;
      actor: string;
      lines: {
        productId: string;
        productDescription?: string;
        quantity: string;
        pricePerUnit: string;
        taxCategoryId: string;
      }[];
    },
  ): Promise<{
    purchaseOrder: typeof purchaseOrders.$inferSelect;
    lineItems: (typeof purchaseOrderLineItems.$inferSelect)[];
  }> {
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        orderNumber: params.orderNumber,
        name: `Requisition PO ${params.orderNumber}`,
        vendorId: params.vendorId,
        deliveryLocationId: params.deliveryLocationId,
        stateCode: PURCHASE_ORDER_STATE.DRAFT,
        currencyCode: params.currencyCode,
        notes: params.notes,
        createdBy: params.actor,
        baseTotalAmount: '0',
        exchangeRate: '1',
      })
      .returning();

    await emitEvent(tx, {
      entityType: EntityType.PURCHASE_ORDER,
      entityId: po.purchaseOrderId,
      eventType: EventType.CREATED,
      entityDisplayName: params.orderNumber,
      actor: params.actor,
      payload: { reason: 'manual_requisition' },
    });

    const createdLines = params.lines.map((line, idx) => ({
      purchaseOrderId: po.purchaseOrderId,
      lineNumber: idx + 1,
      productId: line.productId,
      productDescription: line.productDescription,
      quantity: line.quantity,
      pricePerUnit: line.pricePerUnit,
      taxCategoryId: line.taxCategoryId,
      discountPercentage: '0',
      amount: '0',
      tax: '0',
      quantityReceived: '0',
    }));

    const poLines =
      createdLines.length > 0
        ? await tx
            .insert(purchaseOrderLineItems)
            .values(createdLines)
            .returning()
        : [];

    return { purchaseOrder: po, lineItems: poLines };
  }
}
