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
} from '../drizzle/modbm-core-schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';

export interface CreateSupplierDto {
  vendorNumber: string;
  name: string;
  address1Line1?: string;
  address1Line2?: string;
  address1City?: string;
  address1StateOrProvince?: string;
  address1PostalCode?: string;
  address1Country?: string;
  telephone1?: string;
  fax?: string;
  emailAddress1?: string;
  paymentTerms?: string;
  supplierGroupId?: string;
  currencyCode?: string;
  notes?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  address1Line1?: string;
  address1Line2?: string;
  address1City?: string;
  address1StateOrProvince?: string;
  address1PostalCode?: string;
  address1Country?: string;
  telephone1?: string;
  fax?: string;
  emailAddress1?: string;
  paymentTerms?: string;
  supplierGroupId?: string;
  currencyCode?: string;
  notes?: string;
  stateCode?: string;
}

@Injectable()
export class SuppliersWriteService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

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
}
