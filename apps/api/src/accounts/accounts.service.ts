import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { accounts as martAccounts } from '../drizzle/schema';
import {
  accounts as coreAccounts,
  accountEvents,
} from '../drizzle/modbm-core-schema';
import { PaginationQuery, parsePagination } from '../common/pagination';

/** Normalize ABM status codes ('A', 'A1', 'S', 'H', '') to 'active' | 'inactive' */
function normalizeStateCode(raw: string | null | undefined): string {
  if (!raw) return 'active';
  const lower = raw.toLowerCase().trim();
  if (lower === 'active' || lower === 'inactive') return lower;
  // ABM codes: S = suspended, H = on hold → inactive; A/A1/etc → active
  if (lower.startsWith('s') || lower.startsWith('h')) return 'inactive';
  return 'active';
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(query);

    // --- App accounts (modbm_core) ---
    let appQuery = this.db
      .select({
        accountId: coreAccounts.accountId,
        accountNumber: coreAccounts.accountNumber,
        name: coreAccounts.name,
        address1Line1: coreAccounts.address1Line1,
        address1Line2: coreAccounts.address1Line2,
        address1City: coreAccounts.address1City,
        address1StateOrProvince: coreAccounts.address1StateOrProvince,
        address1PostalCode: coreAccounts.address1PostalCode,
        address1Country: coreAccounts.address1Country,
        telephone1: coreAccounts.telephone1,
        fax: coreAccounts.fax,
        emailAddress1: coreAccounts.emailAddress1,
        primaryContactName: coreAccounts.primaryContactName,
        primaryContactEmail: coreAccounts.primaryContactEmail,
        primaryContactPhone: coreAccounts.primaryContactPhone,
        customerGroup: coreAccounts.customerGroup,
        stateCode: coreAccounts.stateCode,
        gstPosition: coreAccounts.gstPosition,
        currencyCode: coreAccounts.currencyCode,
        customerDiscount: coreAccounts.customerDiscount,
        createdOn: coreAccounts.createdOn,
        source: sql<string>`'app'`.as('source'),
      })
      .from(coreAccounts)
      .$dynamic();

    if (searchTerm) {
      appQuery = appQuery.where(
        or(
          ilike(coreAccounts.name, searchTerm),
          ilike(coreAccounts.accountNumber, searchTerm),
          ilike(coreAccounts.emailAddress1, searchTerm),
        ),
      );
    }

    if (!includeArchived) {
      appQuery = appQuery.where(sql`${coreAccounts.stateCode} != 'archived'`);
    }

    // --- Mart accounts (legacy ABM) ---
    let martQuery = this.db
      .select({
        accountId: martAccounts.accountId,
        accountNumber: martAccounts.accountNumber,
        name: martAccounts.name,
        address1Line1: martAccounts.address1Line1,
        address1Line2: martAccounts.address1Line2,
        address1City: martAccounts.address1City,
        address1StateOrProvince: martAccounts.address1StateOrProvince,
        address1PostalCode: martAccounts.address1PostalCode,
        address1Country: martAccounts.address1Country,
        telephone1: martAccounts.telephone1,
        fax: martAccounts.fax,
        emailAddress1: martAccounts.emailAddress1,
        primaryContactName: martAccounts.primaryContactName,
        primaryContactEmail: martAccounts.primaryContactEmail,
        primaryContactPhone: martAccounts.primaryContactPhone,
        customerGroup: martAccounts.customerGroup,
        stateCode: martAccounts.stateCode,
        gstPosition: martAccounts.gstPosition,
        currencyCode: martAccounts.currencyCode,
        customerDiscount: martAccounts.customerDiscount,
        createdOn: martAccounts.createdOn,
        deliveryAddressCount: martAccounts.deliveryAddressCount,
        priceScale: martAccounts.priceScale,
        groupDiscount: martAccounts.groupDiscount,
        source: sql<string>`'abm'`.as('source'),
      })
      .from(martAccounts)
      .$dynamic();

    if (searchTerm) {
      martQuery = martQuery.where(
        or(
          ilike(martAccounts.name, searchTerm),
          ilike(martAccounts.accountNumber, searchTerm),
          ilike(martAccounts.emailAddress1, searchTerm),
        ),
      );
    }

    // Execute both and merge
    const [appRows, martRows] = await Promise.all([appQuery, martQuery]);
    // Normalize ABM state codes
    const normalisedMart = martRows.map((r) => ({
      ...r,
      stateCode: normalizeStateCode(r.stateCode),
    }));
    const unified = [...appRows, ...normalisedMart];

    // Case-insensitive name sort
    unified.sort((a, b) =>
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()),
    );

    // Paginate manually
    const data = unified.slice(offset, offset + limit);

    return { data, page, limit, total: unified.length };
  }

  async findOne(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    // 1. Check core if UUID
    if (isUuid) {
      const coreRows = await this.db
        .select()
        .from(coreAccounts)
        .where(eq(coreAccounts.accountId, id))
        .limit(1);

      if (coreRows.length > 0) {
        const events = await this.db
          .select()
          .from(accountEvents)
          .where(eq(accountEvents.accountId, id))
          .orderBy(accountEvents.createdOn);

        return { ...coreRows[0], source: 'app', events };
      }
    }

    // 2. Check mart table (always safe as accountId is text)
    const martRows = await this.db
      .select()
      .from(martAccounts)
      .where(eq(martAccounts.accountId, id))
      .limit(1);

    if (martRows.length > 0) {
      return {
        ...martRows[0],
        stateCode: normalizeStateCode(martRows[0].stateCode),
        source: 'abm',
        events: [],
      };
    }

    throw new NotFoundException(`Account '${id}' not found`);
  }
}
