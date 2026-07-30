import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  masterDataEvents,
  productUoms,
  productDefaultBins,
  productComponents,
  productSuppliers,
  bins,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PRODUCT_TRANSITIONS,
  PRODUCT_STATE,
  ProductState,
} from '@herobm/shared';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import {
  CreateProductDto,
  UpdateProductDto,
  AddSupplierDto,
  LinkBinDto,
} from './dto';

@Injectable()
export class ProductsWriteService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(ProductsWriteService.name);

  async create(dto: CreateProductDto, actor: string) {
    if (dto.structureType === 'kit' && dto.productType !== 'non-stock') {
      throw new BadRequestException(
        'Kits must be stored as non-stock products.',
      );
    }
    console.log('[DEBUG] ProductsWriteService.create starting transaction');
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      console.log(
        '[DEBUG] ProductsWriteService.create inside transaction, inserting product',
      );
      const [product] = await tx
        .insert(coreProducts)
        .values({
          ...dto,
          productType: dto.productType ?? 'inventory',
          stateCode: (dto.stateCode as ProductState) ?? PRODUCT_STATE.ACTIVE,
          createdBy: actor,
          source: 'app',
          structureType: 'standard',
        })
        .returning();

      console.log('[DEBUG] ProductsWriteService.create emitting event');
      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: product.productId,
        eventType: EventType.CREATED,
        entityDisplayName: product.name,
        payload: dto,
        actor,
      });

      console.log('[DEBUG] ProductsWriteService.create returning product');
      return product;
    });

    this.logger.log(
      `Product created: ${dto.productNumber} (ID: ${result.productId}) by ${actor}`,
    );
    return result;
  }

  /**
   * Update a product.
   */
  async update(id: string, dto: UpdateProductDto, actor: string) {
    const existing = await this.db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Product '${id}' not found`);
    }

    const finalStructureType = dto.structureType ?? existing[0].structureType;
    const finalProductType = dto.productType ?? existing[0].productType;
    if (finalStructureType === 'kit' && finalProductType !== 'non-stock') {
      throw new BadRequestException(
        'Kits must be stored as non-stock products.',
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existing[0], AuditMode.DIFF);

      const [updated] = await tx
        .update(coreProducts)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        })
        .where(eq(coreProducts.productId, id))
        .returning();

      if (audit.hasChanges) {
        // Specialized event for status change
        if (
          audit.changes.stateCode !== undefined &&
          Object.keys(audit.changes).length === 1
        ) {
          await emitEvent(tx, {
            entityType: EntityType.PRODUCT,
            entityId: id,
            eventType: EventType.STATUS_CHANGED,
            entityDisplayName: updated.name,
            payload: {
              from: existing[0].stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await emitEvent(tx, {
            entityType: EntityType.PRODUCT,
            entityId: id,
            eventType: EventType.UPDATED,
            entityDisplayName: updated.name,
            payload: {
              changes: audit.changes,
              previousValues: audit.previousValues,
            },
            actor,
          });
        }
      }

      return updated;
    });

    this.logger.log(`Product updated: ${id} by ${actor}`);
    return result;
  }

  /**
   * Archive a product.
   */
  async archive(id: string, actor: string) {
    return await this.changeProductState(id, PRODUCT_STATE.ARCHIVED, actor);
  }

  /**
   * Unarchive a product.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Product '${id}' not found`);
    }

    if (existing[0].stateCode !== PRODUCT_STATE.ARCHIVED) {
      throw new BadRequestException(`Product '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(masterDataEvents)
      .where(
        sql`${masterDataEvents.entityId} = ${id} AND ${masterDataEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${masterDataEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      PRODUCT_STATE.ACTIVE;

    return await this.changeProductState(
      id,
      previousState as ProductState,
      actor,
    );
  }

  /**
   * Centralised state transition logic for products.
   */
  async changeProductState(
    productId: string,
    newState: ProductState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    const [existing] = await db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Product '${productId}' not found`);
    }

    const currentState = existing.stateCode;

    if (currentState === newState) {
      return existing;
    }

    // Validation
    const allowed = PRODUCT_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Invalid product state transition: '${currentState}' -> '${newState}'. Valid next states: ${allowed.join(', ') || 'None'}`,
      );
    }

    const [updated] = await db
      .update(coreProducts)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(coreProducts.productId, productId))
      .returning();

    const targetTx = tx || this.db;
    const eventPayload = {
      from: currentState,
      to: newState,
    };

    if (newState === PRODUCT_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: updated.name,
        payload: eventPayload,
        actor,
      });
    } else if (currentState === PRODUCT_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: updated.name,
        payload: eventPayload,
        actor,
      });
    } else {
      await emitEvent(targetTx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.name,
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }

  /**
   * Add or Upsert a supplier to a product.
   */
  async addSupplier(productId: string, dto: AddSupplierDto, actor: string) {
    // Verify product exists
    const existingProduct = await this.db
      .select({ id: coreProducts.productId, name: coreProducts.name })
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!existingProduct.length) {
      throw new NotFoundException(`Product not found`);
    }

    const payload = {
      productId,
      vendorId: dto.vendorId,
      supplierPartNumber: dto.supplierPartNumber || null,
      isPreferred: false,
      costPrice: dto.costPrice ? dto.costPrice.toString() : '0',
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      stateCode: PRODUCT_STATE.ACTIVE,
      modifiedOn: new Date(),
    };

    return await this.db.transaction(async (tx) => {
      const [mapping] = await tx
        .insert(productSuppliers)
        .values({
          ...payload,
          createdBy: actor,
          createdOn: new Date(),
          stateCode: PRODUCT_STATE.ACTIVE,
          source: 'app',
        })
        .onConflictDoUpdate({
          target: [productSuppliers.vendorId, productSuppliers.productId],
          set: {
            ...payload, // This brings back archived versions as "active" with the latest data
          },
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_SUPPLIER,
        entityId: mapping.productSupplierId,
        eventType: EventType.LINKED,
        entityDisplayName: existingProduct[0].name,
        payload: dto,
        actor,
      });

      return mapping;
    });
  }

  /**
   * Remove (Archive) a supplier from a product.
   */
  async removeSupplier(productId: string, vendorId: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      const [mapping] = await tx
        .update(productSuppliers)
        // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
        .set({ stateCode: PRODUCT_STATE.ARCHIVED, modifiedOn: new Date() })
        .where(
          sql`${productSuppliers.productId} = ${productId} AND ${productSuppliers.vendorId} = ${vendorId}`,
        )
        .returning();

      if (!mapping) {
        throw new NotFoundException('Supplier mapping not found');
      }

      const [product] = await tx
        .select({ name: coreProducts.name })
        .from(coreProducts)
        .where(eq(coreProducts.productId, productId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_SUPPLIER,
        entityId: mapping.productSupplierId,
        eventType: EventType.UNLINKED,
        entityDisplayName: product.name,
        payload: { stateCode: PRODUCT_STATE.ARCHIVED },
        actor,
      });

      return mapping;
    });
  }

  /**
   * Add a UoM conversion to a product.
   */
  async addUom(
    productId: string,
    dto: { uomCode: string; ratio: string; barcode?: string },
    actor: string,
  ) {
    const existing = await this.db
      .select({ id: coreProducts.productId, name: coreProducts.name })
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException(`Product not found`);
    }

    return await this.db.transaction(async (tx) => {
      const [uom] = await tx
        .insert(productUoms)
        .values({
          productId,
          uomCode: dto.uomCode,
          ratio: dto.ratio,
          barcode: dto.barcode || null,
        })
        .onConflictDoUpdate({
          target: [productUoms.productId, productUoms.uomCode],
          set: {
            ratio: dto.ratio,
            barcode: dto.barcode || null,
          },
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UOM_ADDED,
        entityDisplayName: existing[0].name,
        payload: { uomCode: dto.uomCode, ratio: dto.ratio },
        actor,
      });

      return uom;
    });
  }

  /**
   * Remove a UoM conversion from a product.
   */
  async removeUom(productId: string, productUomId: string, actor: string) {
    const existing = await this.db
      .select()
      .from(productUoms)
      .where(
        and(
          eq(productUoms.productUomId, productUomId),
          eq(productUoms.productId, productId),
        ),
      )
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException('UoM conversion not found');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(productUoms)
        .where(eq(productUoms.productUomId, productUomId));

      const [product] = await tx
        .select({ name: coreProducts.name })
        .from(coreProducts)
        .where(eq(coreProducts.productId, productId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UOM_REMOVED,
        entityDisplayName: product.name,
        payload: { uomCode: existing[0].uomCode, ratio: existing[0].ratio },
        actor,
      });
    });

    return { deleted: true };
  }

  /**
   * Link a default bin to a product.
   */
  async linkDefaultBin(productId: string, dto: LinkBinDto, actor: string) {
    const existing = await this.db
      .select({ id: coreProducts.productId, name: coreProducts.name })
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException(`Product not found`);
    }

    return await this.db.transaction(async (tx) => {
      if (dto.isPrimaryPerLocation) {
        // Demote existing primary pins in that location
        await tx
          .update(productDefaultBins)
          .set({ isPrimaryPerLocation: false, modifiedOn: new Date() })
          .where(
            and(
              eq(productDefaultBins.productId, productId),
              eq(productDefaultBins.locationId, dto.locationId),
            ),
          );
      }

      const [binLink] = await tx
        .insert(productDefaultBins)
        .values({
          productId,
          locationId: dto.locationId,
          binId: dto.binId,
          isPrimaryPerLocation: dto.isPrimaryPerLocation ?? true,
          minQuantity: dto.minQuantity || '0',
          maxQuantity: dto.maxQuantity || null,
        })
        .onConflictDoUpdate({
          target: [
            productDefaultBins.productId,
            productDefaultBins.locationId,
            productDefaultBins.binId,
          ],
          set: {
            isPrimaryPerLocation: dto.isPrimaryPerLocation ?? true,
            minQuantity: dto.minQuantity || '0',
            maxQuantity: dto.maxQuantity || null,
            modifiedOn: new Date(),
          },
        })
        .returning();

      const [bin] = await tx
        .select({ binNumber: bins.binNumber })
        .from(bins)
        .where(eq(bins.binId, dto.binId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: existing[0].name,
        payload: {
          action: 'linked_default_bin',
          binId: dto.binId,
          binNumber: bin?.binNumber,
          isPrimary: dto.isPrimaryPerLocation,
        },
        actor,
      });

      return binLink;
    });
  }

  /**
   * Remove a default bin mapping from a product.
   */
  async removeDefaultBin(productDefaultBinId: string, actor: string) {
    const existing = await this.db
      .select()
      .from(productDefaultBins)
      .where(eq(productDefaultBins.productDefaultBinId, productDefaultBinId))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException('Default bin mapping not found');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(productDefaultBins)
        .where(eq(productDefaultBins.productDefaultBinId, productDefaultBinId));

      const [[product], [bin]] = await Promise.all([
        tx
          .select({ name: coreProducts.name })
          .from(coreProducts)
          .where(eq(coreProducts.productId, existing[0].productId)),
        tx
          .select({ binNumber: bins.binNumber })
          .from(bins)
          .where(eq(bins.binId, existing[0].binId)),
      ]);

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: existing[0].productId,
        eventType: EventType.UPDATED,
        entityDisplayName: product.name,
        payload: {
          action: 'unlinked_default_bin',
          binId: existing[0].binId,
          binNumber: bin?.binNumber,
        },
        actor,
      });
    });

    return { deleted: true };
  }

  /**
   * Add a component to a kit product.
   */
  async addComponent(
    productId: string,
    dto: {
      childProductId: string;
      parentQuantity: string;
      quantity: string;
      sequenceNumber?: number;
      fractionalBehavior?:
        | 'allow_fractional'
        | 'round_up'
        | 'round_down'
        | 'force_multiple';
    },
    actor: string,
  ) {
    // Validate parent exists and is a kit
    const [parent] = await this.db
      .select({
        structureType: coreProducts.structureType,
        name: coreProducts.name,
      })
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!parent) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (parent.structureType !== 'kit') {
      throw new BadRequestException('Only kit products can have components');
    }

    // Validate child exists
    const [child] = await this.db
      .select({ id: coreProducts.productId })
      .from(coreProducts)
      .where(eq(coreProducts.productId, dto.childProductId))
      .limit(1);

    if (!child) {
      throw new NotFoundException(
        `Child product ${dto.childProductId} not found`,
      );
    }

    // Check for circular dependency (simple 1-level check for now)
    if (productId === dto.childProductId) {
      throw new BadRequestException('Product cannot be a component of itself');
    }

    // Deeper circular dependency check (checking if parent is already a component of child)
    const [cycle] = await this.db
      .select({ id: productComponents.componentId })
      .from(productComponents)
      .where(
        and(
          eq(productComponents.parentProductId, dto.childProductId),
          eq(productComponents.childProductId, productId),
        ),
      )
      .limit(1);

    if (cycle) {
      throw new BadRequestException('Circular dependency detected');
    }

    return await this.db.transaction(async (tx) => {
      const [component] = await tx
        .insert(productComponents)
        .values({
          parentProductId: productId,
          childProductId: dto.childProductId,
          parentQuantity: dto.parentQuantity,
          quantity: dto.quantity,
          sequenceNumber: dto.sequenceNumber || 0,
          fractionalBehavior: dto.fractionalBehavior || 'allow_fractional',
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: parent.name,
        payload: {
          action: 'component_added',
          componentId: component.componentId,
        },
        actor,
      });

      return component;
    });
  }

  /**
   * Update a component in a kit product.
   */
  async updateComponent(
    productId: string,
    componentId: string,
    dto: {
      parentQuantity?: string;
      quantity?: string;
      sequenceNumber?: number;
      fractionalBehavior?:
        | 'allow_fractional'
        | 'round_up'
        | 'round_down'
        | 'force_multiple';
    },
    actor: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(productComponents)
      .where(
        and(
          eq(productComponents.componentId, componentId),
          eq(productComponents.parentProductId, productId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Component not found');
    }

    return await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(productComponents)
        .set({
          parentQuantity: dto.parentQuantity ?? existing.parentQuantity,
          quantity: dto.quantity ?? existing.quantity,
          sequenceNumber: dto.sequenceNumber ?? existing.sequenceNumber,
          fractionalBehavior:
            dto.fractionalBehavior ?? existing.fractionalBehavior,
        })
        .where(eq(productComponents.componentId, componentId))
        .returning();

      const [product] = await tx
        .select({ name: coreProducts.name })
        .from(coreProducts)
        .where(eq(coreProducts.productId, productId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: product.name,
        payload: { action: 'component_updated', componentId },
        actor,
      });

      return updated;
    });
  }

  /**
   * Remove a component from a kit product.
   */
  async removeComponent(productId: string, componentId: string, actor: string) {
    const [existing] = await this.db
      .select()
      .from(productComponents)
      .where(
        and(
          eq(productComponents.componentId, componentId),
          eq(productComponents.parentProductId, productId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Component not found');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(productComponents)
        .where(eq(productComponents.componentId, componentId));

      const [product] = await tx
        .select({ name: coreProducts.name })
        .from(coreProducts)
        .where(eq(coreProducts.productId, productId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: product.name,
        payload: { action: 'component_removed', componentId },
        actor,
      });
    });

    return { deleted: true };
  }
}
