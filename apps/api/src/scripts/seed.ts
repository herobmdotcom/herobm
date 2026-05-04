import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import {
  users,
  uomDictionary,
  products,
  costCenters,
  activities,
  organization,
  taxCategories,
  tradingTerms,
  glSettings,
  appSettings,
  glAccounts,
  reports,
  reportHookAssignments,
  reportContexts,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const NAMESPACE_COA = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidv5(name: string, namespace: string): string {
  const nsBuffer = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const nameBuffer = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(nsBuffer).update(nameBuffer).digest();
  
  hash[6] = (hash[6] & 0x0f) | 0x50; // set version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // set variant 1
  
  return [
    hash.toString('hex', 0, 4),
    hash.toString('hex', 4, 6),
    hash.toString('hex', 6, 8),
    hash.toString('hex', 8, 10),
    hash.toString('hex', 10, 16),
  ].join('-');
}

const ROOT_TYPE_MAP: Record<string, string> = {
  Asset: 'asset',
  Liability: 'liability',
  Equity: 'equity',
  Income: 'revenue',
  Expense: 'expense',
};

const GST_TYPE_MAP: Record<string, string> = {
  gst_applies: 'tax_applies',
};

// Generic seed utility that takes any drizzle DB (postgres or pglite)
export async function runStandardSeeds(db: any, dryRun = false) {
  if (dryRun) {
    console.log('Dry run mode -- no data will be written.');
  }

  await seedUsers(db, dryRun);
  await seedProducts(db, dryRun);
  await seedOrganization(db, dryRun);
  await seedCoaAccounts(db, dryRun);
  await seedCoaSettings(db, dryRun);
  await seedAppSettings(db, dryRun);
  await seedFinancialDimensions(db, dryRun);
  await seedReports(db, dryRun);

  console.log('\nDone.');
}

async function seedUsers(db: any, dryRun: boolean) {
  const reqVars = [
    'DEV_ADMIN_PASSWORD',
    'DEV_VIEWER_PASSWORD',
    'DEV_SALES_PASSWORD',
    'DEV_WAREHOUSE_PASSWORD',
    'DEV_PROCUREMENT_PASSWORD',
    'DEV_FINANCE_PASSWORD',
  ];
  const missing = reqVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.log(`  SKIP: Missing env vars: ${missing.join(', ')}`);
    return;
  }

  if (dryRun) {
    console.log('  [DRY RUN] Would seed users: admin, viewer, sales, warehouse, procurement, finance');
    return;
  }

  const rolePasswords = [
    { username: 'admin', pass: process.env.DEV_ADMIN_PASSWORD, role: 'admin' },
    { username: 'viewer', pass: process.env.DEV_VIEWER_PASSWORD, role: 'viewer' },
    { username: 'sales', pass: process.env.DEV_SALES_PASSWORD, role: 'sales' },
    { username: 'warehouse', pass: process.env.DEV_WAREHOUSE_PASSWORD, role: 'warehouse' },
    { username: 'procurement', pass: process.env.DEV_PROCUREMENT_PASSWORD, role: 'procurement' },
    { username: 'finance', pass: process.env.DEV_FINANCE_PASSWORD, role: 'finance' },
  ];

  for (const item of rolePasswords) {
    const hash = await bcrypt.hash(item.pass!, 10);
    await db
      .insert(users)
      .values({
        username: item.username,
        passwordHash: hash,
        role: item.role as any,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { passwordHash: hash, role: item.role as any },
      });
  }
  console.log('  Seeded users: admin, viewer, sales, warehouse, procurement, finance');
}

async function seedProducts(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log("  [DRY RUN] Would seed UOM 'EA' and SYSTEM-CUSTOM-LINE product");
    return;
  }

  await db
    .insert(uomDictionary)
    .values({ uomCode: 'EA', description: 'Each' })
    .onConflictDoNothing();

  await db
    .insert(products)
    .values({
      productId: '00000000-0000-0000-0000-000000000000',
      productNumber: 'SYSTEM-CUSTOM-LINE',
      name: 'Custom Line Product',
    })
    .onConflictDoUpdate({
      target: products.productId,
      set: { productNumber: 'SYSTEM-CUSTOM-LINE', name: 'Custom Line Product' },
    });

  console.log("  Seeded UOM 'EA' and SYSTEM-CUSTOM-LINE product");
}

