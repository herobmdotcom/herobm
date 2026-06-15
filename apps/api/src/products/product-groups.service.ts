import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { productGroups, products } from '../drizzle/herobm-core-schema';
import { CreateProductGroupDto, UpdateProductGroupDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ProductGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(productGroups);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid product group ID: ${id}`);
    }

    const rows = await db
      .select()
      .from(productGroups)
      .where(eq(productGroups.productGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Product group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateProductGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(productGroups)
        .values({
          groupCode: dto.groupCode,
          name: dto.name,
          defaultRevenueAccountId: dto.defaultRevenueAccountId || null,
          defaultExpenseAccountId: dto.defaultExpenseAccountId || null,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_GROUP,
        entityId: rows[0].productGroupId,
        eventType: EventType.CREATED,
        entityDisplayName: rows[0].groupCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async update(id: string, dto: UpdateProductGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      await this.findOne(id, tx);

      const rows = await tx
        .update(productGroups)
        .set({
          ...(dto.groupCode !== undefined && { groupCode: dto.groupCode }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.defaultRevenueAccountId !== undefined && {
            defaultRevenueAccountId: dto.defaultRevenueAccountId,
          }),
          ...(dto.defaultExpenseAccountId !== undefined && {
            defaultExpenseAccountId: dto.defaultExpenseAccountId,
          }),
        })
        .where(eq(productGroups.productGroupId, id))
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_GROUP,
        entityId: rows[0].productGroupId,
        eventType: EventType.UPDATED,
        entityDisplayName: rows[0].groupCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async delete(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.findOne(id, tx);

      // Check for referencing products
      const deps = await tx
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.productGroupId, id));

      if (Number(deps[0].count) > 0) {
        throw new ConflictException(
          `Cannot delete product group '${id}' because it is currently assigned to one or more products.`,
        );
      }

      await tx
        .delete(productGroups)
        .where(eq(productGroups.productGroupId, id));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT_GROUP,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: existing.groupCode,
        payload: {},
        actor: userId,
      });

      return { deleted: true };
    });
  }
}
