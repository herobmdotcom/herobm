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
        .values({
          groupCode: dto.groupCode,
          name: dto.name,
          ...(dto.defaultApAccountId && {
            defaultApAccountId: dto.defaultApAccountId,
          }),
          ...(dto.defaultExpenseAccountId && {
            defaultExpenseAccountId: dto.defaultExpenseAccountId,
          }),
          ...(dto.tradingTermsId && { tradingTermsId: dto.tradingTermsId }),
          ...(dto.earlyPaymentDiscount && {
            earlyPaymentDiscount: dto.earlyPaymentDiscount,
          }),
          ...(dto.earlyPaymentDiscountDays !== undefined && {
            earlyPaymentDiscountDays: dto.earlyPaymentDiscountDays,
          }),
          ...(dto.creditLimit && { creditLimit: dto.creditLimit }),
          isPurchasingBlocked: dto.isPurchasingBlocked ?? false,
          ...(dto.purchasingBlockReason && {
            purchasingBlockReason: dto.purchasingBlockReason,
          }),
          isPaymentBlocked: dto.isPaymentBlocked ?? false,
          ...(dto.paymentBlockReason && {
            paymentBlockReason: dto.paymentBlockReason,
          }),
          ...(dto.blockNotes && { blockNotes: dto.blockNotes }),
        })
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
        .set({
          ...(dto.groupCode !== undefined && { groupCode: dto.groupCode }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.defaultApAccountId !== undefined && {
            defaultApAccountId: dto.defaultApAccountId,
          }),
          ...(dto.defaultExpenseAccountId !== undefined && {
            defaultExpenseAccountId: dto.defaultExpenseAccountId,
          }),
          ...(dto.earlyPaymentDiscount !== undefined && {
            earlyPaymentDiscount: dto.earlyPaymentDiscount,
          }),
          ...(dto.earlyPaymentDiscountDays !== undefined && {
            earlyPaymentDiscountDays: dto.earlyPaymentDiscountDays,
          }),
          ...(dto.creditLimit !== undefined && {
            creditLimit: dto.creditLimit,
          }),
          ...(dto.isPurchasingBlocked !== undefined && {
            isPurchasingBlocked: dto.isPurchasingBlocked,
          }),
          ...(dto.purchasingBlockReason !== undefined && {
            purchasingBlockReason: dto.purchasingBlockReason,
          }),
          ...(dto.isPaymentBlocked !== undefined && {
            isPaymentBlocked: dto.isPaymentBlocked,
          }),
          ...(dto.paymentBlockReason !== undefined && {
            paymentBlockReason: dto.paymentBlockReason,
          }),
          ...(dto.blockNotes !== undefined && { blockNotes: dto.blockNotes }),
        })
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
