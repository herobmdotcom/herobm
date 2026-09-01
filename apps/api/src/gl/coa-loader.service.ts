import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glAccounts,
  glSettings,
  taxCategories,
  tradingTerms,
} from '@herobm/db-schema';
import { eq, count, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { v5 as uuidv5 } from 'uuid';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

import { GLAccountType } from '@herobm/shared';

export function resolveChartsDir(dirnameFallback: string): string {
  // 1. Standard flat structure / ts-node
  const dirPath = path.join(dirnameFallback, 'charts');
  if (fs.existsSync(dirPath)) return dirPath;

  // 2. TSC preserves src/ (e.g. dist/apps/api/src/gl) but nest-cli copies assets to dist/gl
  const distGlPath = path.join(
    dirnameFallback,
    '..',
    '..',
    '..',
    '..',
    'gl',
    'charts',
  );
  if (fs.existsSync(distGlPath)) return distGlPath;

  // 3. cwd fallbacks
  const srcPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'gl',
    'charts',
  );
  if (fs.existsSync(srcPath)) return srcPath;

  const rootSrcPath = path.join(process.cwd(), 'src', 'gl', 'charts');
  if (fs.existsSync(rootSrcPath)) return rootSrcPath;

  return dirPath;
}

const NAMESPACE_COA = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Legacy-compatible COA JSON format:
 *
 * {
 *   "tree": {
 *     "Assets": {
 *       "root_type": "Asset",
 *       "is_group": 1,
 *       "children": {
 *         "Cash": { "account_number": "1010", "account_type": "Cash" },
 *         ...
 *       }
 *     }
 *   }
 * }
 */

export interface CoaNode {
  root_type?: string;
  account_type?: string;
  account_number?: string;
  is_group?: number;
  description?: string;
  children?: Record<string, CoaNode>;
}

export interface CoaFile {
  name: string;
  country_code?: string;
  tree: Record<string, CoaNode>;
  default_accounts?: Record<string, string>;
}

// Map Legacy root_type to our account_type
const ROOT_TYPE_MAP: Record<string, GLAccountType> = {
  Asset: 'asset',
  Liability: 'liability',
  Equity: 'equity',
  Income: 'revenue',
  Expense: 'expense',
};

