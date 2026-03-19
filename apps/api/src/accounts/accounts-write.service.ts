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
  accountEvents,
  accounts as coreAccounts,
} from '../drizzle/modbm-core-schema';
import { accounts as martAccounts } from '../drizzle/schema';
import { calculateAuditTrail, AuditMode } from '../common/audit';

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export interface CreateAccountDto {
  accountNumber: string;
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
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  customerGroup?: string;
  gstPosition?: string;
  currencyCode?: string;
  customerDiscount?: string;
  notes?: string;
}

export interface UpdateAccountDto {
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
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  customerGroup?: string;
  stateCode?: string;
  gstPosition?: string;
  currencyCode?: string;
  customerDiscount?: string;
  notes?: string;
}

@Injectable()
export class AccountsWriteService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

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

    // 2. Check if account number exists in mart (legacy)
    const martExisting = await this.db
      .select({ id: martAccounts.accountId })
      .from(martAccounts)
      .where(eq(martAccounts.accountNumber, dto.accountNumber))
      .limit(1);

    if (martExisting.length > 0) {
      throw new BadRequestException(
        `Account number '${dto.accountNumber}' already exists in legacy ABM data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
      const [account] = await tx
        .insert(coreAccounts)
        .values({
          ...dto,
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

    this.logger.log(
      `Account created: ${dto.accountNumber} (ID: ${result.accountId}) by ${actor}`,
    );
    return result;
  }

  async update(id: string, dto: UpdateAccountDto, actor: string) {
    let existing: any[] = [];
    if (isUuid(id)) {
      existing = await this.db
        .select()
        .from(coreAccounts)
        .where(eq(coreAccounts.accountId, id))
        .limit(1);
    }

    if (existing.length === 0) {
      const isLegacy = await this.db
        .select({ id: martAccounts.accountId })
        .from(martAccounts)
        .where(eq(martAccounts.accountId, id))
        .limit(1);

      if (isLegacy.length > 0) {
        throw new BadRequestException(
          `Account '${id}' is a legacy ABM record and cannot be edited.`,
        );
      }

      throw new NotFoundException(
        `Account '${id}' not found in application data`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
      const audit = calculateAuditTrail(dto, existing[0], AuditMode.DIFF);

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
    if (!isUuid(id)) {
      throw new BadRequestException(
        `Account '${id}' is a legacy ABM account and cannot be archived.`,
      );
    }

    const existing = await this.db
      .select()
      .from(coreAccounts)
      .where(eq(coreAccounts.accountId, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException(
        `Account '${id}' not found in application data`,
      );
    }

    if (existing[0].stateCode === 'archived') {
      throw new BadRequestException(`Account '${id}' is already archived`);
    }

    return await this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(coreAccounts)
        .set({ stateCode: 'archived', modifiedOn: new Date() })
        .where(eq(coreAccounts.accountId, id))
        .returning();

      await tx.insert(accountEvents).values({
        accountId: id,
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

    if (existing[0].stateCode !== 'archived') {
      throw new BadRequestException(`Account '${id}' is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(accountEvents)
      .where(
        sql`${accountEvents.accountId} = ${id} AND ${accountEvents.eventType} = 'archived'`,
      )
      .orderBy(sql`${accountEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      'active';

    return await this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(coreAccounts)
        .set({ stateCode: previousState, modifiedOn: new Date() })
        .where(eq(coreAccounts.accountId, id))
        .returning();

      await tx.insert(accountEvents).values({
        accountId: id,
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
