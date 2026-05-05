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
import { eq } from 'drizzle-orm';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  // In-memory job tracking for the setup process
  private activeJobs: Record<string, any> = {};

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(AppConfigService) private readonly appConfig: AppConfigService,
    @Inject(CoaLoaderService) private readonly coaLoader: CoaLoaderService,
  ) {}

  async getStatus() {
    const rawApp = this.appConfig.getAppSettingsRaw();
    return {
      needsSetup: !rawApp?.setupCompletedAt,
      setupCompletedAt: rawApp?.setupCompletedAt || null,
    };
  }

  async getCoaPresets() {
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

  private lastAbmPreview: any = null;

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
            const previewData = JSON.parse(stdout.trim());
            this.lastAbmPreview = previewData;
            resolve({
              success: true,
              message: 'Connected',
              preview: previewData,
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

  async getAbmPreview() {
    return (
      this.lastAbmPreview || {
        tables: [],
        locations: [{ code: 'HQ', name: 'Main Headquarters' }],
      }
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

  async initializeSystem(dto: ExecuteSetupDto) {
    this.logger.log('--- Initializing Base System ---');

    // Step 1: Load Chart of Accounts
    this.logger.log(`Loading Chart of Accounts: ${dto.coaPreset}`);
    await this.coaLoader.loadFromFile(dto.coaPreset);

    // Step 2: Configure GL settings
    this.logger.log('Configuring GL...');
    await this.saveGlSettings(dto);

    // Step 3: Configure App settings
    this.logger.log('Configuring App...');
    await this.saveAppSettings(dto);

    // Step 4: Seed organization
    this.logger.log('Configuring Organization...');
    await this.saveOrganization(dto);
    await this.appConfig.reload();

    // Step 5: Absolute Final Operation (Seed users/system)
    this.logger.log('Seeding base system records (including users)...');
    await this.runCommandStream(undefined, 'make', ['seed']);

    this.logger.log('--- Base System Initialized Successfully ---');
    return { success: true };
  }

  async executeElt(dto: ExecuteSetupDto) {
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

  async runEltCore(dto: ExecuteSetupDto, jobId?: string) {
    try {
      this.log(jobId, '--- Initializing ABM ELT Pipeline ---');
      const envOverride: Record<string, string> = {
        DEFAULT_FULFILLMENT_LOCATION_CODE: dto.defaultLocationCode || 'HQ',
        INVENTORY_VALUATION_METHOD: dto.inventoryValuationMethod,
      };
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

      envOverride['ABM_RESUME'] = dto.resumeExtraction ? 'true' : 'false';

      await this.runCommandStream(jobId, 'make', ['elt'], envOverride);

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

  private async saveGlSettings(dto: ExecuteSetupDto) {
    const SETTINGS_ID = '4e185bce-d31a-4caa-8462-73c261864eff';
    const data = {
      fiscalYearStartMonth: dto.fiscalYearStartMonth,
      baseCurrency: dto.baseCurrency,
      revenueRoutingPrecedence: dto.revenueRoutingPrecedence,
      expenseRoutingPrecedence: dto.expenseRoutingPrecedence,
    };
    await this.db
      .insert(glSettings)
      .values({ settingsId: SETTINGS_ID, ...data })
      .onConflictDoUpdate({ target: glSettings.settingsId, set: data });
  }

  private async saveAppSettings(
    dto: ExecuteSetupDto,
    linkLocation: boolean = true,
  ) {
    const [existing] = await this.db.select().from(appSettings).limit(1);
    let locationId =
      dto.defaultLocationId || existing?.defaultFulfillmentLocationId;

    if (linkLocation && !dto.defaultLocationId) {
      const targetCode = dto.defaultLocationCode || 'HQ';
      const existingLoc = await this.db.query.locations.findFirst({
        where: eq(locations.code, targetCode),
      });
      if (existingLoc) {
        locationId = existingLoc.locationId;
      } else if (dto.defaultLocationCode && dto.defaultLocationName) {
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

    const data = {
      defaultFulfillmentLocationId: locationId || null,
      inventoryValuationMethod: dto.inventoryValuationMethod,
      inventoryAccountingMode: dto.inventoryAccountingMode,
      nonStockBillingMode: dto.nonStockBillingMode,
      setupCompletedAt: new Date(),
    };

    if (existing) {
      await this.db
        .update(appSettings)
        .set(data)
        .where(eq(appSettings.settingsId, existing.settingsId));
    } else {
      await this.db.insert(appSettings).values(data);
    }
  }

  private async saveOrganization(dto: ExecuteSetupDto) {
    const ORG_ID = '00000000-0000-0000-0000-000000000000';
    const data = {
      name: dto.companyName || 'My Company',
      addressLine1: dto.companyAddress || null,
      phone: dto.companyPhone || null,
      email: dto.companyEmail || null,
      taxNumber: dto.taxNumber || null,
    };
    await this.db
      .insert(organization)
      .values({ organizationId: ORG_ID, ...data })
      .onConflictDoUpdate({ target: organization.organizationId, set: data });
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
}
