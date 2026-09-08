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
  organizations,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  SUPPLIER_TRANSITIONS,
  SUPPLIER_STATE,
  SupplierState,
  ORGANIZATION_STATE,
} from '@herobm/shared';
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
   * Create a new supplier in herobm_core.
   * Vendor number uniqueness is enforced by the DB UNIQUE constraint.
   */
  async create(dto: CreateSupplierDto, actor: string) {
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const {
        name,
        businessNumber,
        isTaxRegistered,
        address1Line1,
        address1Line2,
        address1City,
        address1StateOrProvince,
        address1PostalCode,
        address1Country,
        telephone1,
        fax,
        emailAddress1,
        vendorNumber,
        organizationId,
        ...supplierFields
      } = dto as unknown as Record<string, unknown>;

      const effectiveOrgId = organizationId as string | undefined;
      let orgRecord;
      if (effectiveOrgId) {
        const existingOrgs = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.organizationId, effectiveOrgId))
          .limit(1);

        if (existingOrgs.length === 0) {
          throw new BadRequestException(
            `Organization with id '${effectiveOrgId}' does not exist`,
          );
        }
        orgRecord = existingOrgs[0];
      } else {
        [orgRecord] = await tx
          .insert(organizations)
          .values({
            stateCode: ORGANIZATION_STATE.ACTIVE,
            name: name as string,
            businessNumber: (businessNumber as string) || null,
            isTaxRegistered: (isTaxRegistered as boolean) ?? false,
            headquartersAddressLine1: address1Line1 as string,
            headquartersAddressLine2: address1Line2 as string,
            headquartersCity: address1City as string,
            headquartersStateOrProvince: address1StateOrProvince as string,
            headquartersPostalCode: address1PostalCode as string,
            headquartersCountry: address1Country as string,
            telephone: telephone1 as string,
            fax: fax as string,
            email: emailAddress1 as string,
          })
          .returning();
      }

      const [supplier] = await tx
        .insert(coreSuppliers)
        .values({
          ...supplierFields,
          vendorNumber: vendorNumber as string,
          organizationId: orgRecord.organizationId,
          currencyCode: dto.currencyCode || this.appConfig.homeCurrency(),
          createdBy: actor,
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.SUPPLIER,
        entityId: supplier.vendorId,
        eventType: EventType.CREATED,
        entityDisplayName: dto.name,
        payload: dto,
        actor,
      });

      return {
        ...supplier,
        name: orgRecord.name,
        businessNumber: orgRecord.businessNumber,
        isTaxRegistered: orgRecord.isTaxRegistered,
        address1Line1: dto.address1Line1,
        address1Line2: dto.address1Line2,
        address1City: dto.address1City,
        address1StateOrProvince: dto.address1StateOrProvince,
        address1PostalCode: dto.address1PostalCode,
        address1Country: dto.address1Country,
        telephone1: orgRecord.telephone,
        fax: orgRecord.fax,
        emailAddress1: orgRecord.email,
      };
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
    const existingRows = await this.db
      .select({
        supplier: coreSuppliers,
        organizationName: organizations.name,
      })
      .from(coreSuppliers)
      .leftJoin(
        organizations,
        eq(coreSuppliers.organizationId, organizations.organizationId),
      )
      .where(eq(coreSuppliers.vendorId, id))
      .limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundException(`Supplier '${id}' not found`);
    }
    const existing = existingRows[0].supplier;
    const existingOrgName = existingRows[0].organizationName;

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const coreChanges = { ...dto } as Record<string, unknown>;
      const orgKeys = [
        'name',
        'businessNumber',
        'isTaxRegistered',
        'address1Line1',
        'address1Line2',
        'address1City',
        'address1StateOrProvince',
        'address1PostalCode',
        'address1Country',
        'telephone1',
        'fax',
        'emailAddress1',
      ];
      const orgUpdate: Record<string, unknown> = {};

      for (const k of orgKeys) {
        if (k in coreChanges) {
          if (k === 'name') orgUpdate.name = coreChanges.name;
          if (k === 'businessNumber')
            orgUpdate.businessNumber = coreChanges.businessNumber;
          if (k === 'isTaxRegistered')
            orgUpdate.isTaxRegistered = coreChanges.isTaxRegistered;
          if (k === 'telephone1')
            orgUpdate.telephone =
              typeof coreChanges.telephone1 === 'string'
                ? coreChanges.telephone1.trim()
                : coreChanges.telephone1;
          if (k === 'fax')
            orgUpdate.fax =
              typeof coreChanges.fax === 'string'
                ? coreChanges.fax.trim()
                : coreChanges.fax;
          if (k === 'emailAddress1')
            orgUpdate.email =
              typeof coreChanges.emailAddress1 === 'string'
                ? coreChanges.emailAddress1.trim()
                : coreChanges.emailAddress1;
          delete coreChanges[k];
        }
      }

      const addressParts = [
        'address1Line1',
        'address1Line2',
        'address1City',
        'address1StateOrProvince',
        'address1PostalCode',
        'address1Country',
      ];

      const hasAddressChange = addressParts.some((k) => k in coreChanges);
      if (hasAddressChange) {
        orgUpdate.headquartersAddressLine1 =
          coreChanges.address1Line1 as string;
        orgUpdate.headquartersAddressLine2 =
          coreChanges.address1Line2 as string;
        orgUpdate.headquartersCity = coreChanges.address1City as string;
        orgUpdate.headquartersStateOrProvince =
          coreChanges.address1StateOrProvince as string;
        orgUpdate.headquartersPostalCode =
          coreChanges.address1PostalCode as string;
        orgUpdate.headquartersCountry = coreChanges.address1Country as string;

        for (const k of addressParts) {
          delete coreChanges[k];
        }
      }

      const audit = calculateAuditTrail(coreChanges, existing, AuditMode.DIFF);

      if (Object.keys(orgUpdate).length > 0 && existing.organizationId) {
        await tx
          .update(organizations)
          .set({ ...orgUpdate, modifiedOn: new Date() })
          .where(eq(organizations.organizationId, existing.organizationId));
      }

      let updated = existing;
      if (audit.hasChanges) {
        const [res] = await tx
          .update(coreSuppliers)
          .set({
            ...audit.changes,
            modifiedOn: new Date(),
          })
          .where(eq(coreSuppliers.vendorId, id))
          .returning();
        updated = res;
      }

      if (audit.hasChanges || Object.keys(orgUpdate).length > 0) {
        const changedKeys = Object.keys(audit.changes);
        const isStatusOnly =
          changedKeys.length === 1 &&
          changedKeys[0] === 'stateCode' &&
          Object.keys(orgUpdate).length === 0;

        const displayName =
          (orgUpdate.name as string) || existingOrgName || 'Unknown';

        if (isStatusOnly) {
          await emitEvent(tx, {
            entityType: EntityType.SUPPLIER,
            entityId: id,
            eventType: EventType.STATUS_CHANGED,
            entityDisplayName: displayName,
            payload: {
              from: existing.stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await emitEvent(tx, {
            entityType: EntityType.SUPPLIER,
            entityId: id,
            eventType: EventType.UPDATED,
            entityDisplayName: displayName,
            payload: {
              changes: { ...audit.changes, ...orgUpdate },
              previousValues: audit.previousValues,
            },
            actor,
          });
        }
      }

      return {
        ...updated,
        name: orgUpdate.name ?? existingOrgName,
      };
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

    const existingRows = await db
      .select({
        supplier: coreSuppliers,
        organizationName: organizations.name,
      })
      .from(coreSuppliers)
      .leftJoin(
        organizations,
        eq(coreSuppliers.organizationId, organizations.organizationId),
      )
      .where(eq(coreSuppliers.vendorId, vendorId))
      .limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundException(`Supplier '${vendorId}' not found`);
    }

    const existing = existingRows[0].supplier;
    const organizationName = existingRows[0].organizationName;

    const currentState = existing.stateCode;

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
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(coreSuppliers.vendorId, vendorId))
      .returning();

    const targetTx = tx || this.db;
    const eventPayload = {
      from: currentState,
      to: newState,
    };

    if (newState === SUPPLIER_STATE.ARCHIVED) {
      await emitEvent(targetTx as unknown as Parameters<typeof emitEvent>[0], {
        entityType: EntityType.SUPPLIER,
        entityId: vendorId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: organizationName || 'Unknown',
        payload: eventPayload,
        actor,
      });
    } else if (currentState === SUPPLIER_STATE.ARCHIVED) {
      await emitEvent(targetTx as unknown as Parameters<typeof emitEvent>[0], {
        entityType: EntityType.SUPPLIER,
        entityId: vendorId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: organizationName || 'Unknown',
        payload: eventPayload,
        actor,
      });
    } else {
      await emitEvent(targetTx as unknown as Parameters<typeof emitEvent>[0], {
        entityType: EntityType.SUPPLIER,
        entityId: vendorId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: organizationName || 'Unknown',
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }

  // --- Expiries Methods ---

  async createExpiry(
    vendorId: string,
    dto: CreateSupplierExpiryDto,
    actor: string,
  ) {
    const existing = await this.db
      .select({ id: coreSuppliers.vendorId, name: organizations.name })
      .from(coreSuppliers)
      .leftJoin(
        organizations,
        eq(coreSuppliers.organizationId, organizations.organizationId),
      )
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

    await emitEvent(this.db as unknown as Parameters<typeof emitEvent>[0], {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.ADDED_EXPIRY,
      entityDisplayName: existing[0].name || 'Unknown',
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
        supplierName: organizations.name,
      })
      .from(supplierExpiries)
      .innerJoin(
        coreSuppliers,
        eq(coreSuppliers.vendorId, supplierExpiries.vendorId),
      )
      .leftJoin(
        organizations,
        eq(coreSuppliers.organizationId, organizations.organizationId),
      )
      .where(
        sql`${supplierExpiries.expiryId} = ${expiryId} AND ${supplierExpiries.vendorId} = ${vendorId}`,
      );

    if (existing.length === 0)
      throw new NotFoundException('Expiry not found on this vendor');

    const updateData: {
      modifiedOn: ReturnType<typeof sql>;
      expiryType?: 'insurance' | 'tax_certificate' | 'trial_period' | 'other';
      expiryDate?: string;
      notes?: string;
    } = { modifiedOn: sql`NOW()` };
    if (dto.expiryType !== undefined) updateData.expiryType = dto.expiryType;
    if (dto.expiryDate !== undefined) updateData.expiryDate = dto.expiryDate;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const result = await this.db
      .update(supplierExpiries)
      .set(updateData)
      .where(eq(supplierExpiries.expiryId, expiryId))
      .returning();

    await emitEvent(this.db as unknown as Parameters<typeof emitEvent>[0], {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.UPDATED_EXPIRY,
      entityDisplayName: existing[0].supplierName || 'Unknown',
      payload: { expiryId },
      actor,
    });
    return result[0];
  }

  async deleteExpiry(vendorId: string, expiryId: string, actor: string) {
    const existing = await this.db
      .select({
        expiryType: supplierExpiries.expiryType,
        supplierName: organizations.name,
      })
      .from(supplierExpiries)
      .innerJoin(
        coreSuppliers,
        eq(coreSuppliers.vendorId, supplierExpiries.vendorId),
      )
      .leftJoin(
        organizations,
        eq(coreSuppliers.organizationId, organizations.organizationId),
      )
      .where(
        sql`${supplierExpiries.expiryId} = ${expiryId} AND ${supplierExpiries.vendorId} = ${vendorId}`,
      );

    if (existing.length === 0) throw new NotFoundException('Expiry not found');

    const type = existing[0].expiryType;

    await this.db
      .delete(supplierExpiries)
      .where(eq(supplierExpiries.expiryId, expiryId));

    await emitEvent(this.db as unknown as Parameters<typeof emitEvent>[0], {
      entityType: EntityType.SUPPLIER,
      entityId: vendorId,
      eventType: EventType.DELETED_EXPIRY,
      entityDisplayName: existing[0].supplierName || 'Unknown',
      payload: { type },
      actor,
    });
    return { status: 'deleted' };
  }
}
