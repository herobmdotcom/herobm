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
  masterDataEvents,
  supplierExpiries,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  SUPPLIER_TRANSITIONS,
  SUPPLIER_STATE,
  SupplierState,
} from '@modbm/shared';
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

      await emitEvent(tx as any, {
        entityType: EntityType.SUPPLIER,
        entityId: supplier.vendorId,
        eventType: EventType.CREATED,
        entityDisplayName: supplier.name,
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
          await emitEvent(tx as any, {
            entityType: EntityType.SUPPLIER,
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
          await emitEvent(tx as any, {
            entityType: EntityType.SUPPLIER,
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

    this.logger.log(`Supplier updated: ${id} by ${actor}`);
    return result;
  }

  /**
   * Archive a supplier.
   */
  async archive(id: string, actor: string) {
    return await this.changeSupplierState(id, SUPPLIER_STATE.ARCHIVED, actor);
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

    if (existing[0].stateCode !== SUPPLIER_STATE.ARCHIVED) {
      throw new BadRequestException(`Supplier '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(masterDataEvents)
      .where(
        sql`${masterDataEvents.entityId} = ${id} AND ${masterDataEvents.entityType} = ${EntityType.SUPPLIER} AND ${masterDataEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${masterDataEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      SUPPLIER_STATE.ACTIVE;

    return await this.changeSupplierState(
      id,
      previousState as SupplierState,
      actor,
    );
  }

  /**
   * Centralised state transition logic for suppliers.
   */
  async changeSupplierState(
    vendorId: string,
    newState: SupplierState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    const [existing] = await db
      .select()
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorId, vendorId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Supplier '${vendorId}' not found`);
    }

    const currentState = existing.stateCode as SupplierState;

    if (currentState === newState) {
      return existing;
    }

    // Validation
    const allowed = SUPPLIER_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Invalid supplier state transition: '${currentState}' -> '${newState}'. Valid next states: ${allowed.join(', ') || 'None'}`,
      );
    }

    const [updated] = await db
      .update(coreSuppliers)
      .set({ stateCode: newState as any, modifiedOn: new Date() })
      .where(eq(coreSuppliers.vendorId, vendorId))
      .returning();

    const targetTx = tx || this.db;
    let eventType: string = EventType.STATUS_CHANGED;
    if (newState === SUPPLIER_STATE.ARCHIVED) {
      eventType = EventType.ARCHIVED;
    } else if (currentState === SUPPLIER_STATE.ARCHIVED) {
      eventType = EventType.UNARCHIVED;
    }

    await emitEvent(targetTx as any, {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: eventType,
      entityDisplayName: updated.name,
      payload: {
        from: currentState,
        to: newState,
      },
      actor,
    });

    return updated;
  }

  // --- Expiries Methods ---

  async createExpiry(
    vendorId: string,
    dto: CreateSupplierExpiryDto,
    actor: string,
  ) {
    const existing = await this.db
      .select({ id: coreSuppliers.vendorId, name: coreSuppliers.name })
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

    await emitEvent(this.db as any, {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.ADDED_EXPIRY,
      entityDisplayName: existing[0].name,
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
      .select({
        expiryId: supplierExpiries.expiryId,
        vendorId: supplierExpiries.vendorId,
        supplierName: coreSuppliers.name,
      })
      .from(supplierExpiries)
      .innerJoin(
        coreSuppliers,
        eq(coreSuppliers.vendorId, supplierExpiries.vendorId),
      )
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

    await emitEvent(this.db as any, {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.UPDATED_EXPIRY,
      entityDisplayName: existing[0].supplierName,
      payload: { expiryId },
      actor,
    });
    return result[0];
  }

  async deleteExpiry(vendorId: string, expiryId: string, actor: string) {
    const existing = await this.db
      .select({
        expiryType: supplierExpiries.expiryType,
        supplierName: coreSuppliers.name,
      })
      .from(supplierExpiries)
      .innerJoin(
        coreSuppliers,
        eq(coreSuppliers.vendorId, supplierExpiries.vendorId),
      )
      .where(
        sql`${supplierExpiries.expiryId} = ${expiryId} AND ${supplierExpiries.vendorId} = ${vendorId}`,
      );

    if (existing.length === 0) throw new NotFoundException('Expiry not found');

    const type = existing[0].expiryType;

    await this.db
      .delete(supplierExpiries)
      .where(eq(supplierExpiries.expiryId, expiryId));

    await emitEvent(this.db as any, {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.DELETED_EXPIRY,
      entityDisplayName: existing[0].supplierName,
      payload: { type },
      actor,
    });
    return { status: 'deleted' };
  }
}
