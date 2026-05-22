import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  customerEvents,
  customers as coreAccounts,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import {
  CUSTOMER_TRANSITIONS,
  CUSTOMER_STATE,
  CustomerState,
  getValidStates,
} from '@modbm/shared';

import { calculateAuditTrail, AuditMode } from '../common/audit';
import { CreateAccountDto, UpdateAccountDto } from './dto';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class AccountsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
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

    const allowedKeys: (keyof CreateAccountDto)[] = [
      'customerNumber',
      'name',
      'address1Line1',
      'address1Line2',
      'address1City',
      'address1StateOrProvince',
      'address1PostalCode',
      'address1Country',
      'telephone1',
      'fax',
      'emailAddress1',
      'primaryContactName',
      'primaryContactEmail',
      'primaryContactPhone',
      'customerGroupId',
      'taxCategoryId',
      'currencyCode',

      'notes',
    ];

    const sanitizedDto: any = {};
    for (const key of allowedKeys) {
      if (key in dto && dto[key] !== undefined) {
        sanitizedDto[key] = dto[key];
      }
    }

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
          })
          .returning();

        await tx.insert(customerEvents).values({
          customerId: customer.customerId,
          eventType: 'created',
          payload: dto,
          actor,
        });

        return customer;
      });
    } catch (e: any) {
      const pgCode = e.code || e.cause?.code;
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

  async update(id: string, dto: UpdateAccountDto, actor: string) {
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

    const allowedKeys: (keyof UpdateAccountDto)[] = [
      'name',
      'address1Line1',
      'address1Line2',
      'address1City',
      'address1StateOrProvince',
      'address1PostalCode',
      'address1Country',
      'telephone1',
      'fax',
      'emailAddress1',
      'primaryContactName',
      'primaryContactEmail',
      'primaryContactPhone',
      'customerGroupId',
      'stateCode',
      'taxCategoryId',
      'currencyCode',

      'notes',
    ];

    const sanitizedDto: any = {};
    for (const key of allowedKeys) {
      if (key in dto && dto[key] !== undefined) {
        sanitizedDto[key] = dto[key];
      }
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const audit = calculateAuditTrail(
        sanitizedDto,
        existing[0],
        AuditMode.DIFF,
      );

      // Perform the update
      const [updated] = await tx
        .update(coreAccounts)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        })
        .where(eq(coreAccounts.customerId, id))
        .returning();

      // Record audit event if something actually changed
      if (audit.hasChanges) {
        const changedKeys = Object.keys(audit.changes);
        const isStatusOnly =
          changedKeys.length === 1 && changedKeys[0] === 'stateCode';

        await tx.insert(customerEvents).values({
          customerId: id,
          eventType: isStatusOnly ? 'status_changed' : 'updated',
          payload: isStatusOnly
            ? {
                from: audit.previousValues.stateCode,
                to: audit.changes.stateCode,
              }
            : {
                changes: audit.changes,
                previousValues: audit.previousValues,
              },
          actor,
        });
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
      .from(customerEvents)
      .where(
        sql`${customerEvents.customerId} = ${id} AND ${customerEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${customerEvents.createdOn} DESC`)
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

    const currentState = existing[0].stateCode as CustomerState;

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
        stateCode: newState as any, // eslint-disable-line
        modifiedOn: new Date(),
      })
      .where(eq(coreAccounts.customerId, customerId))
      .returning();

    if (tx) {
      await tx.insert(customerEvents).values({
        customerId,
        eventType:
          newState === CUSTOMER_STATE.ARCHIVED
            ? EventType.ARCHIVED
            : EventType.STATUS_CHANGED,
        payload: {
          from: currentState,
          to: newState,
        },
        actor,
      });
    } else {
      await this.db.insert(customerEvents).values({
        customerId,
        eventType:
          newState === CUSTOMER_STATE.ARCHIVED
            ? EventType.ARCHIVED
            : EventType.STATUS_CHANGED,
        payload: {
          from: currentState,
          to: newState,
        },
        actor,
      });
    }

    return updated;
  }
}