async function seedFinancialDimensions(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log("  [DRY RUN] Would seed default '00' Cost Center and Activity");
    return;
  }

  const ccId = uuidv5('DIM_CC_00', NAMESPACE_COA);
  const actId = uuidv5('DIM_ACT_00', NAMESPACE_COA);

  await db
    .insert(costCenters)
    .values({
      costCenterId: ccId,
      code: '00',
      name: 'Default',
      isSystem: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: costCenters.code,
      set: { name: 'Default', isSystem: true, isActive: true },
    });

  await db
    .insert(activities)
    .values({
      activityId: actId,
      code: '00',
      name: 'Default',
      isSystem: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: activities.code,
      set: { name: 'Default', isSystem: true, isActive: true },
    });

  console.log("  Seeded default '00' dimensions (Cost Center, Activity)");
}

async function seedOrganization(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed fallback organization if none exists');
    return;
  }

  const existing = await db.select().from(organization).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: Organization record already exists.');
    return;
  }

  await db
    .insert(organization)
    .values({
      organizationId: '00000000-0000-0000-0000-000000000000',
      name: 'My Company',
    })
    .onConflictDoNothing();

  console.log('  Seeded default organization (fallback)');
}

async function seedAppSettings(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed default app_settings');
    return;
  }

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: app_settings record already exists.');
    return;
  }

  await db
    .insert(appSettings)
    .values({
      inventoryValuationMethod: 'weighted_average',
      nonStockBillingMode: 'per_shipment',
      creditLimitBehavior: 'soft',
      setupCompletedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log('  Seeded default app_settings');
}

function loadCoaSettings() {
  const p = path.join(__dirname, '..', 'gl', 'charts', 'au_standard_settings.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function seedCoaSettings(db: any, dryRun: boolean) {
  const settings = loadCoaSettings();
  if (!settings) {
    console.log('  SKIP: No COA settings file found.');
    return;
  }

  const categories = settings.gst_categories || [];
  const terms = settings.trading_terms || [];

  if (dryRun) {
    console.log(`  [DRY RUN] Would seed ${categories.length} tax categories and ${terms.length} trading terms`);
    return;
  }

  for (const cat of categories) {
    const detId = uuidv5('GST_CAT_' + cat.code, NAMESPACE_COA);
    const type = GST_TYPE_MAP[cat.type] || cat.type;
    await db
      .insert(taxCategories)
      .values({
        taxCategoryId: detId,
        code: cat.code,
        title: cat.title,
        type: type,
        rate: cat.rate.toString(),
        isDefault: !!cat.is_default,
      })
      .onConflictDoUpdate({
        target: taxCategories.code,
        set: { title: cat.title, type: type, rate: cat.rate.toString(), isDefault: !!cat.is_default },
      });
  }
  console.log(`  Seeded ${categories.length} tax categories`);

  for (const term of terms) {
    const detId = uuidv5('TERM_' + term.code, NAMESPACE_COA);
    await db
      .insert(tradingTerms)
      .values({
        tradingTermsId: detId,
        code: term.code,
        description: term.description,
        days: term.days,
        type: term.type,
      })
      .onConflictDoUpdate({
        target: tradingTerms.code,
        set: { description: term.description, days: term.days, type: term.type },
      });
  }
  console.log(`  Seeded ${terms.length} trading terms`);

  const baseCurrency = settings.base_currency || 'AUD';
  const fiscalMonth = settings.fiscal_year_start_month || 7;
  const defaults = settings.defaults || {};

  const glData: any = {
    settingsId: '4e185bce-d31a-4caa-8462-73c261864eff',
    baseCurrency,
    fiscalYearStartMonth: fiscalMonth,
  };

  const mappings = [
    { json: 'ar_account_code', col: 'defaultArAccountId' },
    { json: 'ap_account_code', col: 'defaultApAccountId' },
    { json: 'revenue_account_code', col: 'defaultRevenueAccountId' },
    { json: 'cogs_account_code', col: 'defaultCogsAccountId' },
    { json: 'tax_account_code', col: 'defaultTaxAccountId' },
    { json: 'expense_account_code', col: 'defaultExpenseAccountId' },
  ];

  for (const map of mappings) {
    if (defaults[map.json]) {
      glData[map.col] = uuidv5(defaults[map.json], NAMESPACE_COA);
    }
  }

  await db
    .insert(glSettings)
    .values(glData)
    .onConflictDoUpdate({
      target: glSettings.settingsId,
      set: glData,
    });

  console.log(`  Seeded GL settings (base_currency=${baseCurrency}, fiscal_month=${fiscalMonth})`);
}

async function seedCoaAccounts(db: any, dryRun: boolean) {
  const coaPath = path.join(__dirname, '..', 'gl', 'charts', 'au_standard.json');
  if (!fs.existsSync(coaPath)) {
    console.log(`  SKIP: COA file not found at ${coaPath}`);
    return;
  }

  const coa = JSON.parse(fs.readFileSync(coaPath, 'utf-8'));

  if (dryRun) {
    console.log('  [DRY RUN] Would seed Chart of Accounts from au_standard.json');
    return;
  }

  const existing = await db.select().from(glAccounts).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: GL accounts already exist');
    return;
  }

  let autoCode = 100;
  const insertRows: any[] = [];

  function walk(nodes: any, parentCode: string | null, inheritedType: string | null) {
    for (const [name, node] of Object.entries<any>(nodes)) {
      const accountType = ROOT_TYPE_MAP[node.root_type || ''] || inheritedType || 'asset';
      const code = node.account_number || String(autoCode++);
      const isGroup = node.is_group === 1 || !!node.children;

      insertRows.push({
        code,
        name,
        accountType,
        parentCode,
        isGroup,
      });

      if (node.children) {
        walk(node.children, code, accountType);
      }
    }
  }

  walk(coa.tree || {}, null, null);

  for (const row of insertRows) {
    const detId = uuidv5(row.code, NAMESPACE_COA);
    await db
      .insert(glAccounts)
      .values({
        glAccountId: detId,
        accountCode: row.code,
        name: row.name,
        accountType: row.accountType as any,
        isGroup: row.isGroup,
        isSystem: true,
        currencyCode: 'AUD',
      })
      .onConflictDoUpdate({
        target: glAccounts.accountCode,
        set: { name: row.name, accountType: row.accountType as any, isGroup: row.isGroup },
      });
  }

  for (const row of insertRows) {
    if (row.parentCode) {
      const parentId = uuidv5(row.parentCode, NAMESPACE_COA);
      await db
        .update(glAccounts)
        .set({ parentAccountId: parentId })
        .where(eq(glAccounts.accountCode, row.code));
    }
  }

  console.log(`  Seeded ${insertRows.length} GL accounts from au_standard.json`);
}

function loadReportConfig() {
  // Shared package is at root/packages/shared
  // __dirname is root/apps/api/src/scripts
  const p = path.join(__dirname, '..', '..', '..', '..', 'packages', 'shared', 'reports-config.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')).reports || [];
}

