import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { getCountryCode } from '@modbm/shared';
import { sql } from 'drizzle-orm';
import {
  appSettings,
  glSettings,
  organization,
  locations,
  glAccounts,
} from '../drizzle/modbm-core-schema';
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
import { parse } from 'csv-parse';
import * as schema from '../drizzle/modbm-core-schema';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  // In-memory job tracking for the setup process
  // modbm-allow-record-any
  private activeJobs: Record<string, any> = {};

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

    return new Promise<{ success: boolean; message: string; preview?: any }>(
      (resolve) => {
        const envOverride: Record<string, string> = {
          ...process.env,
          ABM_MSSQL_HOST: dto.host,
          ABM_MSSQL_DATABASE: dto.database,
          ABM_MSSQL_USER: dto.username,
          ABM_MSSQL_PASSWORD: dto.password,
          ABM_MSSQL_PORT: dto.port ? dto.port.toString() : '1433',
        };

        const rootDir = this.getWorkspaceRoot();
        const venvPython =
          process.platform === 'win32'
            ? '".venv\\Scripts\\python"'
            : '".venv/bin/python"';

        const child = spawn(`${venvPython} pipelines/abm_extract/preview.py`, {
          cwd: rootDir,
          env: envOverride,
          shell: true,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => (stdout += data.toString()));
        child.stderr.on('data', (data) => (stderr += data.toString()));

        child.on('close', (code) => {
          if (code !== 0) {
            let msg = 'Connection failed.';
            try {
              if (stdout) {
                const errorJson = JSON.parse(stdout.trim());
                if (errorJson.error) msg = errorJson.error;
              }
            } catch (e) {
              msg = stderr.substring(0, 200) || stdout.substring(0, 200);
            }
            return resolve({ success: false, message: msg });
          }
          try {
            const result = stdout.trim()
              ? JSON.parse(stdout.trim())
              : undefined;
            resolve({
              success: true,
              message: 'Connected',
              preview: result,
            });
          } catch (e) {
            resolve({
              success: false,
              message: 'Invalid response from preview script',
            });
          }
        });
      },
    );
  }

  async testOdooConnection(dto: TestOdooConnectionDto) {
    this.logger.log(`Testing Odoo connection to ${dto.host}...`);

    return new Promise<{ success: boolean; message: string; preview?: any }>(
      (resolve) => {
        const envOverride: Record<string, string> = {
          ...process.env,
          ODOO_PG_HOST: dto.host,
          ODOO_PG_DATABASE: dto.database,
          ODOO_PG_USER: dto.username,
          ODOO_PG_PASSWORD: dto.password,
          ODOO_PG_PORT: dto.port ? dto.port.toString() : '5432',
        };

        const rootDir = this.getWorkspaceRoot();
        const venvPython =
          process.platform === 'win32'
            ? '".venv\\Scripts\\python"'
            : '".venv/bin/python"';

        const child = spawn(`${venvPython} pipelines/odoo_extract/preview.py`, {
          cwd: rootDir,
          env: envOverride,
          shell: true,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => (stdout += data.toString()));
        child.stderr.on('data', (data) => (stderr += data.toString()));

        child.on('close', (code) => {
          if (code !== 0) {
            let msg = 'Connection failed.';
            try {
              if (stdout) {
                const errorJson = JSON.parse(stdout.trim());
                if (errorJson.error) msg = errorJson.error;
              }
            } catch (e) {
              msg = stderr.substring(0, 200) || stdout.substring(0, 200);
            }
            return resolve({ success: false, message: msg });
          }
          try {
            const result = stdout.trim()
              ? JSON.parse(stdout.trim())
              : undefined;
            resolve({
              success: true,
              message: 'Connected',
              preview: result,
            });
          } catch (e) {
            resolve({
              success: false,
              message: 'Invalid response from preview script',
            });
          }
        });
      },
    );
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
        sql`SELECT COUNT(*) FROM modbm_core.products`,
      );
      const [{ count: customers }] = await this.db.execute(
        sql`SELECT COUNT(*) FROM modbm_core.customers`,
      );
      const [{ count: orders }] = await this.db.execute(
        sql`SELECT COUNT(*) FROM modbm_core.sales_orders`,
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

  private async runCsvCore(
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

    const tableCols = getTableColumns(entry.table);
    const colNames = Object.keys(tableCols).map((k) => tableCols[k].name);

    this.log(jobId, `Starting CSV parsing for strategy: ${strategy}...`);

    const records: any[] = [];
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
        const updateSet: any = {};
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
        await this.db
          .update(glSettings)
          .set({ baseCurrency: dto.baseCurrency });
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

      const isOdoo = dto.odooImport === true;
      const prefix = isOdoo ? 'ODOO_PG' : 'ABM_MSSQL';

      if (dto.dbConfig) {
        if (dto.dbConfig.host)
          envOverride[`${prefix}_HOST`] = dto.dbConfig.host;
        if (dto.dbConfig.database)
          envOverride[`${prefix}_DATABASE`] = dto.dbConfig.database;
        if (dto.dbConfig.username)
          envOverride[`${prefix}_USER`] = dto.dbConfig.username;
        if (dto.dbConfig.password)
          envOverride[`${prefix}_PASSWORD`] = dto.dbConfig.password;
        if (dto.dbConfig.port)
          envOverride[`${prefix}_PORT`] = dto.dbConfig.port.toString();
      }

      envOverride[isOdoo ? 'ODOO_RESUME' : 'ABM_RESUME'] = dto.resumeExtraction
        ? 'true'
        : 'false';

      if (!dto.skipExtraction) {
        const venvPython =
          process.platform === 'win32'
            ? '".venv\\Scripts\\python"'
            : '".venv/bin/python"';
        this.log(
          jobId,
          `Running ${isOdoo ? 'Odoo' : 'ABM'} Extraction (bypassing make to preserve passwords)...`,
        );
        await this.runCommandStream(
          jobId,
          venvPython,
          [`pipelines/${isOdoo ? 'odoo' : 'abm'}_extract/pipeline.py`],
          envOverride,
        );
      } else {
        this.log(jobId, `Skipping ${isOdoo ? 'Odoo' : 'ABM'} Extraction...`);
      }

      this.log(jobId, 'Running Transformations & Report...');
      await this.runCommandStream(
        jobId,
        'make',
        [isOdoo ? 'elt-odoo-no-extract' : 'elt-no-extract'],
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
            await this.db
              .update(appSettings)
              .set({ defaultFulfillmentLocationId: loc.locationId })
              .where(eq(appSettings.settingsId, existingApp.settingsId));
          }
        }
      }

      await this.inferAndSaveGlMetadataSchema(jobId);
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
    return new Promise((resolve, reject) => {
      const child = spawn([cmd, ...args].join(' '), {
        cwd: this.getWorkspaceRoot(),
        shell: true,
        env: { ...process.env, ...envOverride },
      });
      child.stdout.on('data', (data) =>
        this.log(jobId, data.toString().trim()),
      );
      child.stderr.on('data', (data) =>
        this.log(jobId, data.toString().trim()),
      );
      child.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`${cmd} failed with code ${code}`)),
      );
    });
  }

  private async inferAndSaveGlMetadataSchema(jobId?: string) {
    this.log(jobId, 'Dynamically inferring GL metadata schema from imported accounts...');
    try {
      const accounts = await this.db
        .select({ metadata: glAccounts.metadata })
        .from(glAccounts)
        .where(isNotNull(glAccounts.metadata));

      const properties: Record<string, { type: string; title: string }> = {};
      for (const acct of accounts) {
        if (acct.metadata && typeof acct.metadata === 'object' && !Array.isArray(acct.metadata)) {
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
          const existingSchema = (existingGl.accountMetadataSchema as any) || { type: 'object', properties: {} };
          const mergedProperties = { ...(existingSchema.properties || {}), ...properties };
          
          await this.db
            .update(glSettings)
            .set({ accountMetadataSchema: { type: 'object', properties: mergedProperties } as any })
            .where(eq(glSettings.settingsId, existingGl.settingsId));
            
          this.log(jobId, `Inferred schema with ${Object.keys(properties).length} properties.`);
        }
      } else {
        this.log(jobId, 'No metadata found to infer schema.');
      }
    } catch (e: any) {
      this.log(jobId, `Warning: Failed to infer metadata schema: ${e.message}`, 'error');
    }
  }
}
