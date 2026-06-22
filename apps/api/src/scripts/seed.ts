import { SystemResource } from '@herobm/shared';
import { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from '../drizzle/herobm-core-schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
export type SeedDB = PgDatabase<any, typeof schema, any>;

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
  pdfTemplates,
  pdfTemplateHooks,
  pdfTemplateContexts,
  locations,
  zones,
  bins,
  customers,
  suppliers,
} from '../drizzle/herobm-core-schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

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
export async function runStandardSeeds(db: SeedDB, dryRun = false) {
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

async function seedCasbinPolicies(db: SeedDB, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed standard casbin policies');
    return;
  }

  const { casbinRule } = await import('../drizzle/herobm-core-schema.js');

  const existingSet = new Set();

  if (!dryRun) {
    console.log(
      '  Wiping all existing Casbin rules for Deny-Override migration...',
    );
    await db.delete(casbinRule);
  }

  const policies = [
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.CUSTOMERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.PRODUCTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.INVENTORY,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.SALES_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.SALES_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.SUPPLIERS,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.DASHBOARD,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.SETTINGS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.REPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.BUSINESS_REPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.PAYMENTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.CREDIT_CONTROL,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.REPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.REPORT,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.REPORT,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.BUSINESS_REPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.BUSINESS_REPORT,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.BUSINESS_REPORT,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.CUSTOMERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.CUSTOMERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.CUSTOMERS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PRODUCTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PRODUCTS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PRODUCTS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_ORDERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_ORDERS,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_ORDERS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_RETURNS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_RETURNS,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_RETURNS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SUPPLIERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SUPPLIERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SUPPLIERS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'handle',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.INVENTORY,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.INVENTORY,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.INVENTORY,
      v2: 'archive',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.INVENTORY,
      v2: 'handle',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.USERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.USERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.USERS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.ROLES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.ROLES,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.ROLES,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SETTINGS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SETTINGS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SETTINGS,
      v2: 'archive',
      v3: 'allow',
    },

    { ptype: 'p', v0: 'admin', v1: SystemResource.GL, v2: 'read', v3: 'allow' },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.GL,
      v2: 'write',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PAYMENTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PAYMENTS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.PAYMENTS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SYSTEM_LOGS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SYSTEM_LOGS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SYSTEM_LOGS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.IMPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.IMPORT,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.IMPORT,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.API_KEYS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.API_KEYS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.API_KEYS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.WEBHOOKS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.WEBHOOKS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.WEBHOOKS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.EVENTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.EVENTS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.EVENTS,
      v2: 'archive',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.DATA_EXPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.CREDIT_CONTROL,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.CREDIT_CONTROL,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.CREDIT_CONTROL,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.CREDIT_CONTROL,
      v2: 'write',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.GL,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.GL,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PAYMENTS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.SALES_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.SALES_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'sales',
      v1: SystemResource.CUSTOMERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'sales',
      v1: SystemResource.SALES_ORDERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'sales',
      v1: SystemResource.SALES_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'sales',
      v1: SystemResource.SALES_RETURNS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'sales',
      v1: SystemResource.SALES_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.SALES_ORDERS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.SALES_RETURNS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'handle',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.INVENTORY,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'warehouse',
      v1: SystemResource.INVENTORY,
      v2: 'handle',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.SUPPLIERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'write',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'procurement',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'invoice',
      v3: 'allow',
    },

    { ptype: 'g', v0: 'admin', v1: 'viewer' },
    { ptype: 'g', v0: 'finance', v1: 'viewer' },
    { ptype: 'g', v0: 'sales', v1: 'viewer' },
    { ptype: 'g', v0: 'warehouse', v1: 'viewer' },
    { ptype: 'g', v0: 'procurement', v1: 'viewer' },
    { ptype: 'g', v0: 'agent', v1: 'viewer' },
    { ptype: 'g', v0: 'webhook', v1: 'viewer' },

    // Agent read-only access globally
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.CUSTOMERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.PRODUCTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.INVENTORY,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SALES_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SALES_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SALES_CREDIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.PURCHASE_ORDERS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.PURCHASE_RETURNS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SUPPLIERS,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.GOODS_RECEIVED,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.DASHBOARD,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SETTINGS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.REPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.BUSINESS_REPORT,
      v2: 'read',
      v3: 'allow',
    },

    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.PAYMENTS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.SYSTEM_LOGS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.IMPORT,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.API_KEYS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.WEBHOOKS,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.ROLES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'agent',
      v1: SystemResource.USERS,
      v2: 'read',
      v3: 'allow',
    },
    { ptype: 'p', v0: 'agent', v1: SystemResource.GL, v2: 'read', v3: 'allow' },
  ];

  policies.push(
    // sales-credit-notes: viewer=read, admin=read+invoice, finance=read+invoice
    // Creating/posting credit notes is a financial action (GL reversal) → invoice only
    {
      ptype: 'p',
      v0: 'viewer',
      v1: SystemResource.SALES_CREDIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'admin',
      v1: SystemResource.SALES_CREDIT_NOTES,
      v2: 'invoice',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.SALES_CREDIT_NOTES,
      v2: 'invoice',
      v3: 'allow',
    },
    // purchase-debit-notes: finance read+write
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'read',
      v3: 'allow',
    },
    {
      ptype: 'p',
      v0: 'finance',
      v1: SystemResource.PURCHASE_DEBIT_NOTES,
      v2: 'write',
      v3: 'allow',
    },
  );
  const toInsert = policies.filter(
    (p: {
      ptype?: string;
      v0?: string | null;
      v1?: string | null;
      v2?: string | null;
      v3?: string | null;
      v4?: string | null;
      v5?: string | null;
    }) => {
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
    },
  );

  if (toInsert.length > 0) {
    await db.insert(casbinRule).values(toInsert);
    console.log(`  Seeded ${toInsert.length} new Casbin policies`);
  } else {
    console.log('  All standard Casbin policies already seeded.');
  }
}

