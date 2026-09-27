import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { products as coreProducts, productComponents } from '@herobm/db-schema';
import { EntityType, EventType } from '../common/event-types';
import { emitEvent } from '../common/emit-event';
import { AddProductComponentDto, UpdateProductComponentDto } from './dto';

@Injectable()
export class ProductComponentsService {
  private readonly logger = new Logger(ProductComponentsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Add a component to a kit product.
   */
  async addComponent(
    productId: string,
    dto: AddProductComponentDto,
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
    dto: UpdateProductComponentDto,
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
