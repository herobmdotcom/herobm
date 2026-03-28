import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  productEvents,
  productSuppliers,
  productSupplierEvents,
} from '../drizzle/modbm-core-schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';

export interface CreateProductDto {
  productNumber: string;
  name: string;
  productType?: 'inventory' | 'non-stock' | 'service';
  barcode?: string;
  listPrice?: string;
  standardCost?: string;
  tradePrice?: string;
  priceLevel3?: string;
  priceLevel4?: string;
  gstCategory?: string;
  scNumber?: string;
  productGroupId?: string;
  notes?: string;
  stateCode?: string;
}

export interface UpdateProductDto {
  name?: string;
  productType?: 'inventory' | 'non-stock' | 'service';
  barcode?: string;
  listPrice?: string;
  standardCost?: string;
  tradePrice?: string;
  priceLevel3?: string;
  priceLevel4?: string;
  gstCategory?: string;
  scNumber?: string;
  productGroupId?: string;
  notes?: string;
  stateCode?: string;
}

import { AddSupplierDto } from './dto';

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
        eventType: 'created',
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
            eventType: 'status_changed',
            payload: {
              from: existing[0].stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await tx.insert(productEvents).values({
            productId: id,
            eventType: 'updated',
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
    const existing = await this.db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Product '${id}' not found`);
    }

    if (existing[0].stateCode === 'archived') {
      throw new BadRequestException(`Product '${id}' is already archived`);
    }

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(coreProducts)
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(eq(coreProducts.productId, id))
        .returning();

      await tx.insert(productEvents).values({
        productId: id,
        eventType: 'archived',
        payload: {
          from: existing[0].stateCode,
          to: 'archived',
        },
        actor,
      });

      return updated;
    });
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

    if (existing[0].stateCode !== 'archived') {
      throw new BadRequestException(`Product '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(productEvents)
      .where(
        sql`${productEvents.productId} = ${id} AND ${productEvents.eventType} = 'archived'`,
      )
      .orderBy(sql`${productEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      'active';

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(coreProducts)
        .set({ stateCode: previousState, modifiedOn: new Date() })
        .where(eq(coreProducts.productId, id))
        .returning();

      await tx.insert(productEvents).values({
        productId: id,
        eventType: 'unarchived',
        payload: {
          from: 'archived',
          to: previousState,
        },
        actor,
      });

      return updated;
    });
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
      stateCode: 'active',
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
        eventType: 'linked',
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
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(
          sql`${productSuppliers.productId} = ${productId} AND ${productSuppliers.vendorId} = ${vendorId}`,
        )
        .returning();

      if (!mapping) {
        throw new NotFoundException('Supplier mapping not found');
      }

      await tx.insert(productSupplierEvents).values({
        productSupplierId: mapping.productSupplierId,
        eventType: 'unlinked',
        payload: { stateCode: 'archived' },
        actor,
      });

      return mapping;
    });
  }
}