async function seedReports(db: any, dryRun: boolean) {
  const reportList = loadReportConfig();

  if (dryRun) {
    console.log(`  [DRY RUN] Would seed ${reportList.length} report templates and hooks`);
    return;
  }

  function readTemplate(filename: string) {
    // Template files are in root/tools/seeds/reports
    const p = path.join(__dirname, '..', '..', '..', '..', 'tools', 'seeds', 'reports', filename);
    if (!fs.existsSync(p)) {
      console.log(`  [WARN] Template file not found: ${p}`);
      return null;
    }
    return fs.readFileSync(p, 'utf-8');
  }

  let seededCount = 0;
  let hookCount = 0;

  for (const r of reportList) {
    const templateContent = readTemplate(r.filename);
    if (!templateContent) continue;

    await db
      .insert(reports)
      .values({
        id: r.id,
        slug: r.slug,
        name: r.name,
        template: templateContent,
        outputNamePattern: r.output_name_pattern,
      })
      .onConflictDoUpdate({
        target: reports.id,
        set: {
          template: templateContent,
          name: r.name,
          slug: r.slug,
          outputNamePattern: r.output_name_pattern,
        },
      });
    seededCount++;

    if (r.hook) {
      const ctx = r.context || 'default';
      await db
        .insert(reportHookAssignments)
        .values({
          hookSlug: r.hook,
          reportId: r.id,
          contextSlug: ctx,
        })
        .onConflictDoUpdate({
          target: reportHookAssignments.hookSlug,
          set: { reportId: r.id, contextSlug: ctx },
        });
      hookCount++;
    }

    if (r.context) {
      await db
        .insert(reportContexts)
        .values({
          reportId: r.id,
          context: r.context,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`  Seeded ${seededCount} reports and ${hookCount} hook assignments.`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'custom_app',
  });

  const db = drizzle(pool);

  try {
    await runStandardSeeds(db, dryRun);
  } finally {
    await pool.end();
  }
}

// Only execute main if run directly
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
