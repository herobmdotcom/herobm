import 'dotenv/config';
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
  locations,
  zones,
  bins,
  customers,
  suppliers,
} from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const NAMESPACE_COA = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidv5(name: string, namespace: string): string {
  const nsBuffer = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const nameBuffer = Buffer.from(name, 'utf8');
  const hash = crypto
    .createHash('sha1')
    .update(nsBuffer)
    .update(nameBuffer)
    .digest();

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

  await seedCasbinPolicies(db, dryRun);
  await seedUsers(db, dryRun);
  await seedProducts(db, dryRun);
  await seedOrganization(db, dryRun);
  await seedBaseGlSettings(db, dryRun);
  await seedAppSettings(db, dryRun);
  await seedFinancialDimensions(db, dryRun);
  await seedReports(db, dryRun);

  console.log('\nDone.');
}

async function seedCasbinPolicies(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed standard casbin policies');
    return;
  }

  const { casbinRule } = await import('../drizzle/modbm-core-schema.js');

  const existing = await db.select().from(casbinRule);
  const existingSet = new Set(
    existing.map((r: any) =>
      [
        r.ptype || '',
        r.v0 || '',
        r.v1 || '',
        r.v2 || '',
        r.v3 || '',
        r.v4 || '',
        r.v5 || '',
      ].join('|'),
    ),
  );

  const policies = [
    { ptype: 'p', v0: 'viewer', v1: 'customers', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'products', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'inventory', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'sales-orders', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'purchase-orders', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'suppliers', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'receptions', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'goods-received', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'dashboard', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'tax-categories', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'settings', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'report', v2: 'read' },
    { ptype: 'p', v0: 'viewer', v1: 'payments', v2: 'read' },

    { ptype: 'p', v0: 'admin', v1: 'report', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'report', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'report', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'customers', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'customers', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'customers', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'products', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'products', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'products', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'sales-orders', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'sales-orders', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'sales-orders', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'purchase-orders', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'purchase-orders', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'purchase-orders', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'suppliers', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'suppliers', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'suppliers', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'receptions', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'receptions', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'receptions', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'goods-received', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'goods-received', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'goods-received', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'inventory', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'inventory', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'inventory', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'users', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'users', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'users', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'roles', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'roles', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'roles', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'settings', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'settings', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'settings', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'gl', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'gl', v2: 'write' },

    { ptype: 'p', v0: 'admin', v1: 'payments', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'payments', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'payments', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'system_logs', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'system_logs', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'system_logs', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'import', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'import', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'import', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'api_keys', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'api_keys', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'api_keys', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'webhooks', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'webhooks', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'webhooks', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'events', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'events', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'events', v2: 'archive' },

    { ptype: 'p', v0: 'admin', v1: 'tax-categories', v2: 'read' },
    { ptype: 'p', v0: 'admin', v1: 'tax-categories', v2: 'write' },
    { ptype: 'p', v0: 'admin', v1: 'tax-categories', v2: 'archive' },

    { ptype: 'p', v0: 'system', v1: 'import', v2: 'write' },
    { ptype: 'p', v0: 'system', v1: 'import', v2: 'read' },

    { ptype: 'p', v0: 'finance', v1: 'gl', v2: 'read' },
    { ptype: 'p', v0: 'finance', v1: 'gl', v2: 'write' },
    { ptype: 'p', v0: 'finance', v1: 'payments', v2: 'write' },
    { ptype: 'p', v0: 'finance', v1: 'sales-orders', v2: 'write' },
    { ptype: 'p', v0: 'finance', v1: 'purchase-orders', v2: 'write' },

    { ptype: 'p', v0: 'sales', v1: 'customers', v2: 'write' },
    { ptype: 'p', v0: 'sales', v1: 'sales-orders', v2: 'write' },

    { ptype: 'p', v0: 'warehouse', v1: 'sales-orders', v2: 'write' },
    { ptype: 'p', v0: 'warehouse', v1: 'purchase-orders', v2: 'write' },
    { ptype: 'p', v0: 'warehouse', v1: 'receptions', v2: 'write' },
    { ptype: 'p', v0: 'warehouse', v1: 'goods-received', v2: 'write' },
    { ptype: 'p', v0: 'warehouse', v1: 'inventory', v2: 'write' },

    { ptype: 'p', v0: 'procurement', v1: 'suppliers', v2: 'write' },
    { ptype: 'p', v0: 'procurement', v1: 'purchase-orders', v2: 'write' },

    { ptype: 'g', v0: 'admin', v1: 'viewer' },
    { ptype: 'g', v0: 'finance', v1: 'viewer' },
    { ptype: 'g', v0: 'sales', v1: 'viewer' },
    { ptype: 'g', v0: 'warehouse', v1: 'viewer' },
    { ptype: 'g', v0: 'procurement', v1: 'viewer' },
    { ptype: 'g', v0: 'agent', v1: 'viewer' },
    { ptype: 'g', v0: 'webhook', v1: 'viewer' },
  ];

  const toInsert = policies.filter((p: any) => {
    const key = [
      p.ptype || '',
      p.v0 || '',
      p.v1 || '',
      p.v2 || '',
      p.v3 || '',
      p.v4 || '',
      p.v5 || '',
    ].join('|');
    return !existingSet.has(key);
  });

  if (toInsert.length > 0) {
    await db.insert(casbinRule).values(toInsert);
    console.log(`  Seeded ${toInsert.length} new Casbin policies`);
  } else {
    console.log('  All standard Casbin policies already seeded.');
  }
}

