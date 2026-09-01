import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  suppliers as coreSuppliers,
  products,
  locations,
  backorders,
  taxCategories,
  supplierExpiries,
  appSettings,
  actors,
} from '@herobm/db-schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { getErrorMessage, LineType } from '@herobm/shared';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import {
  PURCHASE_ORDER_STATE,
  computeLinePriceForStorage,
  ACTOR_STATE,
  PRODUCT_STATE,
  BACKORDER_STATE,
  normalizeUomCode,
} from '@herobm/shared';

import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { TaxResolutionEngine } from '../tax/tax-resolution.engine';
import { PurchaseOrdersQueryService } from './purchase-orders-query.service';

@Injectable()
export class PurchaseOrdersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly suppliersService: SuppliersService,
    private readonly taxService: TaxCategoriesService,
    private readonly taxResolutionEngine: TaxResolutionEngine,
    private readonly appConfig: AppConfigService,
    private readonly queryService: PurchaseOrdersQueryService,
  ) {}

  private readonly logger = new Logger(PurchaseOrdersWriteService.name);

  async resolveTaxForLine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    tx: any,
    vendorId: string,
    productId?: string,
    taxCategoryIdOverride?: string,
  ): Promise<{ taxCategoryId: string; rate: number }> {
    const supplier = await this.suppliersService.findOne(vendorId, tx);

    const resolvedTaxCategoryId =
      await this.taxResolutionEngine.resolveTaxCategory(
        {
          isPurchase: true,
          isTaxRegistered:
            ((supplier as Record<string, unknown>)
              .isTaxRegistered as boolean) || false,
          partyTaxPositionId:
            supplier.taxPositionId ||
            ((supplier as Record<string, unknown>)
              .supplierGroupTaxPositionId as string | undefined) ||
            this.appConfig.getAppSettingsRaw()?.defaultSupplierTaxPositionId ||
            null,
          productId:
            productId === '00000000-0000-4000-8000-000000000000'
              ? null
              : productId || null,
          productDefaultTaxCategoryId: null,
          manualOverrideTaxCategoryId: taxCategoryIdOverride || null,
        },
        tx,
      );

    if (resolvedTaxCategoryId) {
      try {
        const catRows = await tx
          .select()
          .from(taxCategories)
          .where(eq(taxCategories.taxCategoryId, resolvedTaxCategoryId))
          .limit(1);
        if (catRows.length > 0) {
          return {
            taxCategoryId: catRows[0].taxCategoryId,
            rate: parseFloat(catRows[0].rate ?? '0'),
          };
        }
      } catch (err) {
        // Ignore and fallback
      }
    }

    const defaultSettings = await tx
      .select({ taxCategoryId: appSettings.defaultPurchaseTaxCategoryId })
      .from(appSettings)
      .limit(1);

    if (defaultSettings.length > 0 && defaultSettings[0].taxCategoryId) {
      const catRows = await tx
        .select()
        .from(taxCategories)
        .where(
          eq(taxCategories.taxCategoryId, defaultSettings[0].taxCategoryId),
        )
        .limit(1);

      if (catRows.length > 0) {
        return {
          taxCategoryId: catRows[0].taxCategoryId,
          rate: parseFloat(catRows[0].rate ?? '0'),
        };
      }
    }

    const fallbacks = await tx
      .select()
      .from(taxCategories)
      .where(
        inArray(taxCategories.code, ['GST', 'INPUT', 'STANDARD', 'VAT', 'TAX']),
      )
      .limit(1);

    if (fallbacks.length > 0) {
      return {
        taxCategoryId: fallbacks[0].taxCategoryId,
        rate: parseFloat(fallbacks[0].rate ?? '0'),
      };
    }

    const anyCat = await tx.select().from(taxCategories).limit(1);
    if (anyCat.length > 0) {
      return {
        taxCategoryId: anyCat[0].taxCategoryId,
        rate: parseFloat(anyCat[0].rate ?? '0'),
      };
    }

    return { taxCategoryId: '', rate: 0 };
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
        .select({ stateCode: actors.stateCode })
        .from(coreSuppliers)
        .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
        .where(eq(coreSuppliers.vendorId, createDto.vendorId))
        .limit(1);

      if (!supplier) {
        throw new BadRequestException('Supplier not found.');
      }
      if (supplier.stateCode !== ACTOR_STATE.ACTIVE) {
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
        console.error('PO INSERT ERROR:', getErrorMessage(err) || err);
        throw err;
      }

      if (createDto.lines && createDto.lines.length > 0) {
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
            const [product] = await tx
              .select({ stateCode: products.stateCode })
              .from(products)
              .where(eq(products.productId, line.productId))
              .limit(1);

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
        .select({ name: actors.name })
        .from(coreSuppliers)
        .leftJoin(actors, eq(coreSuppliers.actorId, actors.actorId))
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

      await tx
        .update(backorders)
        .set({
          purchaseOrderId: null,
          purchaseOrderLineId: null,
          // eslint-disable-next-line no-restricted-syntax -- Reverting unfulfilled backorders to PENDING_SUPPLY upon line removal
          stateCode: BACKORDER_STATE.PENDING_SUPPLY,
        })
        .where(eq(backorders.purchaseOrderLineId, lineId));

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
}
