import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import {
  appSettings,
  glSettings,
  organization,
  locations,
} from '../drizzle/modbm-core-schema';
import { ExecuteSetupDto, TestAbmConnectionDto } from './setup.dto';
import { AppConfigService } from '../settings/app-config.service';
import { CoaLoaderService, resolveChartsDir } from '../gl/coa-loader.service';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  // In-memory job tracking for the setup process
  private activeJobs: Record<string, any> = {};

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly coaLoader: CoaLoaderService,
  ) {}

  async getStatus() {
    const rawApp = this.appConfig.getAppSettingsRaw();
    return {
      needsSetup: !rawApp?.setupCompletedAt,
      setupCompletedAt: rawApp?.setupCompletedAt || null,
    };
  }

  async getCoaPresets() {
    // __dirname is dist/src/setup, so we step up to dist/src/gl first
    const glDir = path.join(__dirname, '..', 'gl');
    const chartsDir = resolveChartsDir(glDir);

    if (!fs.existsSync(chartsDir)) {
      return [];
    }

    const files = fs.readdirSync(chartsDir);
    return files
      .filter(
        (file) => file.endsWith('.json') && !file.endsWith('_settings.json'),
      )
      .map((file) => {
        const content = JSON.parse(
          fs.readFileSync(path.join(chartsDir, file), 'utf-8'),
        );
        return {
          filename: file,
          name: content.name || file,
          country: content.country_code,
        };
      });
  }

  private lastAbmPreview: any = null;

  async testAbmConnection(dto: TestAbmConnectionDto) {
    this.logger.log(
      `Testing ABM connection to ${dto.host} via preview script...`,
    );

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

        import('child_process').then(({ exec }) => {
          const rootDir = this.getWorkspaceRoot();
          const venvPython =
            process.platform === 'win32'
              ? '".venv\\Scripts\\python"'
              : '".venv/bin/python"';

          exec(
            `${venvPython} pipelines/abm_extract/preview.py`,
            { cwd: rootDir, env: envOverride, timeout: 30000 },
            (error, stdout, stderr) => {
              if (error) {
                let msg = 'Unknown connection timeout or crash.';
                try {
                  if (stdout) {
                    const errorJson = JSON.parse(stdout.trim());
                    if (errorJson.error) msg = errorJson.error;
                  } else if (stderr) {
                    msg = stderr.substring(0, 200);
                  }
                } catch (e) {
                  msg = stdout ? stdout.substring(0, 200) : msg;
                }
                this.logger.error(`ABM test failed: ${msg}`);
                return resolve({ success: false, message: msg });
              }

              try {
                const previewData = JSON.parse(stdout.trim());
                if (previewData.error) {
                  return resolve({
                    success: false,
                    message: previewData.error,
                  });
                }
                this.lastAbmPreview = previewData;

                if (previewData.warnings && previewData.warnings.length > 0) {
                  previewData.warnings.forEach((w: string) =>
                    this.logger.warn(`ABM Preview Warning: ${w}`),
                  );
                }

                return resolve({
                  success: true,
                  message: 'Connection successful',
                  preview: previewData,
                });
              } catch (e) {
                this.logger.error(`Failed to parse preview JSON: ${stdout}`);
                return resolve({
                  success: false,
                  message: 'Failed to parse database structural response.',
                });
              }
            },
          );
        });
      },
    );
  }

  async getAbmPreview() {
    if (this.lastAbmPreview) {
      return this.lastAbmPreview;
    }
    // Safe-fallback if front-end is hitting endpoint directly without testing (e.g. sterile bypass or hard-reload)
    return {
      tables: [],
      locations: [{ code: 'MAIN', name: 'System Default Site' }],
    };
  }

  async getValidation() {
    try {
      // Probe core environment tables. If the database isn't built yet, this will safely throw.
      const appDocs = await this.db.select().from(appSettings).limit(1);
      const orgDocs = await this.db.select().from(organization).limit(1);

      if (appDocs.length > 0 && orgDocs.length > 0) {
        return {
          status: 'pass',
          metrics: { extraction: {}, dbt: {} },
          dataCounts: {
            appSettings: appDocs.length,
            organization: orgDocs.length,
          },
        };
      }

      return { status: 'needs_setup', metrics: {}, dataCounts: {} };
    } catch (error) {
      // Database not populated or connection failed
      this.logger.error(
        'Failed to validate environment status, deferring to Setup Wizard',
        error.message,
      );
      return { status: 'needs_setup', metrics: {}, dataCounts: {} };
    }
  }

  async executeSetup(dto: ExecuteSetupDto) {
    // Prevent overlapping concurrent setup spawns (e.g. from frontend double clicks)
    const runningJobId = Object.keys(this.activeJobs).find(
      (id) => this.activeJobs[id].status === 'running',
    );
    if (runningJobId) {
      this.logger.warn(`Setup is already running on job ${runningJobId}. Refusing to spawn concurrent ELT process.`);
      return { jobId: runningJobId };
    }

    const jobId = Math.random().toString(36).substring(7);
    this.activeJobs[jobId] = {
      status: 'running',
      progress: [
        { step: 1, name: 'Creating system records', status: 'pending' },
        { step: 2, name: 'Loading Chart of Accounts', status: 'pending' },
        { step: 3, name: 'Configuring GL settings', status: 'pending' },
        { step: 4, name: 'Configuring App settings', status: 'pending' },
        { step: 5, name: 'Seeding organization', status: 'pending' },
        { step: 6, name: 'Finalizing', status: 'pending' },
      ],
      logs: [],
    };

    // Run setup asynchronously
    this.runSetupAsync(jobId, dto).catch((err) => {
      this.logger.error(`Setup job ${jobId} failed`, err);
      this.activeJobs[jobId].status = 'failed';
    });

    return { jobId };
  }

  getJobProgress(jobId: string) {
    const job = this.activeJobs[jobId];
    if (!job) {
      throw new BadRequestException('Job not found');
    }
    return job;
  }

  private updateJobProgress(jobId: string, stepIndex: number, status: string) {
    if (this.activeJobs[jobId] && this.activeJobs[jobId].progress[stepIndex]) {
      this.activeJobs[jobId].progress[stepIndex].status = status;
    }
  }

  private logToJob(jobId: string, message: string) {
    if (this.activeJobs[jobId]) {
      this.activeJobs[jobId].logs.push(...message.split('\n'));
      try {
        const logFilePath = path.join(
          this.getWorkspaceRoot(),
          'pipeline-execution.log',
        );
        fs.appendFileSync(logFilePath, message + '\n');
      } catch (err) {
        // Ignore file lock or permission errors gracefully
      }
    }
  }

  private getWorkspaceRoot(): string {
    let currentDir = __dirname;
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'Makefile'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    return process.cwd();
  }

  private runCommandStream(
    jobId: string,
    cmd: string,
    args: string[],
    envOverride?: Record<string, string>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const rootDir = this.getWorkspaceRoot();
      const fullCommand = [cmd, ...args].join(' ');
      const child = spawn(fullCommand, {
        cwd: rootDir,
        shell: true,
        env: { ...process.env, ...envOverride },
      });

      child.stdout.on('data', (data) => {
        const val = data.toString().trim();
        if (val) this.logToJob(jobId, val);
      });

      child.stderr.on('data', (data) => {
        const val = data.toString().trim();
        if (val) this.logToJob(jobId, val);
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Command ${cmd} exited with code ${code}`));
      });
    });
  }

  private async runSetupAsync(jobId: string, dto: ExecuteSetupDto) {
    const job = this.activeJobs[jobId];

    try {
      this.updateJobProgress(jobId, 0, 'running');
      // Step 1: System records
      if (dto.abmImport) {
        this.logger.log(
          `[Job ${jobId}] Initializing ABM Extract-Load-Transform pipeline...`,
        );
        this.logToJob(
          jobId,
          `--- Initializing ABM Extract-Load-Transform pipeline ---\n` +
          `[ CONFIGURATION ]\n` +
          `Company Name: ${dto.companyName}\n` +
          `Primary Location: ${dto.defaultLocationCode || 'System Default'}\n` +
          `Valuation Logic: ${dto.inventoryValuationMethod || 'weighted_average'}\n` +
          `Billing Mode: ${dto.nonStockBillingMode || 'per_shipment'}\n` +
          `Base Currency: ${dto.baseCurrency}\n` +
          `Fiscal Start: ${dto.fiscalYearStartMonth}\n` +
          `COA Template: ${dto.coaPreset}\n` +
          `--------------------------------------------------------`
        );

        const envOverride: Record<string, string> = {};
        if (dto.dbConfig) {
          if (dto.dbConfig.host)
            envOverride['ABM_MSSQL_HOST'] = dto.dbConfig.host;
          if (dto.dbConfig.database)
            envOverride['ABM_MSSQL_DATABASE'] = dto.dbConfig.database;
          if (dto.dbConfig.username)
            envOverride['ABM_MSSQL_USER'] = dto.dbConfig.username;
          if (dto.dbConfig.password)
            envOverride['ABM_MSSQL_PASSWORD'] = dto.dbConfig.password;
          if (dto.dbConfig.port)
            envOverride['ABM_MSSQL_PORT'] = dto.dbConfig.port.toString();
        }

        if (dto.resumeExtraction) {
          envOverride['ABM_RESUME'] = 'true';
        }

        // Pipe wizard configuration directly into ELT environment
        if (dto.defaultLocationCode) envOverride['DEFAULT_FULFILLMENT_LOCATION_CODE'] = dto.defaultLocationCode;
        if (dto.nonStockBillingMode) envOverride['NON_STOCK_BILLING_MODE'] = dto.nonStockBillingMode;
        if (dto.inventoryValuationMethod) envOverride['INVENTORY_VALUATION_METHOD'] = dto.inventoryValuationMethod;
        if (dto.baseCurrency) envOverride['HOME_CURRENCY'] = dto.baseCurrency;

        // Automatically persist to the active `.env` file to prevent future CLI/Cron job crashes
        try {
          const envPath = path.join(this.getWorkspaceRoot(), '.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            let updated = false;
            const updates = [
              { key: 'DEFAULT_FULFILLMENT_LOCATION_CODE', val: dto.defaultLocationCode },
              { key: 'NON_STOCK_BILLING_MODE', val: dto.nonStockBillingMode },
              { key: 'INVENTORY_VALUATION_METHOD', val: dto.inventoryValuationMethod },
              { key: 'HOME_CURRENCY', val: dto.baseCurrency }
            ];
            
            for (const { key, val } of updates) {
              if (val && !envContent.includes(`${key}=`)) {
                envContent += `\n${key}=${val}`;
                updated = true;
              } else if (val) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                envContent = envContent.replace(regex, `${key}=${val}`);
                updated = true;
              }
            }
            if (updated) {
              fs.writeFileSync(envPath, envContent);
              this.logger.log(`Appended wizard configurations to .env file for CLI continuity.`);
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to auto-update .env file. Next CLI dbt run may lack required vars: ${err.message}`);
        }

        await this.runCommandStream(jobId, 'make', ['elt'], envOverride);
        this.logger.log(
          `[Job ${jobId}] ABM ELT complete. Seeding sterile structures...`,
        );
        this.logToJob(jobId, '--- Seeding system templates ---');
        await this.runCommandStream(jobId, 'make', ['seed']);
      } else {
        this.logger.log(
          `[Job ${jobId}] Sterile database initialization (bypassing extraction).`,
        );
        this.logToJob(jobId, '--- Initializing Sterile Database setup ---');
        await this.runCommandStream(jobId, 'make', ['seed']);
      }
      this.updateJobProgress(jobId, 0, 'done');

      // Step 2: Chart of Accounts
      this.updateJobProgress(jobId, 1, 'running');
      await this.coaLoader.loadFromFile(dto.coaPreset);
      this.updateJobProgress(jobId, 1, 'done');

      // Step 3: GL Settings
      this.updateJobProgress(jobId, 2, 'running');
      await this.saveGlSettings(dto);
      this.updateJobProgress(jobId, 2, 'done');

      // Step 4: App settings
      this.updateJobProgress(jobId, 3, 'running');
      await this.saveAppSettings(dto);
      this.updateJobProgress(jobId, 3, 'done');

      // Step 5: Organization
      this.updateJobProgress(jobId, 4, 'running');
      await this.saveOrganization(dto);
      this.updateJobProgress(jobId, 4, 'done');

      // Step 6: Finalize
      this.updateJobProgress(jobId, 5, 'running');
      await this.appConfig.reload(); // Reload the boot-time cache
      this.updateJobProgress(jobId, 5, 'done');

      this.logToJob(jobId, '\n========================================================');
      this.logToJob(jobId, 'SETUP COMPLETED SUCCESSFULLY');
      this.logToJob(jobId, 'HeroBM Platform is now fully compiled and ready for use.');
      this.logToJob(jobId, '========================================================\n');

      job.status = 'done';
    } catch (error) {
      this.logger.error(`Error in runSetupAsync for job ${jobId}`, error);
      job.status = 'failed';
      throw error;
    }
  }

  private async saveGlSettings(dto: ExecuteSetupDto) {
    // Only update the settings we captured in the DTO, leave default accounts untouched
    // (they were seeded by coaLoader)
    const [existing] = await this.db.select().from(glSettings).limit(1);

    if (existing) {
      await this.db
        .update(glSettings)
        .set({
          fiscalYearStartMonth: dto.fiscalYearStartMonth,
          baseCurrency: dto.baseCurrency,
          revenueRoutingPrecedence: dto.revenueRoutingPrecedence,
          expenseRoutingPrecedence: dto.expenseRoutingPrecedence,
        })
        .where(eq(glSettings.settingsId, existing.settingsId));
    } else {
      await this.db.insert(glSettings).values({
        fiscalYearStartMonth: dto.fiscalYearStartMonth,
        baseCurrency: dto.baseCurrency,
        revenueRoutingPrecedence: dto.revenueRoutingPrecedence,
        expenseRoutingPrecedence: dto.expenseRoutingPrecedence,
      });
    }
  }

  private async saveAppSettings(dto: ExecuteSetupDto) {
    let locationId = dto.defaultLocationId;

    // If a new sterile location was provided, create it first
    if (!locationId && dto.defaultLocationCode && dto.defaultLocationName) {
      const existingLoc = await this.db.query.locations.findFirst({
        where: eq(locations.code, dto.defaultLocationCode),
      });

      if (existingLoc) {
        locationId = existingLoc.locationId;
      } else {
        const [inserted] = await this.db
          .insert(locations)
          .values({
            code: dto.defaultLocationCode,
            name: dto.defaultLocationName,
          })
          .returning();
        locationId = inserted.locationId;
      }
    }

    const [existing] = await this.db.select().from(appSettings).limit(1);

    if (existing) {
      await this.db
        .update(appSettings)
        .set({
          defaultFulfillmentLocationId: locationId || null,
          inventoryValuationMethod: dto.inventoryValuationMethod,
          nonStockBillingMode: dto.nonStockBillingMode,
          setupCompletedAt: new Date(),
        })
        .where(eq(appSettings.settingsId, existing.settingsId));
    } else {
      await this.db.insert(appSettings).values({
        defaultFulfillmentLocationId: locationId || null,
        inventoryValuationMethod: dto.inventoryValuationMethod,
        nonStockBillingMode: dto.nonStockBillingMode,
        setupCompletedAt: new Date(),
      });
    }
  }

  private async saveOrganization(dto: ExecuteSetupDto) {
    const [existing] = await this.db.select().from(organization).limit(1);

    const orgData = {
      name: dto.companyName || 'My Company',
      addressInfo: dto.companyAddress || null,
      phone: dto.companyPhone || null,
      email: dto.companyEmail || null,
      taxId: dto.taxNumber || null,
    };

    if (existing) {
      await this.db
        .update(organization)
        .set(orgData)
        .where(eq(organization.organizationId, existing.organizationId));
    } else {
      await this.db.insert(organization).values(orgData);
    }
  }
}
