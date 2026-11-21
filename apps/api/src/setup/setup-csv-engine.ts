import { pipelineJobs, systemEvents, tradingTerms } from '@herobm/db-schema';
import {
  getCountryCode,
  parseLocalDate,
  toInputDateFormat,
} from '@herobm/shared';
import { BadRequestException, Logger } from '@nestjs/common';
import { parse } from 'csv-parse';
import { eq, getTableColumns, getTableName, sql } from 'drizzle-orm';
import type { Response } from 'express';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Readable } from 'stream';
import { emitEvent } from '../common/emit-event';
import { EntityType } from '../common/event-types';
import { DrizzleDB } from '../drizzle/drizzle.module';
import { getCsvProjection, hasCsvProjection } from './setup-csv-projections';
import { CsvRegistryEntry } from './setup-csv-registry';
import { ExportCsvQueryDto } from './setup.dto';

export function formatCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'number' || typeof val === 'bigint') {
    return val.toString();
  }
  if (typeof val === 'string') {
    if (
      val.includes(',') ||
      val.includes('"') ||
      val.includes('\n') ||
      val.includes('\r')
    ) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
  if (typeof val === 'object') {
    const str = JSON.stringify(val);
    return `"${str.replace(/"/g, '""')}"`;
  }
  const str =
    typeof val === 'string'
      ? val
      : typeof val === 'number' || typeof val === 'bigint'
        ? val.toString()
        : JSON.stringify(val);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportCsvEngine(params: {
  db: DrizzleDB;
  csvRegistry: CsvRegistryEntry[];
  tableName: string;
  options?: ExportCsvQueryDto;
  res?: Response;
  username?: string;
}): Promise<string | void> {
  const {
    db,
    csvRegistry,
    tableName,
    options = {},
    res,
    username = 'system',
  } = params;

  const projection = getCsvProjection(tableName);
  if (projection) {
    const { headers, rows } = await projection.execute(db, options);
    const lines: string[] = [headers.join(',')];
    for (const row of rows) {
      const line = headers.map((h) => formatCsvCell(row[h])).join(',');
      lines.push(line);
    }
    const csvContent = lines.join('\n') + '\n';

    if (res) {
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${tableName}_export_${dateStr}.csv"`,
      );
      res.write(csvContent);
      res.end();
    }

    await db.insert(systemEvents).values({
      entityType: 'system',
      entityId: '00000000-0000-0000-0000-000000000000',
      eventType: 'csv_export_generated',
      entityDisplayName: `CSV Export: ${projection.name}`,
      payload: {
        table: tableName,
        rowCount: rows.length,
        includeArchived: !!options.includeArchived,
      },
      actor: username || 'system',
    });

    if (!res) {
      return csvContent;
    }
    return;
  }

  const registryEntry = csvRegistry.find((r) => r.id === tableName);
  if (!registryEntry) throw new BadRequestException('Unsupported table');

  const excludedColumns = [
    'created_by',
    'created_on',
    'modified_on',
    'updated_on',
  ];

  const tableCols = getTableColumns(registryEntry.table);
  const propToColMap: { prop: string; colName: string }[] = Object.keys(
    tableCols,
  )
    .filter(
      (k) =>
        !excludedColumns.includes(
          (tableCols as Record<string, { name: string }>)[k].name,
        ),
    )
    .map((k) => ({
      prop: k,
      colName: (tableCols as Record<string, { name: string }>)[k].name,
    }));

  const headers = propToColMap.map((m) => m.colName).join(',');

  let query = db.select().from(registryEntry.table).$dynamic();
  const stateCol = (tableCols as unknown as Record<string, unknown>)[
    'stateCode'
  ];
  if (!options.includeArchived && stateCol) {
    query = query.where(sql`${stateCol} != 'archived'`);
  }

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const rows = (await query) as Record<string, unknown>[];

  const lines: string[] = [headers];
  for (const row of rows) {
    const line = propToColMap.map((m) => formatCsvCell(row[m.prop])).join(',');
    lines.push(line);
  }
  const csvContent = lines.join('\n') + '\n';

  if (res) {
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tableName}_export_${dateStr}.csv"`,
    );
    res.write(csvContent);
    res.end();
  }

  // Direct audit recording for CSV export downloads
  const schemaTableName = getTableName(registryEntry.table) || tableName;
  await db.insert(systemEvents).values({
    entityType: 'system',
    entityId: '00000000-0000-0000-0000-000000000000',
    eventType: 'csv_export_generated',
    entityDisplayName: `CSV Export: ${registryEntry.name}`,
    payload: {
      table: schemaTableName,
      rowCount: rows.length,
      includeArchived: !!options.includeArchived,
    },
    actor: username || 'system',
  });

  if (!res) {
    return csvContent;
  }
}

