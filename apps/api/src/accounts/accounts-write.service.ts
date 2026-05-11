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
  accountEvents,
  accounts as coreAccounts,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import {
  ACCOUNT_TRANSITIONS,
  ACCOUNT_STATE,
  AccountState,
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
    // 1. Check if account number exists in core
    const coreExisting = await this.db
      .select({ id: coreAccounts.accountId })
      .from(coreAccounts)
      .where(eq(coreAccounts.accountNumber, dto.accountNumber))
      .limit(1);

    if (coreExisting.length > 0) {
      throw new BadRequestException(
        `Account number '${dto.accountNumber}' already exists in application data`,
      );
    }

    // Legacy ABM accounts are now in core — the check above covers both.

    const allowedKeys: (keyof CreateAccountDto)[] = [
      'accountNumber',
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
      'accountGroupId',
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
        const [account] = await tx
          .insert(coreAccounts)
          .values({
            ...sanitizedDto,
            currencyCode:
              sanitizedDto.currencyCode || this.appConfig.homeCurrency(),
            createdBy: actor,
          })
          .returning();

        await tx.insert(accountEvents).values({
          accountId: account.accountId,
          eventType: 'created',
          payload: dto,
          actor,
        });

        return account;
      });
    } catch (e: any) {
      const pgCode = e.code || e.cause?.code;
      if (pgCode === '23505') {
        throw new ConflictException(
          `Account number '${dto.accountNumber}' already exists`,
        );
      }
      throw e;
    }

    this.logger.log(
      `Account created: ${dto.accountNumber} (ID: ${result.accountId}) by ${actor}`,
    );
    return result;
  }

  async update(id: string, dto: UpdateAccountDto, actor: string) {
    const existing = await this.db
      .select()
      .from(coreAccounts)
      .where(
        isUuid(id)
          ? eq(coreAccounts.accountId, id)
          : eq(coreAccounts.sourceId, id),
      )
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Account '${id}' not found`);
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
      'accountGroupId',
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
        .where(eq(coreAccounts.accountId, id))
        .returning();

      // Record audit event if something actually changed
      if (audit.hasChanges) {
        const changedKeys = Object.keys(audit.changes);
        const isStatusOnly =
          changedKeys.length === 1 && changedKeys[0] === 'stateCode';

        await tx.insert(accountEvents).values({
          accountId: id,
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

    this.logger.log(`Account updated: ${id} by ${actor}`);
    return result;
  }

  /**
   * Archive an account.
   */
  async archive(id: string, actor: string) {
    return await this.changeAccountState(id, ACCOUNT_STATE.ARCHIVED, actor);
  }

  /**
   * Unarchive an account.
   */
  async unarchive(id: string, actor: string) {
    if (!isUuid(id)) {
      throw new BadRequestException(`Account '${id}' is a legacy ABM account.`);
    }

    const existing = await this.db
      .select()
      .from(coreAccounts)
      .where(eq(coreAccounts.accountId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Account '${id}' not found`);
    }

    if (existing[0].stateCode !== ACCOUNT_STATE.ARCHIVED) {
      throw new BadRequestException(`Account '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(accountEvents)
      .where(
        sql`${accountEvents.accountId} = ${id} AND ${accountEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${accountEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      ACCOUNT_STATE.ACTIVE;

    return await this.changeAccountState(
      id,
      previousState as AccountState,
      actor,
    );
  }

  /**
   * Centralised state transition logic for accounts.
   * Validates against the shared transition map and records audit events.
   */
  async changeAccountState(
    accountId: string,
    newState: AccountState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    const existing = await db
      .select()
      .from(coreAccounts)
      .where(eq(coreAccounts.accountId, accountId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(`Account '${accountId}' not found`);
    }

    const currentState = existing[0].stateCode as AccountState;

    if (currentState === newState) {
      return existing[0];
    }

    // Validation
    const allowed = ACCOUNT_TRANSITIONS[currentState] || [];
    if (!allowed.includes(newState)) {
      throw new BadRequestException(
        `Invalid account state transition: '${currentState}' -> '${newState}'. Valid next states: ${allowed.join(', ') || 'None'}`,
      );
    }

    const [updated] = await db
      .update(coreAccounts)
      .set({
        stateCode: newState as any, // eslint-disable-line
        modifiedOn: new Date(),
      })
      .where(eq(coreAccounts.accountId, accountId))
      .returning();

    if (tx) {
      await tx.insert(accountEvents).values({
        accountId,
        eventType:
          newState === ACCOUNT_STATE.ARCHIVED
            ? EventType.ARCHIVED
            : EventType.STATUS_CHANGED,
        payload: {
          from: currentState,
          to: newState,
        },
        actor,
      });
    } else {
      await this.db.insert(accountEvents).values({
        accountId,
        eventType:
          newState === ACCOUNT_STATE.ARCHIVED
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
