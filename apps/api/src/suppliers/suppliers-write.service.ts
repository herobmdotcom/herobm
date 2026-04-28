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
  suppliers as coreSuppliers,
  supplierEvents,
  supplierExpiries,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierExpiryDto,
  UpdateSupplierExpiryDto,
} from './dto';
import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class SuppliersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfig: AppConfigService,
  ) {}

  private readonly logger = new Logger(SuppliersWriteService.name);

  /**
   * Create a new supplier in modbm_core.
   * Vendor number uniqueness is enforced by the DB UNIQUE constraint.
   */
  async create(dto: CreateSupplierDto, actor: string) {
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [supplier] = await tx
        .insert(coreSuppliers)
        .values({
          ...dto,
          currencyCode: dto.currencyCode || this.appConfig.homeCurrency(),
          createdBy: actor,
        })
        .returning();

      await tx.insert(supplierEvents).values({
        vendorId: supplier.vendorId,
        eventType: 'created',
        payload: dto,
        actor,
      });

      return supplier;
    });

    this.logger.log(
      `Supplier created: ${dto.vendorNumber} (ID: ${result.vendorId}) by ${actor}`,
    );
    return result;
  }

  /**
   * Update a supplier.
   */
  async update(id: string, dto: UpdateSupplierDto, actor: string) {
    const existing = await this.db
      .select()
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Supplier '${id}' not found`);
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(dto, existing[0], AuditMode.DIFF);

      const [updated] = await tx
        .update(coreSuppliers)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        })
        .where(eq(coreSuppliers.vendorId, id))
        .returning();

      if (audit.hasChanges) {
        if (
          audit.changes.stateCode !== undefined &&
          Object.keys(audit.changes).length === 1
        ) {
          await tx.insert(supplierEvents).values({
            vendorId: id,
            eventType: 'status_changed',
            payload: {
              from: existing[0].stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await tx.insert(supplierEvents).values({
            vendorId: id,
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

    this.logger.log(`Supplier updated: ${id} by ${actor}`);
    return result;
  }

  /**
   * Archive a supplier.
   */
  async archive(id: string, actor: string) {
    const existing = await this.db
      .select()
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Supplier '${id}' not found`);
    }

    if (existing[0].stateCode === 'archived') {
      throw new BadRequestException(`Supplier '${id}' is already archived`);
    }

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(coreSuppliers)
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(eq(coreSuppliers.vendorId, id))
        .returning();

      await tx.insert(supplierEvents).values({
        vendorId: id,
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
   * Unarchive a supplier.
   */
  async unarchive(id: string, actor: string) {
    const existing = await this.db
      .select()
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Supplier '${id}' not found`);
    }

    if (existing[0].stateCode !== 'archived') {
      throw new BadRequestException(`Supplier '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(supplierEvents)
      .where(
        sql`${supplierEvents.vendorId} = ${id} AND ${supplierEvents.eventType} = 'archived'`,
      )
      .orderBy(sql`${supplierEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      'active';

    return await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(coreSuppliers)
        .set({ stateCode: previousState, modifiedOn: new Date() })
        .where(eq(coreSuppliers.vendorId, id))
        .returning();

      await tx.insert(supplierEvents).values({
        vendorId: id,
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

  // --- Expiries Methods ---

  async createExpiry(
    vendorId: string,
    dto: CreateSupplierExpiryDto,
    actor: string,
  ) {
    const existing = await this.db
      .select({ id: coreSuppliers.vendorId })
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, vendorId));
    if (existing.length === 0)
      throw new NotFoundException('Supplier not found');

    const result = await this.db
      .insert(supplierExpiries)
      .values({
        vendorId,
        expiryType: dto.expiryType,
        expiryDate: dto.expiryDate,
        notes: dto.notes,
        createdBy: actor,
      })
      .returning();

    await this.db.insert(supplierEvents).values({
      vendorId,
      eventType: `added_expiry`,
      payload: { expiryType: dto.expiryType },
      actor,
    });
    return result[0];
  }

  async updateExpiry(
    vendorId: string,
    expiryId: string,
    dto: UpdateSupplierExpiryDto,
    actor: string,
  ) {
    const existing = await this.db
      .select()
      .from(supplierExpiries)
      .where(
        sql`${supplierExpiries.expiryId} = ${expiryId} AND ${supplierExpiries.vendorId} = ${vendorId}`,
      );

    if (existing.length === 0)
      throw new NotFoundException('Expiry not found on this vendor');

    const updateData: any = { modifiedOn: sql`NOW()` };
    if (dto.expiryType !== undefined) updateData.expiryType = dto.expiryType;
    if (dto.expiryDate !== undefined) updateData.expiryDate = dto.expiryDate;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const result = await this.db
      .update(supplierExpiries)
      .set(updateData)
      .where(eq(supplierExpiries.expiryId, expiryId))
      .returning();

    await this.db.insert(supplierEvents).values({
      vendorId,
      eventType: `updated_expiry`,
      payload: { expiryId },
      actor,
    });
    return result[0];
  }

  async deleteExpiry(vendorId: string, expiryId: string, actor: string) {
    const existing = await this.db
      .select()
      .from(supplierExpiries)
      .where(
        sql`${supplierExpiries.expiryId} = ${expiryId} AND ${supplierExpiries.vendorId} = ${vendorId}`,
      );

    if (existing.length === 0) throw new NotFoundException('Expiry not found');

    const type = existing[0].expiryType;

    await this.db
      .delete(supplierExpiries)
      .where(eq(supplierExpiries.expiryId, expiryId));

    await this.db.insert(supplierEvents).values({
      vendorId,
      eventType: `deleted_expiry`,
      payload: { type },
      actor,
    });
    return { status: 'deleted' };
  }
}
