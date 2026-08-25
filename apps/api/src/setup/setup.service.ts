// security-ignore: sql-raw
import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { getCountryCode, getErrorMessage } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import {
  appSettings,
  glSettings,
  organization,
  locations,
  glAccounts,
  pipelineJobs,
  tradingTerms,
  systemEvents,
} from '@herobm/db-schema';
import {
  ExecuteSetupDto,
  TestAbmConnectionDto,
  TestOdooConnectionDto,
  ExecuteEltDto,
  ExportCsvQueryDto,
} from './setup.dto';
import type { Response } from 'express';
import { AppConfigService } from '../settings/app-config.service';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { eq, getTableColumns, isNotNull, and, lt } from 'drizzle-orm';
import { Readable } from 'stream';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';
import { parse } from 'csv-parse';
import * as schema from '@herobm/db-schema';
import { EntityType, EventType } from '../common/event-types';
import { emitEvent } from '../common/emit-event';

export interface ActiveJob {
  status: string;
  type: string;
  progress: { step: number; name: string; status: string }[];
  logs: string[];
  lastActivityAt: number;
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  // @herobm-skip-audit
  private async failStaleJobs() {
    const timeoutMinutes = parseInt(
      process.env.PIPELINE_STALE_TIMEOUT_MINUTES || '60',
      10,
    );
    const staleThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    try {
      const runningJobs = await this.db
        .select()
        .from(pipelineJobs)
        .where(
          and(
            eq(pipelineJobs.status, 'running'),
            lt(pipelineJobs.updatedAt, staleThreshold),
          ),
        );

      if (runningJobs.length === 0) return;

      // Attempt to check if pipeline runner still has these jobs active
      let activeJobIdsFromRunner: string[] = [];
      try {
        const runnerUrl =
          process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
        const secret = process.env.PIPELINE_SECRET || '';
        const res = await fetch(`${runnerUrl}/jobs`, {
          headers: secret ? { 'X-Pipeline-Secret': secret } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as { jobs?: string[] };
          activeJobIdsFromRunner = data.jobs || [];
        }
      } catch {
        // Runner unreachable, proceed with timeout logic
      }

      for (const job of runningJobs) {
        if (activeJobIdsFromRunner.includes(job.jobId)) {
          // Job is still actively running on the pipeline runner! Refresh its timestamp.
          await this.db
            .update(pipelineJobs)
            .set({ updatedAt: new Date() })
            .where(eq(pipelineJobs.jobId, job.jobId));
          continue;
        }

        if (
          Array.isArray(job.progressJson) &&
          (job.progressJson as Record<string, unknown>[])[0]
        ) {
          const prog = job.progressJson;
          prog[0].status = 'failed';
          await this.db
            .update(pipelineJobs)
            .set({
              progressJson: prog,
              status: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(pipelineJobs.jobId, job.jobId));
        } else {
          await this.db
            .update(pipelineJobs)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(pipelineJobs.jobId, job.jobId));
        }

        await this.db.execute(sql`
          UPDATE herobm_core._pipeline_jobs 
          SET logs_json = logs_json || ${JSON.stringify([`FATAL: Job timed out due to ${timeoutMinutes} minutes of inactivity.`])}::jsonb 
          WHERE job_id = ${job.jobId}
        `);
      }
    } catch (e) {
      this.logger.error('Failed to clear stale jobs', e);
    }
  }

  // In-memory resolvers for webhook-driven async tasks
  private jobResolvers: Record<
    string,
    { resolve: () => void; reject: (err: Error) => void }
  > = {};

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(AppConfigService) private readonly appConfig: AppConfigService,
  ) {}