@Injectable()
export class CoaLoaderService {
  private readonly logger = new Logger(CoaLoaderService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listAvailableCharts(): Promise<
    { filename: string; name: string; countryCode?: string }[]
  > {
    const chartsDir = resolveChartsDir(__dirname);
    if (!fs.existsSync(chartsDir)) return [];

    const files = fs.readdirSync(chartsDir);
    const charts = [];

    for (const file of files) {
      if (file.endsWith('.json') && !file.endsWith('_settings.json')) {
        try {
          const raw = fs.readFileSync(path.join(chartsDir, file), 'utf-8');
          const coa: CoaFile = JSON.parse(raw);
          charts.push({
            filename: file,
            name: coa.name || file.replace('.json', ''),
            countryCode: coa.country_code,
          });
        } catch (e) {
          this.logger.warn(`Failed to parse COA file ${file}: ${e}`);
        }
      }
    }

    return charts;
  }

  async listAvailableTaxSettings(): Promise<
    { filename: string; name: string; countryCode?: string }[]
  > {
    const chartsDir = resolveChartsDir(__dirname);
    if (!fs.existsSync(chartsDir)) return [];

    const files = fs.readdirSync(chartsDir);
    const settingsFiles = [];

    for (const file of files) {
      if (file.endsWith('_settings.json')) {
        try {
          const raw = fs.readFileSync(path.join(chartsDir, file), 'utf-8');
          const settings = JSON.parse(raw);
          // Only return if it actually has gst_categories
          if (
            settings.gst_categories &&
            Array.isArray(settings.gst_categories)
          ) {
            settingsFiles.push({
              filename: file,
              name: file
                .replace('_settings.json', ' Tax Settings')
                .replace('_', ' ')
                .toUpperCase(),
              countryCode: file.split('_')[0].toUpperCase(),
            });
          }
        } catch (e) {
          this.logger.warn(`Failed to parse settings file ${file}: ${e}`);
        }
      }
    }

    return settingsFiles;
  }

  /**
   * Load a chart of accounts from a JSON file.
   * Skips if accounts already exist in the database.
   */
  async loadFromFile(
    filename: string,
  ): Promise<{ created: number; skipped: boolean }> {
    // Resolve file path resiliently
    const chartsDir = resolveChartsDir(__dirname);
    const filePath = path.join(chartsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`COA file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const coa: CoaFile = JSON.parse(raw);
    const settingsFilename = filename.replace('.json', '_settings.json');
    return this.loadFromData(coa, settingsFilename);
  }

  /**
   * Load a chart of accounts from a parsed CoaFile object.
   */
  async loadFromData(
    coa: CoaFile,
    settingsFilename?: string,
  ): Promise<{ created: number; skipped: boolean }> {
    if (!coa || !coa.tree || typeof coa.tree !== 'object') {
      throw new Error(
        'Invalid Chart of Accounts structure: missing "tree" root property.',
      );
    }

    // Check if COA already loaded
    const [existing] = await this.db
      .select({ count: count() })
      .from(glAccounts);

    // We proceed even if accounts exist to ensure GST Categories, Trading Terms,
    // and GL Settings are always upserted or verified on reload.
    if (existing.count > 0) {
      this.logger.log(
        'Chart of accounts already exists, verifying trailing settings...',
      );
    }

    this.logger.log(`Loading chart of accounts: ${coa.name || 'Custom Chart'}`);

    // Flatten the tree into ordered inserts
    const insertRows: {
      accountCode: string;
      name: string;
      accountType: GLAccountType;
      parentCode: string | null;
      isGroup: boolean;
      isSystem: boolean;
      isBankAccount: boolean;
    }[] = [];

    let autoCode = 100; // fallback numbering for unnumbered accounts

    const walk = (
      nodes: Record<string, CoaNode>,
      parentCode: string | null,
      inheritedType: GLAccountType | null,
    ) => {
      for (const [name, node] of Object.entries(nodes)) {
        const accountType =
          ROOT_TYPE_MAP[node.root_type || ''] || inheritedType || 'asset';
        const code = node.account_number || String(autoCode++);
        const isGroup = node.is_group === 1 || !!node.children;
        const rawType = (node.account_type || '').toLowerCase();
        const isBankAccount =
          !isGroup && (rawType === 'bank' || rawType === 'cash');

        insertRows.push({
          accountCode: code,
          name,
          accountType,
          parentCode,
          isGroup,
          isSystem: true, // seed accounts are system accounts
          isBankAccount,
        });

        if (node.children) {
          walk(node.children, code, accountType);
        }
      }
    };

    walk(coa.tree, null, null);

    // Insert in dependency order (parents first) within a transaction
    await this.db.transaction(async (tx: DrizzleDB) => {
      // Pre-load settings to get base_currency
      const chartsDir = resolveChartsDir(__dirname);
      let settingsPath = settingsFilename
        ? path.join(chartsDir, settingsFilename)
        : '';
      if (!settingsPath || !fs.existsSync(settingsPath)) {
        settingsPath = path.join(chartsDir, 'au_standard_settings.json');
      }
      let baseCurrency = 'EUR';
      let settings: {
        base_currency?: string;
        fiscal_year_start_month?: number;
        defaults?: {
          ar_account_code?: string;
          ap_account_code?: string;
          revenue_account_code?: string;
          cogs_account_code?: string;
          tax_account_code?: string;
          expense_account_code?: string;
          inventory_account_code?: string;
          grni_account_code?: string;
          shrinkage_account_code?: string;
          ppv_account_code?: string;
          otc_cash_account_code?: string;
          otc_card_account_code?: string;
        };
        trading_terms?: {
          code: string;
          description: string;
          days: number;
          type: string;
        }[];
      } = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settings.base_currency) baseCurrency = settings.base_currency;
      }

      // First pass: insert all accounts (parentAccountId = null initially)
      const codeToId = new Map<string, string>();

      for (const row of insertRows) {
        const deterministicId = uuidv5(row.accountCode, NAMESPACE_COA);
        const [inserted] = await tx
          .insert(glAccounts)
          .values({
            glAccountId: deterministicId,
            accountCode: row.accountCode,
            name: row.name,
            accountType: row.accountType,
            isGroup: row.isGroup,
            isSystem: row.isSystem,
            currencyCode: baseCurrency,
            isBankAccount: row.isBankAccount,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [glAccounts.accountCode],
            set: {
              name: row.name,
              accountType: row.accountType,
              isGroup: row.isGroup,
              isBankAccount: row.isBankAccount,
            },
          })
          .returning();

        codeToId.set(row.accountCode, inserted.glAccountId);

        await emitEvent(tx, {
          entityType: EntityType.GL_ACCOUNT,
          entityId: inserted.glAccountId,
          eventType: EventType.CREATED,
          entityDisplayName: row.accountCode,
          payload: { seed: true },
        });
      }

      // Second pass: set parent_account_id
      for (const row of insertRows) {
        if (row.parentCode && codeToId.has(row.parentCode)) {
          await tx
            .update(glAccounts)
            .set({ parentAccountId: codeToId.get(row.parentCode)! })
            .where(eq(glAccounts.accountCode, row.accountCode));
        }
      }

      // Create GL settings with default account mappings
      if (fs.existsSync(settingsPath)) {
        const defaults = settings.defaults || {};

        // Static UUID for environment parity
        const SETTINGS_ID = '4e185bce-d31a-4caa-8462-73c261864eff';

        await tx
          .insert(glSettings)
          .values({
            settingsId: SETTINGS_ID,
            fiscalYearStartMonth: settings.fiscal_year_start_month || 7,
            defaultArAccountId: defaults.ar_account_code
              ? codeToId.get(defaults.ar_account_code)
              : undefined,
            defaultApAccountId: defaults.ap_account_code
              ? codeToId.get(defaults.ap_account_code)
              : undefined,
            defaultRevenueAccountId: defaults.revenue_account_code
              ? codeToId.get(defaults.revenue_account_code)
              : undefined,
            defaultCogsAccountId: defaults.cogs_account_code
              ? codeToId.get(defaults.cogs_account_code)
              : undefined,
            defaultSalesTaxAccountId: defaults.tax_account_code
              ? codeToId.get(defaults.tax_account_code)
              : undefined,
            defaultPurchaseTaxAccountId: defaults.tax_account_code
              ? codeToId.get(defaults.tax_account_code)
              : undefined,
            defaultExpenseAccountId: defaults.expense_account_code
              ? codeToId.get(defaults.expense_account_code)
              : undefined,
            defaultInventoryAccountId: defaults.inventory_account_code
              ? codeToId.get(defaults.inventory_account_code)
              : undefined,
            defaultGrniAccountId: defaults.grni_account_code
              ? codeToId.get(defaults.grni_account_code)
              : undefined,
            defaultShrinkageAccountId: defaults.shrinkage_account_code
              ? codeToId.get(defaults.shrinkage_account_code)
              : undefined,
            defaultPpvAccountId: defaults.ppv_account_code
              ? codeToId.get(defaults.ppv_account_code)
              : undefined,
            defaultOtcCashAccountId: defaults.otc_cash_account_code
              ? codeToId.get(defaults.otc_cash_account_code)
              : undefined,
            defaultOtcCardAccountId: defaults.otc_card_account_code
              ? codeToId.get(defaults.otc_card_account_code)
              : undefined,
            baseCurrency: settings.base_currency || 'AUD',
            bankMatchDateToleranceDays: 0,
            revenueRoutingPrecedence: 'product_first',
            expenseRoutingPrecedence: 'product_first',
          })
          .onConflictDoUpdate({
            target: glSettings.settingsId,
            set: {
              defaultArAccountId: defaults.ar_account_code
                ? codeToId.get(defaults.ar_account_code)
                : undefined,
              defaultApAccountId: defaults.ap_account_code
                ? codeToId.get(defaults.ap_account_code)
                : undefined,
              defaultRevenueAccountId: defaults.revenue_account_code
                ? codeToId.get(defaults.revenue_account_code)
                : undefined,
              defaultCogsAccountId: defaults.cogs_account_code
                ? codeToId.get(defaults.cogs_account_code)
                : undefined,
              defaultSalesTaxAccountId: defaults.tax_account_code
                ? codeToId.get(defaults.tax_account_code)
                : undefined,
              defaultPurchaseTaxAccountId: defaults.tax_account_code
                ? codeToId.get(defaults.tax_account_code)
                : undefined,
              defaultExpenseAccountId: defaults.expense_account_code
                ? codeToId.get(defaults.expense_account_code)
                : undefined,
              defaultInventoryAccountId: defaults.inventory_account_code
                ? codeToId.get(defaults.inventory_account_code)
                : undefined,
              defaultGrniAccountId: defaults.grni_account_code
                ? codeToId.get(defaults.grni_account_code)
                : undefined,
              defaultShrinkageAccountId: defaults.shrinkage_account_code
                ? codeToId.get(defaults.shrinkage_account_code)
                : undefined,
              defaultPpvAccountId: defaults.ppv_account_code
                ? codeToId.get(defaults.ppv_account_code)
                : undefined,
              defaultOtcCashAccountId: defaults.otc_cash_account_code
                ? codeToId.get(defaults.otc_cash_account_code)
                : undefined,
              defaultOtcCardAccountId: defaults.otc_card_account_code
                ? codeToId.get(defaults.otc_card_account_code)
                : undefined,
            },
          });

        // Note: GST Categories are explicitly NOT seeded here anymore as they have been split
        // out into their own loader (loadTaxSettingsFromFile) and are seeded on-demand via FE.

        // Seed Trading Terms
        if (settings.trading_terms && Array.isArray(settings.trading_terms)) {
          for (const term of settings.trading_terms) {
            const deterministicId = uuidv5('TERM_' + term.code, NAMESPACE_COA);
            await tx
              .insert(tradingTerms)
              .values({
                tradingTermsId: deterministicId,
                code: term.code,
                description: term.description,
                days: term.days,
                type: term.type,
                source: 'app',
                isActive: true,
              })
              .onConflictDoUpdate({
                target: [tradingTerms.code],
                set: {
                  description: term.description,
                  days: term.days,
                  type: term.type,
                },
              });
          }
        }
      }
    });

    this.logger.log(
      `Chart of accounts loaded: ${insertRows.length} accounts created`,
    );

    return { created: insertRows.length, skipped: false };
  }

  /**
   * Load only tax settings (GST categories) from a settings JSON file.
   */
  // @herobm-skip-audit
  async loadTaxSettingsFromFile(
    filename: string,
  ): Promise<{ created: number; skipped: boolean }> {
    const chartsDir = resolveChartsDir(__dirname);
    const filePath = path.join(chartsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Tax settings file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const settings = JSON.parse(raw);

    if (!settings.gst_categories || !Array.isArray(settings.gst_categories)) {
      throw new Error(`No gst_categories found in ${filename}`);
    }

    this.logger.log(`Loading tax settings from: ${filename}`);

    await this.db.transaction(async (tx: DrizzleDB) => {
      for (const category of settings.gst_categories) {
        const deterministicId = uuidv5(
          'GST_CAT_' + category.code,
          NAMESPACE_COA,
        );
        await tx
          .insert(taxCategories)
          .values({
            taxCategoryId: deterministicId,
            code: category.code,
            title: category.title,
            type: category.type,
            rate: category.rate.toString(),
          })
          .onConflictDoUpdate({
            target: [taxCategories.code],
            set: {
              title: category.title,
              type: category.type,
              rate: category.rate.toString(),
            },
          });
      }
    });

    this.logger.log(
      `Tax settings loaded: ${settings.gst_categories.length} categories created/updated`,
    );

    return { created: settings.gst_categories.length, skipped: false };
  }
}
