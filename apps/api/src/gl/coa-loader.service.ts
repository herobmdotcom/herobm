import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  glAccounts,
  glSettings,
  gstCategories,
  tradingTerms,
} from '../drizzle/modbm-core-schema';
import { eq, count } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { v5 as uuidv5 } from 'uuid';

export function resolveChartsDir(dirnameFallback: string): string {
  // 1. Standard flat structure / ts-node
  const dirPath = path.join(dirnameFallback, 'charts');
  if (fs.existsSync(dirPath)) return dirPath;

  // 2. TSC preserves src/ (e.g. dist/src/gl) but nest-cli copies assets to dist/gl
  const distGlPath = path.join(dirnameFallback, '..', '..', 'gl', 'charts');
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
 * ERPNext-compatible COA JSON format:
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

interface CoaNode {
  root_type?: string;
  account_type?: string;
  account_number?: string;
  is_group?: number;
  description?: string;
  children?: Record<string, CoaNode>;
}

interface CoaFile {
  name: string;
  country_code?: string;
  tree: Record<string, CoaNode>;
  default_accounts?: Record<string, string>;
}

// Map ERPNext root_type to our account_type
const ROOT_TYPE_MAP: Record<string, string> = {
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

  /**
   * Load a chart of accounts from a JSON file.
   * Skips if accounts already exist in the database.
   */
  async loadFromFile(
    filename: string,
  ): Promise<{ created: number; skipped: boolean }> {
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

    // Resolve file path resiliently
    const chartsDir = resolveChartsDir(__dirname);
    const filePath = path.join(chartsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`COA file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const coa: CoaFile = JSON.parse(raw);

    this.logger.log(`Loading chart of accounts: ${coa.name}`);

    // Flatten the tree into ordered inserts
    const insertRows: {
      accountCode: string;
      name: string;
      accountType: string;
      parentCode: string | null;
      isGroup: boolean;
      isSystem: boolean;
    }[] = [];

    let autoCode = 100; // fallback numbering for unnumbered accounts

    const walk = (
      nodes: Record<string, CoaNode>,
      parentCode: string | null,
      inheritedType: string | null,
    ) => {
      for (const [name, node] of Object.entries(nodes)) {
        const accountType =
          ROOT_TYPE_MAP[node.root_type || ''] || inheritedType || 'asset';
        const code = node.account_number || String(autoCode++);
        const isGroup = node.is_group === 1 || !!node.children;

        insertRows.push({
          accountCode: code,
          name,
          accountType,
          parentCode,
          isGroup,
          isSystem: true, // seed accounts are system accounts
        });

        if (node.children) {
          walk(node.children, code, accountType);
        }
      }
    };

    walk(coa.tree, null, null);

    // Insert in dependency order (parents first) within a transaction
    await this.db.transaction(async (tx: DrizzleDB) => {
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
          })
          .onConflictDoUpdate({
            target: [glAccounts.accountCode],
            set: {
              name: row.name,
              accountType: row.accountType,
              isGroup: row.isGroup,
            },
          })
          .returning();

        codeToId.set(row.accountCode, inserted.glAccountId);
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
      const settingsPath = path.join(
        resolveChartsDir(__dirname),
        'au_standard_settings.json',
      );
      if (fs.existsSync(settingsPath)) {
        const settingsRaw = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsRaw);
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
            defaultTaxAccountId: defaults.tax_account_code
              ? codeToId.get(defaults.tax_account_code)
              : undefined,
            defaultExpenseAccountId: defaults.expense_account_code
              ? codeToId.get(defaults.expense_account_code)
              : undefined,
            baseCurrency: settings.base_currency || 'AUD',
          })
          .onConflictDoNothing();

        // Seed GST Categories
        if (settings.gst_categories && Array.isArray(settings.gst_categories)) {
          // Neutralize defaults first to avoid unique constraint if we are updating
          await tx.update(gstCategories).set({ isDefault: false });

          for (const category of settings.gst_categories) {
            const deterministicId = uuidv5(
              'GST_CAT_' + category.code,
              NAMESPACE_COA,
            );
            await tx
              .insert(gstCategories)
              .values({
                gstCategoryId: deterministicId,
                code: category.code,
                title: category.title,
                type: category.type,
                rate: category.rate.toString(),
                isDefault: category.is_default || false,
              })
              .onConflictDoUpdate({
                target: [gstCategories.code],
                set: {
                  title: category.title,
                  type: category.type,
                  rate: category.rate.toString(),
                  isDefault: category.is_default || false,
                },
              });
          }
        }

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
}