async function seedUsers(db: SeedDB, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed user: admin');
    return;
  }

  let adminPass = process.env.ADMIN_PASSWORD || process.env.DEV_ADMIN_PASSWORD;
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
      role: 'admin',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { passwordHash: hash, role: 'admin', isActive: true },
    });

  console.log('  Seeded users: admin');

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

async function seedProducts(db: SeedDB, dryRun: boolean) {
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
      productId: '00000000-0000-4000-8000-000000000000',
      productNumber: 'SYSTEM-CUSTOM-LINE',
      name: 'Custom Line Product',
      productType: 'non-stock',
      baseUom: 'EA',
    })
    .onConflictDoUpdate({
      target: products.productId,
      set: {
        productNumber: 'SYSTEM-CUSTOM-LINE',
        name: 'Custom Line Product',
        productType: 'non-stock',
        baseUom: 'EA',
      },
    });

  console.log("  Seeded UOM 'EA' and SYSTEM-CUSTOM-LINE product");
}

async function seedFinancialDimensions(db: SeedDB, dryRun: boolean) {
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

  await db.update(glSettings).set({
    defaultCostCenterId: ccId,
    defaultActivityId: actId,
  });
}

async function seedOrganization(db: SeedDB, dryRun: boolean) {
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
      organizationId: '00000000-0000-4000-8000-000000000000',
      name: 'My Company',
    })
    .onConflictDoUpdate({
      target: organization.organizationId,
      set: { name: 'My Company' },
    });

  console.log('  Seeded default organization (fallback)');
}

