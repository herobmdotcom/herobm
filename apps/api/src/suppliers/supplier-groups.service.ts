import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { supplierGroups, suppliers } from '../drizzle/modbm-core-schema';
import { CreateSupplierGroupDto, UpdateSupplierGroupDto } from './dto';

@Injectable()
export class SupplierGroupsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(supplierGroups);
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid supplier group ID: ${id}`);
    }

    const rows = await this.db
      .select()
      .from(supplierGroups)
      .where(eq(supplierGroups.supplierGroupId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Supplier group '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateSupplierGroupDto) {
    const rows = await this.db
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
    return rows[0];
  }

  async update(id: string, dto: UpdateSupplierGroupDto) {
    await this.findOne(id);

    const rows = await this.db
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
        ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
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

    return rows[0];
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check for referencing suppliers
    const deps = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(eq(suppliers.supplierGroupId, id));

    if (Number(deps[0].count) > 0) {
      throw new ConflictException(
        `Cannot delete supplier group '${id}' because it is currently assigned to one or more suppliers.`,
      );
    }

    await this.db
      .delete(supplierGroups)
      .where(eq(supplierGroups.supplierGroupId, id));
    return { deleted: true };
  }
}
