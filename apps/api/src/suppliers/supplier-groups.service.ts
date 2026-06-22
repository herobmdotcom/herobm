import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { supplierGroups, suppliers } from '../drizzle/herobm-core-schema';
import { CreateSupplierGroupDto, UpdateSupplierGroupDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { buildUpdatePayload } from '../common/utils/drizzle-utils';

@Injectable()
export class SupplierGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(supplierGroups);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid supplier group ID: ${id}`);
    }

    const rows = await db
      .select()
      .from(supplierGroups)
      .where(eq(supplierGroups.supplierGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Supplier group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateSupplierGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(supplierGroups)
        .values({ ...dto } as typeof supplierGroups.$inferInsert)
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.SUPPLIER_GROUP,
        entityId: rows[0].supplierGroupId,
        eventType: EventType.CREATED,
        entityDisplayName: rows[0].groupCode,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async update(id: string, dto: UpdateSupplierGroupDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      await this.findOne(id, tx);

      const rows = await tx
        .update(supplierGroups)
        .set(buildUpdatePayload(dto))
        .where(eq(supplierGroups.supplierGroupId, id))
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.SUPPLIER_GROUP,
        entityId: rows[0].supplierGroupId,
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

      // Check for referencing suppliers
      const deps = await tx
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(eq(suppliers.supplierGroupId, id));

      if (Number(deps[0].count) > 0) {
        throw new ConflictException(
          `Cannot delete supplier group '${id}' because it is currently assigned to one or more suppliers.`,
        );
      }

      await tx
        .delete(supplierGroups)
        .where(eq(supplierGroups.supplierGroupId, id));

      await emitEvent(tx, {
        entityType: EntityType.SUPPLIER_GROUP,
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
