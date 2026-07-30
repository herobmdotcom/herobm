import { pgSchema, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { CURRENCIES, CurrencyDef } from '@herobm/shared';

/**
 * Drizzle schema for herobm_core — application-owned operational data.
 *
 * Column naming follows Microsoft CDM conventions (snake_case in Postgres).
 * All tables use UUID primary keys with gen_random_uuid() defaults.
 * Foreign keys reference other herobm_core tables (e.g. customer_id → customers).
 * Schema is managed via migrations in apps/api/migrations/.
 */
export const herobmCore = pgSchema('herobm_core');

export const validCurrencyCheck = (
  tableName: string,
  columnName: string = 'currency_code',
) =>
  check(
    `${tableName}_currency_check`,
    sql.raw(
      `${columnName} IN (${CURRENCIES.map((c: CurrencyDef) => `'${c.code}'`).join(', ')})`,
    ),
  );