export async function executeCsvEngine(params: {
  db: DrizzleDB;
  csvRegistry: CsvRegistryEntry[];
  tableName: string;
  strategy: string;
  file: Express.Multer.File;
  failStaleJobs: () => Promise<void>;
  log: (
    jobId: string | undefined,
    message: string,
    level?: 'info' | 'error',
  ) => Promise<void>;
  updateJobProgress: (
    jobId: string | undefined,
    stepIndex: number,
    status: string,
  ) => Promise<void>;
  logger: Logger;
}): Promise<{ jobId: string }> {
  const {
    db,
    csvRegistry,
    tableName,
    strategy,
    file,
    failStaleJobs,
    log,
    updateJobProgress,
    logger,
  } = params;

  if (hasCsvProjection(tableName)) {
    throw new BadRequestException(
      'Extended views are export-only and cannot be imported directly',
    );
  }
  const registryEntry = csvRegistry.find((r) => r.id === tableName);
  if (!registryEntry) throw new BadRequestException('Unsupported table');

  await failStaleJobs();
  const [runningJob] = await db
    .select()
    .from(pipelineJobs)
    .where(eq(pipelineJobs.status, 'running'))
    .limit(1);
  if (runningJob) throw new BadRequestException('A job is already running');

  const jobId = Math.random().toString(36).substring(7);
  await db.insert(pipelineJobs).values({
    jobId,
    type: 'csv',
    status: 'running',
    progressJson: [
      { step: 1, name: `Importing CSV to ${tableName}`, status: 'running' },
    ],
    logsJson: [`--- Initializing CSV Import for ${tableName} ---`],
  });

  runCsvCoreEngine({
    db,
    entry: registryEntry,
    strategy,
    file,
    jobId,
    log,
    updateJobProgress,
  }).catch(async (err) => {
    logger.error(`CSV job ${jobId} failed`, err);
    await log(jobId, `FATAL: CSV Import failed: ${err.message}`, 'error');
    await db
      .update(pipelineJobs)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(pipelineJobs.jobId, jobId));
    await updateJobProgress(jobId, 0, 'failed');
  });

  return { jobId };
}