async function seedUsers(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed user: admin');
    return;
  }

  let adminPass = process.env.DEV_ADMIN_PASSWORD;
  let generated = false;

  if (!adminPass) {
    adminPass = crypto.randomBytes(16).toString('hex');
    generated = true;
  }

  const hash = await bcrypt.hash(adminPass, 10);

  await db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash: hash,
      role: 'admin' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { passwordHash: hash, role: 'admin' as any, isActive: true },
    });

  console.log('  Seeded user: admin');

  if (generated) {
    console.log(
      '\n=============================================================',
    );
    console.log('  [SECURE] Generated Admin Password:');
    console.log(`  ${adminPass}`);
    console.log('  Please save this password, it will not be shown again.');
    console.log(
      '=============================================================\n',
    );
  }
}

async function seedProducts(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log(
      "  [DRY RUN] Would seed UOM 'EA' and SYSTEM-CUSTOM-LINE product",
    );
    return;
  }

  await db
    .insert(uomDictionary)
    .values({ uomCode: 'EA', description: 'Each' })
    .onConflictDoUpdate({
      target: uomDictionary.uomCode,
      set: { description: 'Each' },
    });

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
    .onConflictDoUpdate({
      target: organization.organizationId,
      set: { name: 'My Company' },
    });

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

function loadCoaSettings(prefix = 'au_standard') {
  const p = path.join(
    __dirname,
    '..',
    'gl',
    'charts',
    `${prefix}_settings.json`,
  );
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function seedBaseGlSettings(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed base gl_settings');
    return;
  }

  const existing = await db.select().from(glSettings).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: gl_settings record already exists.');
    return;
  }

  await db
    .insert(glSettings)
    .values({
      settingsId: '4e185bce-d31a-4caa-8462-73c261864eff', // Use same constant ID
      fiscalYearStartMonth: 7, // default
      baseCurrency: 'AUD', // fallback
    })
    .onConflictDoNothing();

  console.log('  Seeded base gl_settings (without accounts)');
}

export async function seedCoaAccounts(
  db: any,
  dryRun: boolean,
  prefix = 'au_standard',
) {
  const coaPath = path.join(__dirname, '..', 'gl', 'charts', `${prefix}.json`);
  if (!fs.existsSync(coaPath)) {
    console.log(`  SKIP: COA file not found at ${coaPath}`);
    return;
  }

  const coa = JSON.parse(fs.readFileSync(coaPath, 'utf-8'));

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would seed Chart of Customers from ${prefix}.json`,
    );
    return;
  }

  const existing = await db.select().from(glAccounts).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: GL customers already exist');
    return;
  }

  let autoCode = 100;
  const insertRows: any[] = [];

  function walk(
    nodes: any,
    parentCode: string | null,
    inheritedType: string | null,
  ) {
    for (const [name, node] of Object.entries<any>(nodes)) {
      const accountType =
        ROOT_TYPE_MAP[node.root_type || ''] || inheritedType || 'asset';
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
        accountType: row.accountType,
        isGroup: row.isGroup,
        isSystem: true,
        currencyCode: prefix === 'us_standard' ? 'USD' : 'AUD',
      })
      .onConflictDoUpdate({
        target: glAccounts.accountCode,
        set: {
          name: row.name,
          accountType: row.accountType,
          isGroup: row.isGroup,
        },
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

  console.log(
    `  Seeded ${insertRows.length} GL customers from au_standard.json`,
  );
}

export async function seedCoaSettings(
  db: any,
  dryRun: boolean,
  prefix = 'au_standard',
) {
  const settings = loadCoaSettings(prefix);
  if (!settings) {
    console.log('  SKIP: No COA settings file found.');
    return;
  }

  const categories = settings.gst_categories || [];
  const terms = settings.trading_terms || [];

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would seed ${categories.length} tax categories and ${terms.length} trading terms`,
    );
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
        set: {
          title: cat.title,
          type: type,
          rate: cat.rate.toString(),
          isDefault: !!cat.is_default,
        },
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
        set: {
          description: term.description,
          days: term.days,
          type: term.type,
        },
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

  await db.insert(glSettings).values(glData).onConflictDoUpdate({
    target: glSettings.settingsId,
    set: glData,
  });

  console.log('  Seeded COA defaults to gl_settings');
  console.log(
    `  Seeded GL settings (base_currency=${baseCurrency}, fiscal_month=${fiscalMonth})`,
  );
}

function loadReportConfig() {
  // Shared package is at root/packages/shared
  // __dirname is root/apps/api/src/scripts
  const p = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'packages',
    'shared',
    'reports-config.json',
  );
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')).reports || [];
}

async function seedReports(db: any, dryRun: boolean) {
  const reportList = loadReportConfig();

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would seed ${reportList.length} report templates and hooks`,
    );
    return;
  }

  function readTemplate(filename: string) {
    // Template files are in root/tools/seeds/reports
    const p = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'tools',
      'seeds',
      'reports',
      filename,
    );
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

  console.log(
    `  Seeded ${seededCount} reports and ${hookCount} hook assignments.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
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

export async function seedAccounts(db: any, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed default customer and vendor');
    return;
  }

  // Seed customer
  await db
    .insert(customers)
    .values({
      customerId: '20000000-0000-0000-0000-000000000001',
      customerNumber: 'CUST-E2E-001',
      name: 'E2E Default Customer',
      currencyCode: 'AUD',
    })
    .onConflictDoUpdate({
      target: customers.customerId,
      set: { name: 'E2E Default Customer' },
    });

  // Seed vendor
  await db
    .insert(suppliers)
    .values({
      vendorId: '20000000-0000-0000-0000-000000000002',
      vendorNumber: 'VEND-E2E-001',
      name: 'E2E Default Vendor',
      currencyCode: 'AUD',
    })
    .onConflictDoUpdate({
      target: suppliers.vendorId,
      set: { name: 'Seed Vendor' },
    });

  console.log('  Seeded default customer and vendor');
}
