import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { Enforcer } from 'casbin';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  masterDataEvents,
  customers,
  actors,
  actorActorLinks,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  CUSTOMER_TRANSITIONS,
  CUSTOMER_STATE,
  CustomerState,
  ACTOR_STATE,
  getValidStates,
  SystemResource,
} from '@herobm/shared';

import { calculateAuditTrail, AuditMode } from '../common/audit';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

import { AppConfigService } from '../settings/app-config.service';
import { buildUpdatePayload } from '../common/utils/drizzle-utils';

@Injectable()
export class CustomersWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    @Inject(CASBIN_ENFORCER) private readonly enforcer: Enforcer,
  ) {}

  // Phase 8: [x] Implement strict server-side diffing in `CustomersWriteService`
  private readonly logger = new Logger(CustomersWriteService.name);

  async create(dto: CreateCustomerDto, actor: string) {
    // 1. Check if customer number exists in core
    const coreExisting = await this.db
      .select({ id: customers.customerId })
      .from(customers)
      .where(eq(customers.customerNumber, dto.customerNumber))
      .limit(1);

    if (coreExisting.length > 0) {
      throw new BadRequestException(
        `Customer number '${dto.customerNumber}' already exists in application data`,
      );
    }

    // Legacy ABM customers are now in core — the check above covers both.

    const sanitizedDto = buildUpdatePayload(dto);

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const {
        name,
        businessNumber,
        isTaxRegistered,
        billingAddressLine1,
        billingAddressLine2,
        billingAddressCity,
        billingAddressStateOrProvince,
        billingAddressPostalCode,
        billingAddressCountry,
        telephone1,
        fax,
        emailAddress1,
        actorId,
        parentCustomerId,
        ...customerFields
      } = sanitizedDto as Record<string, unknown>;

      let actorRecord;
      if (actorId) {
        const existingActors = await tx
          .select()
          .from(actors)
          .where(eq(actors.actorId, actorId as string))
          .limit(1);

        if (existingActors.length === 0) {
          throw new BadRequestException(
            `Actor with id '${actorId as string}' does not exist`,
          );
        }
        actorRecord = existingActors[0];
      } else {
        [actorRecord] = await tx
          .insert(actors)
          .values({
            stateCode: ACTOR_STATE.ACTIVE,
            name: name as string,
            businessNumber: (businessNumber as string) || null,
            isTaxRegistered: (isTaxRegistered as boolean) ?? false,
            headquartersAddressLine1: billingAddressLine1 as string,
            headquartersAddressLine2: billingAddressLine2 as string,
            headquartersCity: billingAddressCity as string,
            headquartersStateOrProvince:
              billingAddressStateOrProvince as string,
            headquartersPostalCode: billingAddressPostalCode as string,
            headquartersCountry: billingAddressCountry as string,
            telephone: telephone1 as string,
            fax: fax as string,
            email: emailAddress1 as string,
          })
          .returning();
      }

      const [customer] = await tx
        .insert(customers)
        .values({
          ...customerFields,
          actorId: actorRecord.actorId,
          stateCode:
            (customerFields.stateCode as string) || CUSTOMER_STATE.ACTIVE,
          source: (customerFields.source as string) || 'system',
          currencyCode:
            (customerFields.currencyCode as string) ||
            this.appConfig.homeCurrency(),
          createdBy: actor,
        } as typeof customers.$inferInsert)
        .returning();

      if (parentCustomerId) {
        const parentRows = await tx
          .select({ actorId: customers.actorId })
          .from(customers)
          .where(eq(customers.customerId, parentCustomerId as string))
          .limit(1);

        if (parentRows.length > 0 && parentRows[0].actorId) {
          await tx.insert(actorActorLinks).values({
            sourceActorId: actorRecord.actorId,
            targetActorId: parentRows[0].actorId,
            linkType: 'parent_company',
          });
        }
      }

      await emitEvent(tx, {
        entityType: EntityType.CUSTOMER,
        entityId: customer.customerId,
        eventType: EventType.CREATED,
        entityDisplayName: name as string,
        payload: dto,
        actor,
      });

      return {
        ...customer,
        name: actorRecord.name,
        businessNumber: actorRecord.businessNumber,
        isTaxRegistered: actorRecord.isTaxRegistered,
        billingAddressLine1: actorRecord.headquartersAddressLine1,
        billingAddressLine2: actorRecord.headquartersAddressLine2,
        billingAddressCity: actorRecord.headquartersCity,
        billingAddressStateOrProvince: actorRecord.headquartersStateOrProvince,
        billingAddressPostalCode: actorRecord.headquartersPostalCode,
        billingAddressCountry: actorRecord.headquartersCountry,
        telephone1: actorRecord.telephone,
        fax: actorRecord.fax,
        emailAddress1: actorRecord.email,
      };
    });

    this.logger.log(
      `Customer created: ${dto.customerNumber} (ID: ${result.customerId}) by ${actor}`,
    );
    return result;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actor: string,
    actorRole: string,
  ) {
    const existingRows = await this.db
      .select({
        customer: customers,
        actor: actors,
      })
      .from(customers)
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .where(
        isUuid(id) ? eq(customers.customerId, id) : eq(customers.sourceId, id),
      )
      .limit(1);

    if (existingRows.length === 0) {
      throw new NotFoundException(`Customer '${id}' not found`);
    }
    const existing = existingRows[0].customer;
    const actorRow = existingRows[0].actor;
    const existingActorName = actorRow?.name;
    const sanitizedDto = buildUpdatePayload(dto);

    const existingComposite = {
      ...existing,
      name: actorRow?.name,
      businessNumber: actorRow?.businessNumber,
      isTaxRegistered: actorRow?.isTaxRegistered,
      billingAddressLine1: actorRow?.headquartersAddressLine1,
      billingAddressLine2: actorRow?.headquartersAddressLine2,
      billingAddressCity: actorRow?.headquartersCity,
      billingAddressStateOrProvince: actorRow?.headquartersStateOrProvince,
      billingAddressPostalCode: actorRow?.headquartersPostalCode,
      billingAddressCountry: actorRow?.headquartersCountry,
      telephone1: actorRow?.telephone,
      fax: actorRow?.fax,
      emailAddress1: actorRow?.email,
    };

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(
        sanitizedDto,
        existingComposite,
        AuditMode.DIFF,
      );

      // Enforce CREDIT_CONTROL permission if any credit fields changed
      if (
        audit.hasChanges &&
        (audit.changes.creditLimit !== undefined ||
          audit.changes.tradingTermsId !== undefined ||
          audit.changes.isOnCreditHold !== undefined ||
          audit.changes.overrideCreditHoldUntil !== undefined)
      ) {
        const canManageCredit = await this.enforcer.enforce(
          actorRole,
          SystemResource.CREDIT_CONTROL,
          'write',
        );
        if (!canManageCredit) {
          throw new ForbiddenException(
            'You do not have permission to modify credit control settings (credit limit, trading terms, or credit holds).',
          );
        }
      }

      const coreChanges = { ...dto } as Record<string, unknown>;
      let newParentCustomerId: string | null | undefined;
      if ('parentCustomerId' in coreChanges) {
        newParentCustomerId = coreChanges.parentCustomerId as string | null;
        delete coreChanges.parentCustomerId;
      }

      const actorKeys = [
        'name',
        'businessNumber',
        'isTaxRegistered',
        'billingAddressLine1',
        'billingAddressLine2',
        'billingAddressCity',
        'billingAddressStateOrProvince',
        'billingAddressPostalCode',
        'billingAddressCountry',
      ];
      const actorUpdate: Record<string, unknown> = {};

      for (const k of actorKeys) {
        if (k in coreChanges) {
          const val = coreChanges[k];
          const actorMap: Record<string, string> = {
            billingAddressLine1: 'headquartersAddressLine1',
            billingAddressLine2: 'headquartersAddressLine2',
            billingAddressCity: 'headquartersCity',
            billingAddressStateOrProvince: 'headquartersStateOrProvince',
            billingAddressPostalCode: 'headquartersPostalCode',
            billingAddressCountry: 'headquartersCountry',
          };
          const actorKey = actorMap[k] || k;
          actorUpdate[actorKey] = val;
          delete coreChanges[k];
        }
      }

      if (Object.keys(actorUpdate).length > 0) {
        actorUpdate.modifiedOn = new Date();
        await tx
          .update(actors)
          .set(actorUpdate)
          .where(eq(actors.actorId, existing.actorId!));
      }

      // Perform the update
      let updated = existing;
      if (Object.keys(coreChanges).length > 0) {
        const [u] = await tx
          .update(customers)
          .set({
            ...coreChanges,
            modifiedOn: new Date(),
          } as typeof customers.$inferInsert)
          .where(eq(customers.customerId, id))
          .returning();
        updated = u;
      }

      if (newParentCustomerId !== undefined) {
        // Find existing parent link
        const existingLink = await tx
          .select({ linkId: actorActorLinks.linkId })
          .from(actorActorLinks)
          .where(
            and(
              eq(actorActorLinks.sourceActorId, existing.actorId!),
              eq(actorActorLinks.linkType, 'parent_company'),
            ),
          )
          .limit(1);

        if (newParentCustomerId) {
          const parentRows = await tx
            .select({ actorId: customers.actorId })
            .from(customers)
            .where(eq(customers.customerId, newParentCustomerId))
            .limit(1);

          if (parentRows.length > 0 && parentRows[0].actorId) {
            if (existingLink.length > 0) {
              await tx
                .update(actorActorLinks)
                .set({ targetActorId: parentRows[0].actorId })
                .where(eq(actorActorLinks.linkId, existingLink[0].linkId));
            } else {
              await tx.insert(actorActorLinks).values({
                sourceActorId: existing.actorId!,
                targetActorId: parentRows[0].actorId,
                linkType: 'parent_company',
              });
            }
          }
        } else {
          // Cleared parent customer
          if (existingLink.length > 0) {
            await tx
              .delete(actorActorLinks)
              .where(eq(actorActorLinks.linkId, existingLink[0].linkId));
          }
        }
      }

      // Record audit event if something actually changed
      if (audit.hasChanges) {
        const changedKeys = Object.keys(audit.changes);
        const isStatusOnly =
          changedKeys.length === 1 && changedKeys[0] === 'stateCode';

        if (isStatusOnly) {
          await emitEvent(tx, {
            entityType: EntityType.CUSTOMER,
            entityId: id,
            eventType: EventType.STATUS_CHANGED,
            entityDisplayName: existingActorName || updated.customerNumber,
            payload: {
              from: audit.previousValues.stateCode,
              to: audit.changes.stateCode,
            },
            actor,
          });
        } else {
          await emitEvent(tx, {
            entityType: EntityType.CUSTOMER,
            entityId: id,
            eventType: EventType.UPDATED,
            entityDisplayName: existingActorName || updated.customerNumber,
            payload: {
              changes: audit.changes,
              previousValues: audit.previousValues,
            },
            actor,
          });
        }
      }

      // Merge updated actor fields (either what was updated, or what existed)
      return {
        ...updated,
        name: actorUpdate.name ?? actorRow?.name,
        businessNumber: actorUpdate.businessNumber ?? actorRow?.businessNumber,
        isTaxRegistered:
          actorUpdate.isTaxRegistered ?? actorRow?.isTaxRegistered,
        billingAddressLine1:
          actorUpdate.headquartersAddressLine1 ??
          actorRow?.headquartersAddressLine1,
        billingAddressLine2:
          actorUpdate.headquartersAddressLine2 ??
          actorRow?.headquartersAddressLine2,
        billingAddressCity:
          actorUpdate.headquartersCity ?? actorRow?.headquartersCity,
        billingAddressStateOrProvince:
          actorUpdate.headquartersStateOrProvince ??
          actorRow?.headquartersStateOrProvince,
        billingAddressPostalCode:
          actorUpdate.headquartersPostalCode ??
          actorRow?.headquartersPostalCode,
        billingAddressCountry:
          actorUpdate.headquartersCountry ?? actorRow?.headquartersCountry,
        telephone1: actorUpdate.telephone ?? actorRow?.telephone,
        fax: actorUpdate.fax ?? actorRow?.fax,
        emailAddress1: actorUpdate.email ?? actorRow?.email,
      };
    });

    this.logger.log(`Customer updated: ${id} by ${actor}`);
    return result;
  }

  /**
   * Archive an customer.
   */
  async archive(id: string, actor: string) {
    return await this.changeCustomerState(id, CUSTOMER_STATE.ARCHIVED, actor);
  }

  /**
   * Unarchive an customer.
   */
  async unarchive(id: string, actor: string) {
    if (!isUuid(id)) {
      throw new BadRequestException(
        `Customer '${id}' is a legacy ABM customer.`,
      );
    }

    const existing = await this.db
      .select()
      .from(customers)
      .where(eq(customers.customerId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Customer '${id}' not found`);
    }

    if (existing[0].stateCode !== CUSTOMER_STATE.ARCHIVED) {
      throw new BadRequestException(`Customer '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(masterDataEvents)
      .where(
        sql`${masterDataEvents.entityId} = ${id} AND ${masterDataEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${masterDataEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      CUSTOMER_STATE.ACTIVE;

    return await this.changeCustomerState(
      id,
      previousState as CustomerState,
      actor,
    );
  }

  /**
   * Centralised state transition logic for customers.
   * Validates against the shared transition map and records audit events.
   */
  async changeCustomerState(
    customerId: string,
    newState: CustomerState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    const existing = await db
      .select({
        customer: customers,
        actorName: actors.name,
      })
      .from(customers)
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .where(eq(customers.customerId, customerId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Customer '${customerId}' not found`);
    }
    const currentState = existing[0].customer.stateCode;

    if (currentState === newState) {
      return existing[0].customer;
    }

    // Validation
    const allowed = CUSTOMER_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Invalid customer state transition: '${currentState}' -> '${newState}'. Valid next states: ${allowed.join(', ') || 'None'}`,
      );
    }

    const [updated] = await db
      .update(customers)
      .set({
        stateCode: newState,
        modifiedOn: new Date(),
      })
      .where(eq(customers.customerId, customerId))
      .returning();

    const targetTx = tx || this.db;
    const eventPayload = { from: currentState, to: newState };

    if (newState === CUSTOMER_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: existing[0].actorName ?? '',
        payload: eventPayload,
        actor,
      });
    } else if (currentState === CUSTOMER_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: existing[0].actorName ?? '',
        payload: eventPayload,
        actor,
      });
    } else {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing[0].actorName ?? '',
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }
}
