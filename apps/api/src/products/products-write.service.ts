import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  productEvents,
} from '../drizzle/modbm-core-schema';
import { products as martProducts } from '../drizzle/schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export interface CreateProductDto {
  productNumber: string;
  name: string;
  barcode?: string;
  listPrice?: string;
  standardCost?: string;
  notes?: string;
}

export interface UpdateProductDto {
  name?: string;
  barcode?: string;
  listPrice?: string;
  standardCost?: string;
  notes?: string;
  stateCode?: string;
}

@Injectable()
export class ProductsWriteService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(ProductsWriteService.name);

  /**
   * Create a new product in modbm_core.
   * Ensures the product number is unique across both core and mart data.
   */
  async create(dto: CreateProductDto, actor: string) {
    // 1. Check if product number exists in core
    const coreExisting = await this.db
      .select({ id: coreProducts.productId })
      .from(coreProducts)
      .where(eq(coreProducts.productNumber, dto.productNumber))
      .limit(1);

    if (coreExisting.length > 0) {
      throw new BadRequestException(
        `Product number '${dto.productNumber}' already exists in application data`,
      );
    }

    // 2. Check if product number exists in mart (legacy)
    const martExisting = await this.db
      .select({ id: martProducts.productId })
      .from(martProducts)
      .where(eq(martProducts.productNumber, dto.productNumber))
      .limit(1);

    if (martExisting.length > 0) {
      throw new BadRequestException(
        `Product number '${dto.productNumber}' already exists in legacy ABM data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
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
   * Update an application-owned product.
   * Throws NotFoundException if the product ID is not in modbm_core.
   * (Legacy mart products are read-only).
   */
  async update(id: string, dto: UpdateProductDto, actor: string) {
    let existing: any[] = [];

    if (isUuid(id)) {
      existing = await this.db
        .select()
        .from(coreProducts)
        .where(eq(coreProducts.productId, id))
        .limit(1);
    }

    if (existing.length === 0) {
      // Check if it's a legacy product to give a better error message
      const isLegacy = await this.db
        .select({ id: martProducts.productId })
        .from(martProducts)
        .where(eq(martProducts.productId, id))
        .limit(1);

      if (isLegacy.length > 0) {
        throw new BadRequestException(
          `Product '${id}' is a legacy ABM product and cannot be edited.`,
        );
      }

      throw new NotFoundException(
        `Product '${id}' not found in application data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
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
}