async function seedAppSettings(db: SeedDB, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed default app_settings');
    return;
  }

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) {
    console.log('  SKIP: app_settings record already exists.');
    return;
  }

  const now = new Date();
  const timeHex = now.getTime().toString(16).padStart(12, '0');
  const sid = `${crypto.randomUUID()}-${timeHex}`;

  await db
    .insert(appSettings)
    .values({
      inventoryValuationMethod: 'weighted_average',
      inventoryAccountingMode: 'perpetual',
      creditLimitBehavior: 'soft',
      setupCompletedAt: now,
      systemIdentifier: sid,
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

async function seedBaseGlSettings(db: SeedDB, dryRun: boolean) {
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
  db: SeedDB,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const insertRows: any[] = [];

  function walk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    nodes: any,
    parentCode: string | null,
    inheritedType: string | null,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
        currencyCode: prefix === 'us_standard' ? 'USD' : 'AUD', // testData
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

export async function seedTaxCategoriesAndTerms(
  db: SeedDB,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Seed settings schema is dynamic and unstructured
  settings: any,
  dryRun = false,
) {
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
      })
      .onConflictDoUpdate({
        target: taxCategories.code,
        set: {
          title: cat.title,
          type: type,
          rate: cat.rate.toString(),
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
}

export async function seedCoaSettings(
  db: SeedDB,
  dryRun: boolean,
  prefix = 'au_standard',
) {
  const settings = loadCoaSettings(prefix);
  if (!settings) {
    console.log('  SKIP: No COA settings file found.');
    return;
  }

  await seedTaxCategoriesAndTerms(db, settings, dryRun);

  const defaultTaxCatId = uuidv5('GST_CAT_GST', NAMESPACE_COA);
  const defaultTermId = uuidv5('TERM_NET30', NAMESPACE_COA);
  await db.update(appSettings).set({
    defaultSalesTaxCategoryId: defaultTaxCatId,
    defaultPurchaseTaxCategoryId: defaultTaxCatId,
    defaultCustomerTermsId: defaultTermId,
    defaultSupplierTermsId: defaultTermId,
  });

  console.log('  Seeded COA defaults to app_settings');

  const baseCurrency = settings.base_currency || 'AUD';
  const fiscalMonth = settings.fiscal_year_start_month || 7;
  const defaults = settings.defaults || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
    { json: 'inventory_account_code', col: 'defaultInventoryAccountId' },
    { json: 'grni_account_code', col: 'defaultGrniAccountId' },
    { json: 'shrinkage_account_code', col: 'defaultShrinkageAccountId' },
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

async function seedReports(db: SeedDB, dryRun: boolean) {
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
      throw new Error(`Template file not found: ${p}`);
    }
    return fs.readFileSync(p, 'utf-8');
  }

  let seededCount = 0;
  let hookCount = 0;

  for (const r of reportList) {
    const templateContent = readTemplate(r.filename);
    if (!templateContent) continue;

    const [upsertedTemplate] = await db
      .insert(pdfTemplates)
      .values({
        id: r.id,
        slug: r.slug,
        name: r.name,
        template: templateContent,
        outputNamePattern: r.output_name_pattern,
      })
      .onConflictDoUpdate({
        target: pdfTemplates.slug,
        set: {
          name: r.name,
          slug: r.slug,
          outputNamePattern: r.output_name_pattern,
        },
      })
      .returning({ id: pdfTemplates.id });
    seededCount++;

    if (r.hook) {
      const ctx = r.context || 'default';
      await db
        .insert(pdfTemplateHooks)
        .values({
          hookSlug: r.hook,
          reportId: upsertedTemplate.id,
          contextSlug: ctx,
        })
        .onConflictDoUpdate({
          target: pdfTemplateHooks.hookSlug,
          set: { reportId: upsertedTemplate.id, contextSlug: ctx },
        });
      hookCount++;
    }

    if (r.context) {
      await db
        .insert(pdfTemplateContexts)
        .values({
          templateId: upsertedTemplate.id,
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
    database: process.env.POSTGRES_DB || 'herobm',
  });

  const db = drizzle(pool, { schema });

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

export async function seedAccounts(db: SeedDB, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed default customer and vendor');
    return;
  }

  // Seed customer
  await db
    .insert(customers)
    .values({
      customerId: '20000000-0000-4000-8000-000000000001',
      customerNumber: 'CUST-E2E-001',
      name: 'E2E Default Customer',
      currencyCode: 'AUD', // testData
      billingAddressCountry: 'AU',
    })
    .onConflictDoUpdate({
      target: customers.customerId,
      set: { name: 'E2E Default Customer', billingAddressCountry: 'AU' },
    });

  // Seed vendor
  await db
    .insert(suppliers)
    .values({
      vendorId: '20000000-0000-4000-8000-000000000002',
      vendorNumber: 'VEND-E2E-001',
      name: 'E2E Default Vendor',
      currencyCode: 'AUD', // testData
      address1Country: 'AU',
    })
    .onConflictDoUpdate({
      target: suppliers.vendorId,
      set: { name: 'Seed Vendor', address1Country: 'AU' },
    });

  console.log('  Seeded default customer and vendor');
}
