import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { Enforcer } from 'casbin';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  masterDataEvents,
  customers as coreAccounts,
} from '../drizzle/herobm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  CUSTOMER_TRANSITIONS,
  CUSTOMER_STATE,
  CustomerState,
  getValidStates,
  SystemResource,
} from '@herobm/shared';

import { calculateAuditTrail, AuditMode } from '../common/audit';
import { CreateAccountDto, UpdateAccountDto } from './dto';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

import { AppConfigService } from '../settings/app-config.service';
import { buildUpdatePayload } from '../common/utils/drizzle-utils';

@Injectable()
export class AccountsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    @Inject(CASBIN_ENFORCER) private readonly enforcer: Enforcer,
  ) {}

  // Phase 8: [x] Implement strict server-side diffing in `AccountsWriteService`
  private readonly logger = new Logger(AccountsWriteService.name);

  async create(dto: CreateAccountDto, actor: string) {
    // 1. Check if customer number exists in core
    const coreExisting = await this.db
      .select({ id: coreAccounts.customerId })
      .from(coreAccounts)
      .where(eq(coreAccounts.customerNumber, dto.customerNumber))
      .limit(1);

    if (coreExisting.length > 0) {
      throw new BadRequestException(
        `Customer number '${dto.customerNumber}' already exists in application data`,
      );
    }

    // Legacy ABM customers are now in core — the check above covers both.

    const sanitizedDto = buildUpdatePayload(dto);

    let result;
    try {
      result = await this.db.transaction(async (tx: DrizzleDB) => {
        const [customer] = await tx
          .insert(coreAccounts)
          .values({
            ...sanitizedDto,
            currencyCode:
              sanitizedDto.currencyCode || this.appConfig.homeCurrency(),
            createdBy: actor,
          } as typeof coreAccounts.$inferInsert)
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.CUSTOMER,
          entityId: customer.customerId,
          eventType: EventType.CREATED,
          entityDisplayName: customer.name,
          payload: dto,
          actor,
        });

        return customer;
      });
    } catch (e: unknown) {
      const pgCode =
        (e as { code?: string; cause?: { code?: string } }).code ||
        (e as { code?: string; cause?: { code?: string } }).cause?.code;
      if (pgCode === '23505') {
        throw new ConflictException(
          `Customer number '${dto.customerNumber}' already exists`,
        );
      }
      throw e;
    }

    this.logger.log(
      `Customer created: ${dto.customerNumber} (ID: ${result.customerId}) by ${actor}`,
    );
    return result;
  }

  async update(
    id: string,
    dto: UpdateAccountDto,
    actor: string,
    actorRole: string,
  ) {
    const existing = await this.db
      .select()
      .from(coreAccounts)
      .where(
        isUuid(id)
          ? eq(coreAccounts.customerId, id)
          : eq(coreAccounts.sourceId, id),
      )
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Customer '${id}' not found`);
    }
    const sanitizedDto = buildUpdatePayload(dto);

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(
        sanitizedDto,
        existing[0],
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

      // Perform the update
      const [updated] = await tx
        .update(coreAccounts)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        } as typeof coreAccounts.$inferInsert)
        .where(eq(coreAccounts.customerId, id))
        .returning();

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
            entityDisplayName: updated.name,
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
      .from(coreAccounts)
      .where(eq(coreAccounts.customerId, id))
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
      .select()
      .from(coreAccounts)
      .where(eq(coreAccounts.customerId, customerId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Customer '${customerId}' not found`);
    }
    const currentState = existing[0].stateCode;

    if (currentState === newState) {
      return existing[0];
    }

    // Validation
    const allowed = CUSTOMER_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Invalid customer state transition: '${currentState}' -> '${newState}'. Valid next states: ${allowed.join(', ') || 'None'}`,
      );
    }

    const [updated] = await db
      .update(coreAccounts)
      .set({
        stateCode: newState,
        modifiedOn: new Date(),
      })
      .where(eq(coreAccounts.customerId, customerId))
      .returning();

    const targetTx = tx || this.db;
    const eventPayload = { from: currentState, to: newState };

    if (newState === CUSTOMER_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: existing[0].name,
        payload: eventPayload,
        actor,
      });
    } else if (currentState === CUSTOMER_STATE.ARCHIVED) {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: existing[0].name,
        payload: eventPayload,
        actor,
      });
    } else {
      await emitEvent(targetTx, {
        entityType: EntityType.CUSTOMER,
        entityId: customerId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing[0].name,
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }
}