export async function runCsvCoreEngine(params: {
  db: DrizzleDB;
  entry: CsvRegistryEntry;
  strategy: string;
  file: Express.Multer.File;
  jobId: string;
  log: (
    jobId: string | undefined,
    message: string,
    level?: 'info' | 'error',
  ) => Promise<void>;
  updateJobProgress: (
    jobId: string | undefined,
    stepIndex: number,
    status: string,
  ) => Promise<void>;
}): Promise<void> {
  const { db, entry, strategy, file, jobId, log, updateJobProgress } = params;

  const mapCurrencyCode = (val: string | null): string | null => {
    if (!val) return null;
    const up = val.toUpperCase().trim();
    if (up === 'AU') return 'AUD'; // HOME_CURRENCY
    if (up === 'US') return 'USD'; // HOME_CURRENCY
    if (up === 'GB') return 'GBP'; // HOME_CURRENCY
    if (up === 'EU') return 'EUR'; // HOME_CURRENCY
    if (up === 'NZ') return 'NZD'; // HOME_CURRENCY
    return val;
  };

  const parsePhone = (val: string | null): string | null => {
    if (!val) return null;
    try {
      const phoneNumber = parsePhoneNumberFromString(val);
      if (phoneNumber) {
        return phoneNumber.format('E.164');
      }
      return val;
    } catch {
      return val;
    }
  };

  const tableCols = getTableColumns(entry.table);
  const colMappings = Object.keys(tableCols).map((propKey) => ({
    propKey,
    colName: (tableCols as Record<string, { name: string }>)[propKey].name,
  }));

  const tradingTermsMap = new Map<string, string>();
  if (
    colMappings.some(
      (m) =>
        m.colName === 'terms_description' || m.propKey === 'termsDescription',
    )
  ) {
    const allTerms = await db.select().from(tradingTerms);
    for (const term of allTerms) {
      tradingTermsMap.set(
        term.code.toLowerCase(),
        `${term.code} - ${term.description}`,
      );
    }
  }

  await log(jobId, `Starting CSV parsing for strategy: ${strategy}...`);

  const records: Record<string, unknown>[] = [];
  const parser = Readable.from(file.buffer).pipe(
    parse({
      columns: (header: string[]) => header.map((h) => h.replace(/\*$/, '')),
      skip_empty_lines: true,
      trim: true,
    }),
  );

  let parsedCount = 0;
  for await (const record of parser) {
    const dbRecord: Record<string, unknown> = {};
    for (const { propKey, colName } of colMappings) {
      const colDef = (
        tableCols as Record<
          string,
          {
            primary?: boolean;
            hasDefault?: boolean;
            dataType?: string;
            columnType?: string;
          }
        >
      )[propKey];
      const val =
        record[colName] !== undefined ? record[colName] : record[propKey];
      if (val !== undefined) {
        const isEmpty = val === '' || val === null;
        if (isEmpty && (colDef?.primary || colDef?.hasDefault)) {
          continue;
        }
        dbRecord[propKey] = isEmpty ? null : val;
        if (
          (propKey === 'address1Country' || colName === 'address1_country') &&
          dbRecord[propKey]
        ) {
          dbRecord[propKey] =
            getCountryCode(dbRecord[propKey] as string) || dbRecord[propKey];
        }
        if (
          (propKey === 'termsDescription' || colName === 'terms_description') &&
          dbRecord[propKey]
        ) {
          const raw = (dbRecord[propKey] as string).trim();
          dbRecord[propKey] = tradingTermsMap.get(raw.toLowerCase()) || raw;
        }
        if (propKey === 'currencyCode' || colName === 'currency_code') {
          dbRecord[propKey] = mapCurrencyCode(
            dbRecord[propKey] as string | null,
          );
        }
        if (
          (propKey === 'phone' ||
            colName === 'phone' ||
            propKey === 'mobile' ||
            colName === 'mobile') &&
          dbRecord[propKey]
        ) {
          dbRecord[propKey] = parsePhone(dbRecord[propKey] as string | null);
        }
        const colMeta = colDef as unknown as {
          dataType?: string;
          columnType?: string;
        };
        const isDateColumn =
          colMeta?.dataType === 'date' ||
          colMeta?.columnType === 'PgTimestamp' ||
          colMeta?.columnType === 'PgDate' ||
          colName.endsWith('_date') ||
          colName.endsWith('_on') ||
          colName.endsWith('_at') ||
          colName === 'date' ||
          propKey.endsWith('Date') ||
          propKey.endsWith('On') ||
          propKey.endsWith('At');

        if (isDateColumn && typeof dbRecord[propKey] === 'string') {
          const parsed = parseLocalDate(dbRecord[propKey]);
          if (parsed) {
            if (
              colMeta?.columnType === 'PgDate' &&
              colMeta?.dataType === 'string'
            ) {
              dbRecord[propKey] = toInputDateFormat(parsed);
            } else {
              dbRecord[propKey] = parsed;
            }
          }
        }
      }
    }
    records.push(dbRecord);
    parsedCount++;
    if (parsedCount % 1000 === 0) {
      await log(jobId, `Parsed ${parsedCount} rows...`);
    }
  }

  await log(
    jobId,
    `Completed parsing. Total rows: ${records.length}. Starting DB insertion...`,
  );

  // Batch insert
  const BATCH_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const uniqueKeyProp =
      Object.keys(tableCols).find(
        (k) =>
          (tableCols as Record<string, { name: string }>)[k].name ===
            entry.uniqueKey || k === entry.uniqueKey,
      ) || entry.uniqueKey;

    const conflictTarget =
      (entry.table as unknown as Record<string, unknown>)[uniqueKeyProp] ||
      (tableCols as Record<string, unknown>)[uniqueKeyProp];

    if ((strategy === 'upsert' || strategy === 'ignore') && !conflictTarget) {
      throw new BadRequestException(
        `Cannot execute ${strategy} import: no conflict target found for ${entry.id}`,
      );
    }

    if (strategy === 'upsert') {
      const updateSet: Record<string, unknown> = {};
      for (const { propKey, colName } of colMappings) {
        const colDef = (
          tableCols as Record<
            string,
            { primary?: boolean; hasDefault?: boolean }
          >
        )[propKey];
        if (
          colName !== entry.uniqueKey &&
          propKey !== entry.uniqueKey &&
          !colDef?.primary &&
          colName !== 'created_by' &&
          colName !== 'created_on'
        ) {
          updateSet[propKey] = sql`EXCLUDED.${sql.identifier(colName)}`;
        }
      }

      await db
        .insert(entry.table)
        .values(batch)
        .onConflictDoUpdate({
          target: conflictTarget as never,
          set: updateSet,
        });
    } else if (strategy === 'ignore') {
      await db
        .insert(entry.table)
        .values(batch)
        .onConflictDoNothing({
          target: conflictTarget as never,
        });
    } else {
      await db.insert(entry.table).values(batch);
    }

    insertedCount += batch.length;
    await log(
      jobId,
      `Inserted/Upserted ${insertedCount} / ${records.length} rows...`,
    );
  }

  await log(jobId, 'DATA IMPORT COMPLETED SUCCESSFULLY');

  const tableName = getTableName(entry.table) || 'unknown_table';
  // @sync-ignore
  await emitEvent(db as unknown as Parameters<typeof emitEvent>[0], {
    entityType: EntityType.SYSTEM,
    entityId: '00000000-0000-0000-0000-000000000000',
    eventType: 'csv_import_completed',
    entityDisplayName: `CSV Import: ${tableName}`,
    payload: {
      table: tableName,
      rowsImported: insertedCount,
      strategy,
    },
    actor: 'system',
  });

  if (jobId) {
    await db
      .update(pipelineJobs)
      .set({ status: 'done', updatedAt: new Date() })
      .where(eq(pipelineJobs.jobId, jobId));
    await updateJobProgress(jobId, 0, 'done');
  }
}