  async getResumeState() {
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM raw_abm._resume_state`,
      );
      const rows =
        (result as unknown as { rows?: { table_name: string }[] }).rows ||
        (result as unknown as { table_name: string }[]);
      const tables = rows.map((row: { table_name: string }) =>
        row.table_name.toUpperCase(),
      );
      return { completedTables: tables };
    } catch (e) {
      return { completedTables: [] };
    }
  }

  async getResumeStateOdoo() {
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM raw_odoo._resume_state`,
      );
      const rows =
        (result as unknown as { rows?: { table_name: string }[] }).rows ||
        (result as unknown as { table_name: string }[]);
      const tables = rows.map((row: { table_name: string }) =>
        row.table_name.toLowerCase(),
      );
      return { completedTables: tables };
    } catch (e) {
      return { completedTables: [] };
    }
  }

  async testAbmConnection(dto: TestAbmConnectionDto) {
    this.logger.log(`Testing ABM connection to ${dto.host}...`);

    const envOverride: Record<string, string> = {
      ...process.env,
      SOURCE_DB_HOST: dto.host,
      SOURCE_DB_DATABASE: dto.database,
      SOURCE_DB_USER: dto.username,
      SOURCE_DB_PASSWORD: dto.password,
      SOURCE_DB_PORT: dto.port ? dto.port.toString() : '1433',
    };

    try {
      const runnerUrl =
        process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
      const secret = process.env.PIPELINE_SECRET || '';
      const response = await fetch(`${runnerUrl}/run-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Pipeline-Secret': secret } : {}),
        },
        body: JSON.stringify({
          command: 'python',
          args: ['pipelines/abm_extract/preview.py'],
          env: envOverride,
        }),
      });

      if (!response.ok) {
        return { success: false, message: 'Pipeline runner unreachable' };
      }

      const result = await response.json();
      if (result.error || result.returncode !== 0) {
        let msg = 'Connection failed.';
        try {
          if (result.stdout) {
            const errorJson = JSON.parse(result.stdout.trim());
            if (errorJson.error) msg = errorJson.error;
          }
        } catch (e) {
          msg =
            result.stderr?.substring(0, 200) ||
            result.stdout?.substring(0, 200) ||
            result.error;
        }
        this.logger.error(
          `ABM test connection failed. Runner returned code ${result.returncode}. Stdout: ${result.stdout}. Stderr: ${result.stderr}. Error: ${result.error}`,
        );
        return { success: false, message: msg };
      }

      try {
        const previewData = result.stdout.trim()
          ? JSON.parse(result.stdout.trim())
          : undefined;
        return { success: true, message: 'Connected', preview: previewData };
      } catch (e) {
        return {
          success: false,
          message: 'Invalid response from preview script',
        };
      }
    } catch (error) {
      const runnerUrl =
        process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
      this.logger.error(
        `Failed to connect to pipeline-runner at ${runnerUrl}: ${error.message} (Code: ${error.code || 'unknown'}, Cause: ${error.cause || 'unknown'})`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to connect to pipeline-runner at ${runnerUrl}. Please ensure the service is running.`,
      };
    }
  }

  async testOdooConnection(dto: TestOdooConnectionDto) {
    this.logger.log(`Testing Odoo connection to ${dto.host}...`);

    const envOverride: Record<string, string> = {
      ...process.env,
      SOURCE_DB_HOST: dto.host,
      SOURCE_DB_DATABASE: dto.database,
      SOURCE_DB_USER: dto.username,
      SOURCE_DB_PASSWORD: dto.password,
      SOURCE_DB_PORT: dto.port ? dto.port.toString() : '5432',
    };

    try {
      const runnerUrl =
        process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
      const secret = process.env.PIPELINE_SECRET || '';
      const response = await fetch(`${runnerUrl}/run-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Pipeline-Secret': secret } : {}),
        },
        body: JSON.stringify({
          command: 'python',
          args: ['pipelines/odoo_extract/preview.py'],
          env: envOverride,
        }),
      });

      if (!response.ok) {
        return { success: false, message: 'Pipeline runner unreachable' };
      }

      const result = await response.json();
      if (result.error || result.returncode !== 0) {
        let msg = 'Connection failed.';
        try {
          if (result.stdout) {
            const errorJson = JSON.parse(result.stdout.trim());
            if (errorJson.error) msg = errorJson.error;
          }
        } catch (e) {
          msg =
            result.stderr?.substring(0, 200) ||
            result.stdout?.substring(0, 200) ||
            result.error;
        }
        this.logger.error(
          `Odoo test connection failed. Runner returned code ${result.returncode}. Stdout: ${result.stdout}. Stderr: ${result.stderr}. Error: ${result.error}`,
        );
        return { success: false, message: msg };
      }

      try {
        const previewData = result.stdout.trim()
          ? JSON.parse(result.stdout.trim())
          : undefined;
        return { success: true, message: 'Connected', preview: previewData };
      } catch (e) {
        return {
          success: false,
          message: 'Invalid response from preview script',
        };
      }
    } catch (error) {
      const runnerUrl =
        process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
      this.logger.error(
        `Failed to connect to pipeline-runner at ${runnerUrl}: ${error.message} (Code: ${error.code || 'unknown'}, Cause: ${error.cause || 'unknown'})`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to connect to pipeline-runner at ${runnerUrl}. Please ensure the service is running.`,
      };
    }
  }

  async getValidation() {
    try {
      const appDocs = await this.db.select().from(appSettings).limit(1);
      return {
        status: appDocs.length > 0 ? 'pass' : 'needs_setup',
        metrics: {},
        dataCounts: { appSettings: appDocs.length },
      };
    } catch (error) {
      return { status: 'needs_setup', metrics: {}, dataCounts: {} };
    }
  }

  async getImportSummary() {
    try {
      const [{ count: products }] = await this.db.execute(
        sql`SELECT COUNT(*) FROM herobm_core.products`,
      );
      const [{ count: customers }] = await this.db.execute(
        sql`SELECT COUNT(*) FROM herobm_core.customers`,
      );
      const [{ count: orders }] = await this.db.execute(
        sql`SELECT COUNT(*) FROM herobm_core.sales_orders`,
      );

      return {
        products: parseInt(products as string, 10),
        customers: parseInt(customers as string, 10),
        orders: parseInt(orders as string, 10),
      };
    } catch (err) {
      this.logger.error('Failed to get import summary', err);
      return { products: 0, customers: 0, orders: 0 };
    }
  }

  // --- CSV Import ---
  private csvRegistry = [
    {
      id: 'customers',
      name: 'Customers',
      table: schema.customers,
      uniqueKey: 'customer_number',
    },
    {
      id: 'customer_groups',
      name: 'Customer Groups',
      table: schema.customerGroups,
      uniqueKey: 'code',
    },
    {
      id: 'products',
      name: 'Products',
      table: schema.products,
      uniqueKey: 'product_code',
    },
    {
      id: 'product_groups',
      name: 'Product Groups',
      table: schema.productGroups,
      uniqueKey: 'code',
    },
    {
      id: 'product_components',
      name: 'Product Components',
      table: schema.productComponents,
      uniqueKey: 'component_id',
    },
    {
      id: 'locations',
      name: 'Locations',
      table: schema.locations,
      uniqueKey: 'code',
    },
    { id: 'zones', name: 'Zones', table: schema.zones, uniqueKey: 'code' },
    { id: 'bins', name: 'Bins', table: schema.bins, uniqueKey: 'code' },
    {
      id: 'product_default_bins',
      name: 'Product Default Bins',
      table: schema.productDefaultBins,
      uniqueKey: 'product_default_bin_id',
    },
    {
      id: 'suppliers',
      name: 'Suppliers',
      table: schema.suppliers,
      uniqueKey: 'code',
    },
    {
      id: 'supplier_groups',
      name: 'Supplier Groups',
      table: schema.supplierGroups,
      uniqueKey: 'code',
    },
    {
      id: 'discount_matrix',
      name: 'Discount Matrix',
      table: schema.discountMatrix,
      uniqueKey: 'discount_matrix_id',
    },
    {
      id: 'exchange_rates',
      name: 'Exchange Rates',
      table: schema.exchangeRates,
      uniqueKey: 'currency_code',
    },
    {
      id: 'sales_orders',
      name: 'Sales Orders',
      table: schema.salesOrders,
      uniqueKey: 'order_number',
    },
    {
      id: 'sales_order_lines',
      name: 'Sales Order Lines',
      table: schema.salesOrderLineItems,
      uniqueKey: 'sales_order_line_id',
    },
    {
      id: 'purchase_orders',
      name: 'Purchase Orders',
      table: schema.purchaseOrders,
      uniqueKey: 'order_number',
    },
    {
      id: 'purchase_order_lines',
      name: 'Purchase Order Lines',
      table: schema.purchaseOrderLineItems,
      uniqueKey: 'purchase_order_line_id',
    },
    {
      id: 'transfer_orders',
      name: 'Transfer Orders',
      table: schema.transferOrders,
      uniqueKey: 'order_number',
    },
    {
      id: 'transfer_order_lines',
      name: 'Transfer Order Lines',
      table: schema.transferOrderLines,
      uniqueKey: 'transfer_order_line_id',
    },
    {
      id: 'sales_credit_notes',
      name: 'Sales Credit Notes',
      table: schema.salesCreditNotes,
      uniqueKey: 'credit_note_number',
    },
    {
      id: 'sales_credit_note_lines',
      name: 'Sales Credit Note Lines',
      table: schema.salesCreditNoteLines,
      uniqueKey: 'credit_note_line_id',
    },
    {
      id: 'sales_order_returns',
      name: 'Sales Order Returns',
      table: schema.salesOrderReturns,
      uniqueKey: 'return_number',
    },
    {
      id: 'sales_order_return_lines',
      name: 'Sales Order Return Lines',
      table: schema.salesOrderReturnLines,
      uniqueKey: 'return_line_id',
    },
    {
      id: 'purchase_order_returns',
      name: 'Purchase Order Returns',
      table: schema.purchaseOrderReturns,
      uniqueKey: 'return_number',
    },
    {
      id: 'purchase_order_return_lines',
      name: 'Purchase Order Return Lines',
      table: schema.purchaseOrderReturnLines,
      uniqueKey: 'return_line_id',
    },
  ];

  async getCsvMetadata() {
    const excludedColumns = [
      'created_by',
      'created_on',
      'modified_on',
      'updated_on',
    ];

    return this.csvRegistry
      .map((t) => {
        const cols = getTableColumns(t.table);
        const columns = Object.keys(cols)
          .map((k) => {
            const col = (
              cols as Record<
                string,
                { name: string; notNull: boolean; hasDefault: boolean }
              >
            )[k];
            return {
              name: col.name,
              notNull: col.notNull,
              hasDefault: col.hasDefault,
            };
          })
          .filter((c) => !excludedColumns.includes(c.name))
          .map((c) => {
            const isRequired = c.notNull && !c.hasDefault;
            return isRequired ? `${c.name}*` : c.name;
          });

        return {
          id: t.id,
          name: t.name,
          uniqueKey: t.uniqueKey,
          columns,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private formatCsvCell(val: unknown): string {
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

  // @herobm-skip-audit
  async exportCsv(
    tableName: string,
    options: ExportCsvQueryDto = {},
    res?: Response,
    username: string = 'system',
  ): Promise<string | void> {
    const registryEntry = this.csvRegistry.find((r) => r.id === tableName);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic query builder
    let query: any = this.db.select().from(registryEntry.table);
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
      const line = propToColMap
        .map((m) => this.formatCsvCell(row[m.prop]))
        .join(',');
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
    const schemaTableName =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic table name
      (registryEntry.table as any)[Symbol.for('drizzle:Name')] || tableName;
    await this.db.insert(systemEvents).values({
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

  // @herobm-skip-audit
  async executeCsv(
    tableName: string,
    strategy: string,
    file: Express.Multer.File,
  ) {
    const registryEntry = this.csvRegistry.find((r) => r.id === tableName);
    if (!registryEntry) throw new BadRequestException('Unsupported table');

    await this.failStaleJobs();
    const [runningJob] = await this.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.status, 'running'))
      .limit(1);
    if (runningJob) throw new BadRequestException('A job is already running');

    const jobId = Math.random().toString(36).substring(7);
    await this.db.insert(pipelineJobs).values({
      jobId,
      type: 'csv',
      status: 'running',
      progressJson: [
        { step: 1, name: `Importing CSV to ${tableName}`, status: 'running' },
      ],
      logsJson: [`--- Initializing CSV Import for ${tableName} ---`],
    });

    this.runCsvCore(registryEntry, strategy, file, jobId).catch(async (err) => {
      this.logger.error(`CSV job ${jobId} failed`, err);
      await this.log(
        jobId,
        `FATAL: CSV Import failed: ${err.message}`,
        'error',
      );
      await this.db
        .update(pipelineJobs)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(pipelineJobs.jobId, jobId));
      await this.updateJobProgress(jobId, 0, 'failed');
    });

    return { jobId };
  }

  // @herobm-skip-audit
  private async runCsvCore(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    entry: any,
    strategy: string,
    file: Express.Multer.File,
    jobId: string,
  ) {
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
      } catch (err) {
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
      const allTerms = await this.db.select().from(tradingTerms);
      for (const term of allTerms) {
        tradingTermsMap.set(
          term.code.toLowerCase(),
          `${term.code} - ${term.description}`,
        );
      }
    }

    this.log(jobId, `Starting CSV parsing for strategy: ${strategy}...`);

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
      // Map back to db columns, stripping unknown columns and casting empty strings to null for text fields
      const dbRecord: Record<string, unknown> = {};
      for (const { propKey, colName } of colMappings) {
        const colDef = (
          tableCols as Record<
            string,
            { primary?: boolean; hasDefault?: boolean }
          >
        )[propKey];
        const val =
          record[colName] !== undefined ? record[colName] : record[propKey];
        if (val !== undefined) {
          const isEmpty = val === '' || val === null;
          if (isEmpty && (colDef?.primary || colDef?.hasDefault)) {
            // Omit so database default (e.g. defaultRandom()) applies
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
            (propKey === 'termsDescription' ||
              colName === 'terms_description') &&
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
        }
      }
      records.push(dbRecord);
      parsedCount++;
      if (parsedCount % 1000 === 0) {
        this.log(jobId, `Parsed ${parsedCount} rows...`);
      }
    }

    this.log(
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
        entry.table[uniqueKeyProp] ||
        (tableCols as Record<string, unknown>)[uniqueKeyProp];

      if (strategy === 'upsert') {
        // Build set object for DO UPDATE
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

        await this.db.insert(entry.table).values(batch).onConflictDoUpdate({
          target: conflictTarget,
          set: updateSet,
        });
      } else if (strategy === 'ignore') {
        await this.db.insert(entry.table).values(batch).onConflictDoNothing({
          target: conflictTarget,
        });
      } else {
        await this.db.insert(entry.table).values(batch);
      }

      insertedCount += batch.length;
      this.log(
        jobId,
        `Inserted/Upserted ${insertedCount} / ${records.length} rows...`,
      );
    }

    this.log(jobId, 'DATA IMPORT COMPLETED SUCCESSFULLY');

    // Emit a single event for the entire CSV import
    const tableName =
      entry.table[Symbol.for('drizzle:Name')] || 'unknown_table'; // @sync-ignore
    await emitEvent(this.db as unknown as Parameters<typeof emitEvent>[0], {
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
      await this.db
        .update(pipelineJobs)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(pipelineJobs.jobId, jobId));
      await this.updateJobProgress(jobId, 0, 'done');
    }
  }

  private async log(
    jobId: string | undefined,
    message: string,
    level: 'info' | 'error' = 'info',
  ) {
    if (level === 'error') {
      this.logger.error(`[Job ${jobId || 'N/A'}] ${message}`);
    } else {
      this.logger.log(`[Job ${jobId || 'N/A'}] ${message}`);
    }
    if (jobId) {
      try {
        await this.db.execute(sql`
          UPDATE herobm_core._pipeline_jobs 
          SET logs_json = logs_json || ${JSON.stringify([message])}::jsonb, updated_at = NOW() 
          WHERE job_id = ${jobId}
        `);
      } catch (e) {
        this.logger.error(`Failed to write log for job ${jobId}`, e);
      }
    }
  }

  // @herobm-skip-audit
  async executeElt(dto: ExecuteEltDto) {
    await this.failStaleJobs();
    const [runningJob] = await this.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.status, 'running'))
      .limit(1);
    if (runningJob) return { jobId: runningJob.jobId };

    const jobId = Math.random().toString(36).substring(7);
    await this.db.insert(pipelineJobs).values({
      jobId,
      type: dto.source || 'abm',
      status: 'running',
      configJson: {
        legacyInvoicesPaidBeforeDate: dto.legacyInvoicesPaidBeforeDate,
        glCutoffMode: dto.glCutoffMode,
      },
      progressJson: [
        { step: 1, name: 'Importing Data (ELT)', status: 'running' },
      ],
      logsJson: [],
    });

    this.runEltCore(dto, jobId).catch(async (err) => {
      this.logger.error(`ELT job ${jobId} failed`, err);
      const msg = err instanceof Error ? err.message : String(err);
      await this.log(jobId, `[ERROR] Pipeline failed: ${msg}`, 'error');
      await this.db
        .update(pipelineJobs)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(pipelineJobs.jobId, jobId));
      await this.updateJobProgress(jobId, 0, 'failed');
    });

    return { jobId };
  }

  async runEltCore(dto: ExecuteEltDto, jobId?: string) {
    try {
      this.log(jobId, '--- Initializing ABM ELT Pipeline ---');

      if (dto.baseCurrency) {
        this.log(jobId, `Setting base currency to ${dto.baseCurrency}`);
        const [updatedGl] = await this.db
          .update(glSettings)
          .set({ baseCurrency: dto.baseCurrency })
          .returning();

        await emitEvent(this.db, {
          entityType: EntityType.GL_SETTINGS,
          entityId: updatedGl.settingsId,
          eventType: EventType.UPDATED,
          entityDisplayName: 'GL Settings',
          payload: { baseCurrency: dto.baseCurrency },
        });
      }

      const [appSettingsRow] = await this.db
        .select()
        .from(appSettings)
        .limit(1);
      let defaultLocationCode = 'HQ';
      let inventoryValuationMethod = 'weighted_average';

      if (appSettingsRow) {
        if (appSettingsRow.inventoryValuationMethod) {
          inventoryValuationMethod = appSettingsRow.inventoryValuationMethod;
        }
        if (appSettingsRow.defaultFulfillmentLocationId) {
          const [loc] = await this.db
            .select()
            .from(locations)
            .where(
              eq(
                locations.locationId,
                appSettingsRow.defaultFulfillmentLocationId,
              ),
            )
            .limit(1);
          if (loc) {
            defaultLocationCode = loc.code;
          }
        }
      }

      const envOverride: Record<string, string> = {
        DEFAULT_FULFILLMENT_LOCATION_CODE:
          dto.defaultLocationCode || defaultLocationCode,
        INVENTORY_VALUATION_METHOD: inventoryValuationMethod,
      };

      if (dto.defaultTaxCategoryCode) {
        envOverride.DEFAULT_TAX_CATEGORY_CODE = dto.defaultTaxCategoryCode;
      }

      const source = dto.source;
      if (!source) {
        throw new BadRequestException('Import source is required');
      }

      if (dto.dbConfig) {
        Object.assign(envOverride, {
          SOURCES__SQL_DATABASE__CREDENTIALS: `mssql+pymssql://${encodeURIComponent(dto.dbConfig.username || '')}:${encodeURIComponent(dto.dbConfig.password || '')}@${dto.dbConfig.host}:${dto.dbConfig.port}/${dto.dbConfig.database}?charset=utf8`,
          SOURCE_DB_HOST: dto.dbConfig.host,
          SOURCE_DB_PORT: dto.dbConfig.port?.toString(),
          SOURCE_DB_DATABASE: dto.dbConfig.database,
          SOURCE_DB_USER: dto.dbConfig.username,
          SOURCE_DB_PASSWORD: dto.dbConfig.password,
        });
      }

      envOverride['SOURCE_RESUME'] = dto.resumeExtraction ? 'true' : 'false';

      if (!dto.skipExtraction) {
        const venvPython = process.env.VENV_PYTHON || 'python';
        this.log(
          jobId,
          `Running ${source.toUpperCase()} Extraction (bypassing make to preserve passwords)...`,
        );
        await this.runCommandStream(
          jobId,
          venvPython,
          [`pipelines/${source}_extract/pipeline.py`],
          envOverride,
        );
      } else {
        this.log(jobId, `Skipping ${source.toUpperCase()} Extraction...`);
      }

      this.log(jobId, 'Running Transformations & Report...');

      const extraDbtVars = jobId ? `EXTRA_DBT_VARS={"job_id": "${jobId}"}` : '';
      const makeArgs = ['elt-no-extract', `SOURCE=${source}`];
      if (extraDbtVars) makeArgs.push(extraDbtVars);

      await this.runCommandStream(jobId, 'make', makeArgs, envOverride);

      if (dto.defaultLocationCode) {
        const [loc] = await this.db
          .select()
          .from(locations)
          .where(eq(locations.code, dto.defaultLocationCode))
          .limit(1);
        if (loc) {
          const [existingApp] = await this.db
            .select()
            .from(appSettings)
            .limit(1);
          if (existingApp) {
            const [updatedApp] = await this.db
              .update(appSettings)
              .set({ defaultFulfillmentLocationId: loc.locationId })
              .where(eq(appSettings.settingsId, existingApp.settingsId))
              .returning();

            await emitEvent(this.db, {
              entityType: EntityType.APP_SETTINGS,
              entityId: existingApp.settingsId,
              eventType: EventType.UPDATED,
              entityDisplayName: 'App Settings',
              payload: {
                defaultFulfillmentLocationId: loc.locationId,
                defaultFulfillmentLocationName: loc.name,
              },
            });
          }
        }
      }

      await this.inferAndSaveGlMetadataSchema(jobId);

      // Reload app config cache so API picks up the new settings
      try {
        await this.appConfig.reload();
      } catch (e: unknown) {
        this.log(
          jobId,
          `Warning: Failed to reload app config cache: ${getErrorMessage(e)}`,
          'error',
        );
      }

      await this.log(jobId, 'DATA IMPORT COMPLETED SUCCESSFULLY');
      if (jobId) {
        await this.db
          .update(pipelineJobs)
          .set({ status: 'done', updatedAt: new Date() })
          .where(eq(pipelineJobs.jobId, jobId));
        await this.updateJobProgress(jobId, 0, 'done');
      }
    } catch (error) {
      await this.log(
        jobId,
        `FATAL: ELT Import failed: ${error.message}`,
        'error',
      );
      if (jobId) {
        await this.db
          .update(pipelineJobs)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(pipelineJobs.jobId, jobId));
        await this.updateJobProgress(jobId, 0, 'failed');
      }
      throw error;
    }
  }

  // checkJobTimeout removed, using failStaleJobs

  async getActiveJob() {
    await this.failStaleJobs();
    const [runningJob] = await this.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.status, 'running'))
      .limit(1);
    if (!runningJob) return { jobId: null, type: null };
    return {
      jobId: runningJob.jobId,
      type: runningJob.type,
    };
  }

  // @herobm-skip-audit
  async stopJob(jobId: string) {
    const [job] = await this.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.jobId, jobId))
      .limit(1);
    if (!job) throw new BadRequestException('Job not found');

    const prog = Array.isArray(job.progressJson) ? job.progressJson : [];
    if (prog[0]) {
      prog[0].status = 'failed';
    }

    const newStatus =
      job.status === 'done' || job.status === 'failed'
        ? job.status
        : 'cancelling';

    await this.db
      .update(pipelineJobs)
      .set({ status: newStatus, progressJson: prog, updatedAt: new Date() })
      .where(eq(pipelineJobs.jobId, jobId));
    await this.log(jobId, '[FATAL] Job forcibly stopped by user.', 'error');

    if (job.type !== 'csv') {
      try {
        const runnerUrl =
          process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
        const secret = process.env.PIPELINE_SECRET || '';
        await fetch(`${runnerUrl}/run/${jobId}`, {
          method: 'DELETE',
          headers: {
            ...(secret ? { 'X-Pipeline-Secret': secret } : {}),
          },
          signal: AbortSignal.timeout(3000),
        });
      } catch (err) {
        this.logger.warn(
          `Failed to send DELETE to pipeline-runner for job ${jobId}: ${err}`,
        );
      }
    }

    return { success: true };
  }

  async getJobProgress(jobId: string) {
    await this.failStaleJobs();
    const [job] = await this.db
      .select()
      .from(pipelineJobs)
      .where(eq(pipelineJobs.jobId, jobId))
      .limit(1);
    if (!job) throw new BadRequestException('Job not found');
    return {
      status: job.status,
      type: job.type,
      progress: job.progressJson,
      logs: job.logsJson,
      lastActivityAt: job.updatedAt.getTime(),
    };
  }

  // @herobm-skip-audit
  private async updateJobProgress(
    jobId: string | undefined,
    stepIndex: number,
    status: string,
  ) {
    if (jobId) {
      try {
        const [job] = await this.db
          .select()
          .from(pipelineJobs)
          .where(eq(pipelineJobs.jobId, jobId))
          .limit(1);
        if (job && Array.isArray(job.progressJson)) {
          const prog = job.progressJson;
          if (prog[stepIndex]) {
            prog[stepIndex].status = status;
            await this.db
              .update(pipelineJobs)
              .set({ progressJson: prog, updatedAt: new Date() })
              .where(eq(pipelineJobs.jobId, jobId));
          }
        }
      } catch (e) {
        this.logger.error('Failed to mark step progress', e);
      }
    }
  }

  private getWorkspaceRoot(): string {
    let currentDir = __dirname;
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'Makefile'))) return currentDir;
      currentDir = path.dirname(currentDir);
    }
    return process.cwd();
  }

  private runCommandStream(
    jobId: string | undefined,
    cmd: string,
    args: string[],
    envOverride?: Record<string, string>,
  ): Promise<void> {
    if (!jobId) {
      return Promise.reject(new Error('jobId is required for async webhooks'));
    }

    return new Promise((resolve, reject) => {
      this.jobResolvers[jobId] = { resolve, reject };

      console.log(
        `[Job ${jobId}] Sending POST to pipeline-runner/run with command ${cmd}...`,
      );
      const runnerUrl =
        process.env.PIPELINE_RUNNER_URL || 'http://herobm-pipeline:8001';
      const secret = process.env.PIPELINE_SECRET || '';
      const isLocalRunner =
        runnerUrl.includes('127.0.0.1') || runnerUrl.includes('localhost');
      const apiPort = process.env.PORT || process.env.API_PORT || '3001';
      const defaultWebhookUrl =
        process.env.PIPELINE_WEBHOOK_URL ||
        (isLocalRunner
          ? `http://127.0.0.1:${apiPort}/internal/setup/webhook`
          : 'http://herobm-api:3001/internal/setup/webhook');

      const envToPass: Record<string, string | undefined> = {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        DBT_USE_COLORS: 'False',
        TERM: 'dumb',
        WEBHOOK_URL: process.env.WEBHOOK_URL || defaultWebhookUrl,
        ...envOverride,
      };

      fetch(`${runnerUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Pipeline-Secret': secret } : {}),
        },
        body: JSON.stringify({
          jobId,
          command: cmd,
          args: args,
          env: envToPass,
        }),
      })
        .then(async (response) => {
          console.log(
            `[Job ${jobId}] pipeline-runner/run responded with status ${response.status}`,
          );
          if (!response.ok) {
            const body = await response.text();
            console.error(`[Job ${jobId}] Failed to trigger sidecar: ${body}`);
            delete this.jobResolvers[jobId];
            reject(
              new Error(
                `Failed to trigger pipeline-runner at ${runnerUrl}: HTTP ${response.status} - ${body}`,
              ),
            );
          } else {
            // Consume the response body to free the socket
            await response.text().catch(() => {});
          }
        })
        .catch((err) => {
          console.error(
            `[Job ${jobId}] fetch to pipeline-runner/run failed completely:`,
            err,
          );
          delete this.jobResolvers[jobId];
          const errorMsg = err instanceof Error ? err.message : String(err);
          reject(
            new Error(
              `Failed to connect to pipeline-runner at ${runnerUrl}. Is the service running? Details: ${errorMsg}`,
            ),
          );
        });
    });
  }

  public handleWebhook(payload: {
    jobId: string;
    logLine?: string;
    status: string;
  }) {
    if (payload.logLine) {
      this.log(payload.jobId, payload.logLine);
    }

    if (payload.status === 'done') {
      if (this.jobResolvers[payload.jobId]) {
        this.jobResolvers[payload.jobId].resolve();
        delete this.jobResolvers[payload.jobId];
      }
    } else if (payload.status === 'failed') {
      if (this.jobResolvers[payload.jobId]) {
        this.jobResolvers[payload.jobId].reject(
          new Error(payload.logLine || 'Pipeline failed'),
        );
        delete this.jobResolvers[payload.jobId];
      }
    }
  }

  private async inferAndSaveGlMetadataSchema(jobId?: string) {
    this.log(
      jobId,
      'Dynamically inferring GL metadata schema from imported accounts...',
    );
    try {
      const accounts = await this.db
        .select({ metadata: glAccounts.metadata })
        .from(glAccounts)
        .where(isNotNull(glAccounts.metadata));

      const properties: Record<string, { type: string; title: string }> = {};
      for (const acct of accounts) {
        if (
          acct.metadata &&
          typeof acct.metadata === 'object' &&
          !Array.isArray(acct.metadata)
        ) {
          for (const [key, value] of Object.entries(acct.metadata)) {
            if (!properties[key] && value !== null && value !== undefined) {
              const type = typeof value;
              const title = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase());

              properties[key] = {
                type: type === 'number' || type === 'boolean' ? type : 'string',
                title,
              };
            }
          }
        }
      }

      if (Object.keys(properties).length > 0) {
        const [existingGl] = await this.db.select().from(glSettings).limit(1);
        if (existingGl) {
          interface MetadataSchema {
            type?: string;
            properties?: Record<string, unknown>;
          }
          const existingSchema =
            (existingGl.accountMetadataSchema as unknown as MetadataSchema) || {
              type: 'object',
              properties: {},
            };
          const mergedProperties = {
            ...(existingSchema.properties || {}),
            ...properties,
          };

          const [updatedGl] = await this.db
            .update(glSettings)
            .set({
              accountMetadataSchema: {
                type: 'object',
                properties: mergedProperties,
              } as unknown as unknown[],
            })
            .where(eq(glSettings.settingsId, existingGl.settingsId))
            .returning();

          await emitEvent(this.db, {
            entityType: EntityType.GL_SETTINGS,
            entityId: existingGl.settingsId,
            eventType: EventType.UPDATED,
            entityDisplayName: 'GL Settings',
            payload: { accountMetadataSchema: updatedGl.accountMetadataSchema },
          });

          this.log(
            jobId,
            `Inferred schema with ${Object.keys(properties).length} properties.`,
          );
        }
      } else {
        this.log(jobId, 'No metadata found to infer schema.');
      }
    } catch (e: unknown) {
      this.log(
        jobId,
        `Warning: Failed to infer metadata schema: ${getErrorMessage(e)}`,
        'error',
      );
    }
  }
}
