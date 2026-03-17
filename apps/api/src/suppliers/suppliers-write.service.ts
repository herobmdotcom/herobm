import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  suppliers as coreSuppliers,
  supplierEvents,
} from '../drizzle/modbm-core-schema';
import { suppliers as martSuppliers } from '../drizzle/schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
   * Ensures the vendor number is unique across both core and mart data.
   */
  async create(dto: CreateSupplierDto, actor: string) {
    // 1. Check if vendor number exists in core
    const coreExisting = await this.db
      .select({ id: coreSuppliers.vendorId })
      .from(coreSuppliers)
      .where(eq(coreSuppliers.vendorNumber, dto.vendorNumber))
      .limit(1);

    if (coreExisting.length > 0) {
      throw new BadRequestException(
        `Supplier number '${dto.vendorNumber}' already exists in application data`,
      );
    }

    // 2. Check if vendor number exists in mart (legacy)
    const martExisting = await this.db
      .select({ id: martSuppliers.vendorId })
      .from(martSuppliers)
      .where(eq(martSuppliers.vendorNumber, dto.vendorNumber))
      .limit(1);

    if (martExisting.length > 0) {
      throw new BadRequestException(
        `Supplier number '${dto.vendorNumber}' already exists in legacy ABM data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
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
   * Update an application-owned supplier.
   * Throws NotFoundException if the ID is not in modbm_core.
   */
  async update(id: string, dto: UpdateSupplierDto, actor: string) {
    let existing: any[] = [];

    if (isUuid(id)) {
      existing = await this.db
        .select()
        .from(coreSuppliers)
        .where(eq(coreSuppliers.vendorId, id))
        .limit(1);
    }

    if (existing.length === 0) {
      const isLegacy = await this.db
        .select({ id: martSuppliers.vendorId })
        .from(martSuppliers)
        .where(eq(martSuppliers.vendorId, id))
        .limit(1);

      if (isLegacy.length > 0) {
        throw new BadRequestException(
          `Supplier '${id}' is a legacy ABM supplier and cannot be edited.`,
        );
      }

      throw new NotFoundException(
        `Supplier '${id}' not found in application data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
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
}
