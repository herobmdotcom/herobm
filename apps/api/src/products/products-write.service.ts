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
  productEvents,
  productSuppliers,
  productSupplierEvents,
  productUoms,
  productDefaultBins,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import {
  PRODUCT_TRANSITIONS,
  PRODUCT_STATE,
  ProductState,
} from '@modbm/shared';
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

  /**
   * Create a new product in modbm_core.
   * Product number uniqueness is enforced by the DB UNIQUE constraint.
   */
  async create(dto: CreateProductDto, actor: string) {
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [product] = await tx
        .insert(coreProducts)
        .values({
          ...dto,
          createdBy: actor,
        })
        .returning();

      await tx.insert(productEvents).values({
        productId: product.productId,
        eventType: EventType.CREATED,
        payload: dto,
        actor,
      });

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
          await tx.insert(productEvents).values({
            productId: id,
            eventType: EventType.STATUS_CHANGED,
            payload: {
              from: existing[0].stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await tx.insert(productEvents).values({
            productId: id,
            eventType: EventType.UPDATED,
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
      .from(productEvents)
      .where(
        sql`${productEvents.productId} = ${id} AND ${productEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${productEvents.createdOn} DESC`)
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

    const currentState = existing.stateCode as ProductState;

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
      .set({ stateCode: newState as any, modifiedOn: new Date() })
      .where(eq(coreProducts.productId, productId))
      .returning();

    const targetTx = tx || this.db;
    await targetTx.insert(productEvents).values({
      productId,
      eventType:
        newState === PRODUCT_STATE.ARCHIVED
          ? EventType.ARCHIVED
          : EventType.STATUS_CHANGED,
      payload: {
        from: currentState,
        to: newState,
      },
      actor,
    });

    return updated;
  }

  /**
   * Add or Upsert a supplier to a product.
   */
  async addSupplier(productId: string, dto: AddSupplierDto, actor: string) {
    // Verify product exists
    const existingProduct = await this.db
      .select({ id: coreProducts.productId })
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
        })
        .onConflictDoUpdate({
          target: [productSuppliers.vendorId, productSuppliers.productId],
          set: {
            ...payload, // This brings back archived versions as "active" with the latest data
          },
        })
        .returning();

      await tx.insert(productSupplierEvents).values({
        productSupplierId: mapping.productSupplierId,
        eventType: EventType.LINKED,
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
        // eslint-disable-next-line no-restricted-syntax
        .set({ stateCode: PRODUCT_STATE.ARCHIVED, modifiedOn: new Date() })
        .where(
          sql`${productSuppliers.productId} = ${productId} AND ${productSuppliers.vendorId} = ${vendorId}`,
        )
        .returning();

      if (!mapping) {
        throw new NotFoundException('Supplier mapping not found');
      }

      await tx.insert(productSupplierEvents).values({
        productSupplierId: mapping.productSupplierId,
        eventType: EventType.UNLINKED,
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
      .select({ id: coreProducts.productId })
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

      await tx.insert(productEvents).values({
        productId,
        eventType: 'uom_added',
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

      await tx.insert(productEvents).values({
        productId,
        eventType: 'uom_removed',
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
      .select({ id: coreProducts.productId })
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

      await tx.insert(productEvents).values({
        productId,
        eventType: EventType.UPDATED,
        payload: {
          action: 'linked_default_bin',
          binId: dto.binId,
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

      await tx.insert(productEvents).values({
        productId: existing[0].productId,
        eventType: EventType.UPDATED,
        payload: { action: 'unlinked_default_bin', binId: existing[0].binId },
        actor,
      });
    });

    return { deleted: true };
  }
}
