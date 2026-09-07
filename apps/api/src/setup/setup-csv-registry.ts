import { is, getTableColumns } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@herobm/db-schema';

export interface CsvRegistryEntry {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle PgTable with generic columns
  table: PgTable<any>;
  uniqueKey: string;
}

export const EXCLUDED_TABLES = new Set<string>([
  // Internal queues and background jobs
  '_pipeline_jobs',
  'outbox',
  'email_outbox',

  // Security, credentials, and access control policies
  'user_two_factor',
  'api_keys',
  'casbin_rule',
  'users',

  // System singletons (configured via dedicated settings pages)
  'app_settings',
  'gl_settings',
  'organization',

  // Technical templates, hooks, and integrations
  'pdf_templates',
  'pdf_template_hooks',
  'pdf_template_contexts',
  'business_reports',
  'macros',
  'webhooks',
  'integrations',
  'reconciliation_rules',
  'gl_match_groups',
  'csv_mapping_profiles',
  'user_settings',
]);

const ACRONYMS: Record<string, string> = {
  crm: 'CRM',
  gl: 'GL',
  uom: 'UoM',
  po: 'PO',
  so: 'SO',
  ar: 'AR',
  ap: 'AP',
  id: 'ID',
};

const TABLE_NAME_OVERRIDES: Record<string, string> = {
  gl_accounts: 'GL Accounts (Chart of Accounts)',
  uom_dictionary: 'UoM Dictionary',
  bin_contents: 'Bin Contents (Stock on Hand)',
};

export function formatTableName(tableName: string): string {
  if (TABLE_NAME_OVERRIDES[tableName]) {
    return TABLE_NAME_OVERRIDES[tableName];
  }
  return tableName
    .split('_')
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS[lower]) {
        return ACRONYMS[lower];
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic column inspection across arbitrary schema tables
export function resolveUniqueKey(table: PgTable<any>): string {
  const cols = getTableColumns(table);
  const colList = Object.values(cols) as unknown as Array<{
    name: string;
    primary?: boolean;
    isUnique?: boolean;
  }>;

  // 1. Natural business unique key (unique non-PK ending in _number, _code, or named 'code', excluding migration source_id)
  const businessUnique = colList.find(
    (c) =>
      c.isUnique &&
      !c.primary &&
      c.name !== 'source_id' &&
      (c.name.endsWith('_number') ||
        c.name.endsWith('_code') ||
        c.name === 'code'),
  );
  if (businessUnique) return businessUnique.name;

  // 2. Primary key column
  const pk = colList.find((c) => c.primary);
  if (pk) return pk.name;

  // 3. Any other non-primary unique column (excluding migration source_id)
  const anyUnique = colList.find(
    (c) => c.isUnique && !c.primary && c.name !== 'source_id',
  );
  if (anyUnique) return anyUnique.name;

  // 4. Fallback to first column name
  return colList[0]?.name || 'id';
}

export function buildCsvRegistry(): CsvRegistryEntry[] {
  const entries: CsvRegistryEntry[] = [];
  const seenTables = new Set<string>();

  for (const [, val] of Object.entries(schema)) {
    if (!val || typeof val !== 'object' || !is(val, PgTable)) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle PgTable instance
    const table = val as PgTable<any>;
    const tableName =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle internal symbol extraction
      (table as any)[Symbol.for('drizzle:Name')] ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle internal config extraction
      (table as any)._?.name;

    if (!tableName || typeof tableName !== 'string') {
      continue;
    }

    // Skip internal, security, and audit event tables
    if (
      tableName.startsWith('_') ||
      tableName.endsWith('_events') ||
      EXCLUDED_TABLES.has(tableName) ||
      seenTables.has(tableName)
    ) {
      continue;
    }

    seenTables.add(tableName);

    entries.push({
      id: tableName,
      name: formatTableName(tableName),
      table,
      uniqueKey: resolveUniqueKey(table),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
