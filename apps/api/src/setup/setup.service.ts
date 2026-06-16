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
} from '../drizzle/herobm-core-schema';
import {
  ExecuteSetupDto,
  TestAbmConnectionDto,
  TestOdooConnectionDto,
  ExecuteEltDto,
} from './setup.dto';
import { AppConfigService } from '../settings/app-config.service';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { eq, getTableColumns, isNotNull } from 'drizzle-orm';
import { Readable } from 'stream';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';
import { parse } from 'csv-parse';
import * as schema from '../drizzle/herobm-core-schema';
import { EntityType, EventType } from '../common/event-types';
import { emitEvent } from '../common/emit-event';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  // In-memory job tracking for the setup process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private activeJobs: Record<string, any> = {};

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
    const rootDir = this.getWorkspaceRoot();
    const stateFile = path.join(rootDir, '.abm_resume_state');
    if (!fs.existsSync(stateFile)) {
      return { completedTables: [] };
    }
    const content = fs.readFileSync(stateFile, 'utf-8');
    const tables = content
      .split('\n')
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line.length > 0);
    return { completedTables: tables };
  }

  async getResumeStateOdoo() {
    const rootDir = this.getWorkspaceRoot();
    const stateFile = path.join(rootDir, '.odoo_resume_state');
    if (!fs.existsSync(stateFile)) {
      return { completedTables: [] };
    }
    const content = fs.readFileSync(stateFile, 'utf-8');
    const tables = content
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0);
    return { completedTables: tables };
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
      const response = await fetch('http://pipeline-runner:8000/run-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      this.logger.error(
        `Failed to connect to pipeline-runner: ${error.message}`,
      );
      return { success: false, message: 'Pipeline runner error' };
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
      const response = await fetch('http://pipeline-runner:8000/run-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      this.logger.error(
        `Failed to connect to pipeline-runner: ${error.message}`,
      );
      return { success: false, message: 'Pipeline runner error' };
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

    return this.csvRegistry.map((t) => {
      const cols = getTableColumns(t.table);
      const columns = Object.keys(cols)
        .map((k) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const col = (cols as any)[k];
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
    });
  }

  async executeCsv(
    tableName: string,
    strategy: string,
    file: Express.Multer.File,
  ) {
    const registryEntry = this.csvRegistry.find((r) => r.id === tableName);
    if (!registryEntry) throw new BadRequestException('Unsupported table');

    const runningJobId = Object.keys(this.activeJobs).find(
      (id) => this.activeJobs[id].status === 'running',
    );
    if (runningJobId) throw new BadRequestException('A job is already running');

    const jobId = Math.random().toString(36).substring(7);
    this.activeJobs[jobId] = {
      status: 'running',
      progress: [
        { step: 1, name: `Importing CSV to ${tableName}`, status: 'running' },
      ],
      logs: [`--- Initializing CSV Import for ${tableName} ---`],
    };

    this.runCsvCore(registryEntry, strategy, file, jobId).catch((err) => {
      this.logger.error(`CSV job ${jobId} failed`, err);
      this.log(jobId, `FATAL: CSV Import failed: ${err.message}`, 'error');
      if (this.activeJobs[jobId]) {
        this.activeJobs[jobId].status = 'failed';
        this.activeJobs[jobId].progress[0].status = 'failed';
      }
    });

    return { jobId };
  }

  // @herobm-skip-audit
  private async runCsvCore(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const colNames = Object.keys(tableCols).map((k) => tableCols[k].name);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbRecord: any = {};
      for (const col of colNames) {
        if (record[col] !== undefined) {
          dbRecord[col] = record[col] === '' ? null : record[col];
          if (col === 'address1Country' && dbRecord[col]) {
            dbRecord[col] = getCountryCode(dbRecord[col]) || dbRecord[col];
          }
          if (col === 'currencyCode') {
            dbRecord[col] = mapCurrencyCode(dbRecord[col]);
          }
          if ((col === 'phone' || col === 'mobile') && dbRecord[col]) {
            dbRecord[col] = parsePhone(dbRecord[col]);
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

      if (strategy === 'upsert') {
        const conflictTarget =
          entry.table[entry.uniqueKey] ||
          tableCols[
            Object.keys(tableCols).find(
              (k) => tableCols[k].name === entry.uniqueKey,
            )!
          ];

        // Build set object for DO UPDATE
        const updateSet: Record<string, unknown> = {};
        for (const colName of colNames) {
          if (colName !== entry.uniqueKey) {
            updateSet[colName] = sql.raw(`EXCLUDED.${colName}`);
          }
        }

        await this.db.insert(entry.table).values(batch).onConflictDoUpdate({
          target: conflictTarget,
          set: updateSet,
        });
      } else if (strategy === 'ignore') {
        const conflictTarget =
          entry.table[entry.uniqueKey] ||
          tableCols[
            Object.keys(tableCols).find(
              (k) => tableCols[k].name === entry.uniqueKey,
            )!
          ];
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await emitEvent(this.db as any, {
      entityType: EntityType.SYSTEM,
      entityId: 'system_setup',
      eventType: 'csv_import_completed',
      entityDisplayName: `CSV Import: ${tableName}`,
      payload: {
        table: tableName,
        rowsImported: insertedCount,
        strategy,
      },
      actor: 'system',
    });

    if (this.activeJobs[jobId]) {
      this.activeJobs[jobId].progress[0].status = 'done';
      this.activeJobs[jobId].status = 'done';
    }
  }

  private log(
    jobId: string | undefined,
    message: string,
    level: 'log' | 'warn' | 'error' = 'log',
  ) {
    this.logger[level](message);
    if (jobId && this.activeJobs[jobId]) {
      this.activeJobs[jobId].logs.push(message);
    }
  }

  async executeElt(dto: ExecuteEltDto) {
    const runningJobId = Object.keys(this.activeJobs).find(
      (id) => this.activeJobs[id].status === 'running',
    );
    if (runningJobId) return { jobId: runningJobId };

    const jobId = Math.random().toString(36).substring(7);
    this.activeJobs[jobId] = {
      status: 'running',
      progress: [{ step: 1, name: 'Importing Data (ELT)', status: 'running' }],
      logs: [],
    };

    this.runEltCore(dto, jobId).catch((err) => {
      this.logger.error(`ELT job ${jobId} failed`, err);
      if (this.activeJobs[jobId]) {
        this.activeJobs[jobId].status = 'failed';
        this.activeJobs[jobId].progress[0].status = 'failed';
      }
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

      if (dto.enableCustomImports) {
        envOverride.ENABLE_CUSTOM_IMPORTS = 'true';
      }

      const source = dto.source;
      if (!source) {
        throw new BadRequestException('Import source is required');
      }

      if (dto.dbConfig) {
        if (dto.dbConfig.host)
          envOverride[`SOURCE_DB_HOST`] = dto.dbConfig.host;
        if (dto.dbConfig.database)
          envOverride[`SOURCE_DB_DATABASE`] = dto.dbConfig.database;
        if (dto.dbConfig.username)
          envOverride[`SOURCE_DB_USER`] = dto.dbConfig.username;
        if (dto.dbConfig.password)
          envOverride[`SOURCE_DB_PASSWORD`] = dto.dbConfig.password;
        if (dto.dbConfig.port)
          envOverride[`SOURCE_DB_PORT`] = dto.dbConfig.port.toString();
      }

      envOverride['SOURCE_RESUME'] = dto.resumeExtraction ? 'true' : 'false';

      if (!dto.skipExtraction) {
        const venvPython = 'python3';
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
      await this.runCommandStream(
        jobId,
        'make',
        ['elt-no-extract', `SOURCE=${source}`],
        envOverride,
      );

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
              payload: { defaultFulfillmentLocationId: loc.locationId },
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

      this.log(jobId, 'DATA IMPORT COMPLETED SUCCESSFULLY');
      if (jobId && this.activeJobs[jobId]) {
        this.activeJobs[jobId].progress[0].status = 'done';
        this.activeJobs[jobId].status = 'done';
      }
    } catch (error) {
      this.log(jobId, `FATAL: ELT Import failed: ${error.message}`, 'error');
      if (jobId && this.activeJobs[jobId]) {
        this.activeJobs[jobId].status = 'failed';
        this.activeJobs[jobId].progress[0].status = 'failed';
      }
      throw error;
    }
  }

  getJobProgress(jobId: string) {
    const job = this.activeJobs[jobId];
    if (!job) throw new BadRequestException('Job not found');
    return job;
  }

  private updateJobProgress(
    jobId: string | undefined,
    stepIndex: number,
    status: string,
  ) {
    if (
      jobId &&
      this.activeJobs[jobId] &&
      this.activeJobs[jobId].progress[stepIndex]
    ) {
      this.activeJobs[jobId].progress[stepIndex].status = status;
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

      console.log(`[Job ${jobId}] Sending POST to pipeline-runner/run with command ${cmd}...`);
      fetch('http://pipeline-runner:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          command: cmd,
          args: args,
          env: { ...process.env, ...envOverride },
        }),
      })
        .then(async (response) => {
          console.log(`[Job ${jobId}] pipeline-runner/run responded with status ${response.status}`);
          if (!response.ok) {
            const body = await response.text();
            console.error(`[Job ${jobId}] Failed to trigger sidecar: ${body}`);
            delete this.jobResolvers[jobId];
            reject(new Error(`Failed to trigger sidecar: ${body}`));
          } else {
            // Consume the response body to free the socket
            await response.text().catch(() => {});
          }
        })
        .catch((err) => {
          console.error(`[Job ${jobId}] fetch to pipeline-runner/run failed completely:`, err);
          delete this.jobResolvers[jobId];
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  public handleWebhook(payload: {
    jobId: string;
    logLine: string;
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingSchema = (existingGl.accountMetadataSchema as any) || {
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
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
