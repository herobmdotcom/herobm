import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { eq, inArray } from 'drizzle-orm';
import {
  reports,
  reportHookAssignments,
  reportContexts,
} from '../drizzle/modbm-core-schema';

const profile = process.env.PROFILE;
const envFile = profile ? `.env.${profile}` : '.env';
process.loadEnvFile(resolve(__dirname, `../../../../${envFile}`));

const dbUrl = process.env.DATABASE_URL;
const queryClient = dbUrl
  ? postgres(dbUrl)
  : postgres({
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB ?? 'custom_app',
    });
const db = drizzle(queryClient);

const SEEDS = [
  {
    slug: 'sales-invoice',
    name: 'Standard Sales Invoice',
    contexts: ['sales-invoice'],
    description:
      'System default template for generating Sales Invoices and rendering AR Ledger entries.',
    templatePath: '../../../../tools/seeds/reports/sales-invoice.typ',
    outputPattern: 'Invoice-{{orderNumber}}.pdf',
  },
  {
    slug: 'sales-order-quote',
    name: 'Standard Sales Quote',
    contexts: ['sales-order'],
    description: 'System default template for generating Sales Quotes.',
    templatePath: '../../../../tools/seeds/reports/sales-quote.typ',
    outputPattern: 'Quote-{{orderNumber}}.pdf',
  },
  {
    slug: 'sales-order-confirmation',
    name: 'Standard Order Confirmation',
    contexts: ['sales-order'],
    description:
      'System default template for generating Sales Order Confirmations.',
    templatePath:
      '../../../../tools/seeds/reports/sales-order-confirmation.typ',
    outputPattern: 'Confirmation-{{orderNumber}}.pdf',
  },
  {
    slug: 'pro-forma-invoice',
    name: 'Standard Pro Forma Invoice',
    contexts: ['sales-order'],
    description:
      'System default template for generating Pro Forma Invoices for confirmed orders.',
    templatePath: '../../../../tools/seeds/reports/pro-forma-invoice.typ',
    outputPattern: 'ProForma-{{orderNumber}}.pdf',
  },
  {
    slug: 'sales-return',
    name: 'Standard Return Credit Note',
    contexts: ['sales-return'],
    description:
      'System default template for generating Credit Notes for returned customer goods.',
    templatePath: '../../../../tools/seeds/reports/sales-return-credit.typ',
    outputPattern: 'Credit-{{returnNumber}}.pdf',
  },
  {
    slug: 'shipping-docket',
    name: 'Standard Shipping Docket',
    contexts: ['shipment'],
    description:
      'System default template for generating Shipping Dockets that accompany dispatched goods.',
    templatePath: '../../../../tools/seeds/reports/shipping-docket.typ',
    outputPattern: 'Docket-{{shipmentNumber}}.pdf',
  },
  {
    slug: 'sales-return-credit',
    name: 'Standard Sales Credit',
    contexts: ['sales-return'],
    description:
      'System default template for generating Sales Credit Notes against returns.',
    templatePath: '../../../../tools/seeds/reports/sales-credit.typ',
    outputPattern: 'Credit-{{returnMeta.returnNumber}}.pdf',
  },
  {
    slug: 'picking-slip',
    name: 'Standard Picking Slip',
    contexts: ['picking-slip'],
    description:
      'System default template for generating warehouse Picking Slips and Back-order reports.',
    templatePath: '../../../../tools/seeds/reports/picking-slip.typ',
    outputPattern: 'Picking-Slip-{{orderNumber}}.pdf',
  },
  {
    slug: 'theme-external',
    name: 'External Reports Theme',
    contexts: ['theme'],
    description:
      'Standard global wrapper for external documents with Organization info in headers/footers.',
    templatePath: '../../../../tools/seeds/reports/theme-external.typ',
    outputPattern: 'Theme-External.pdf',
  },
  {
    slug: 'theme-internal',
    name: 'Internal Reports Theme',
    contexts: ['theme'],
    description:
      'Standard wrapper for internal business documents requiring a confidential or internal-only header.',
    templatePath: '../../../../tools/seeds/reports/theme-internal.typ',
    outputPattern: 'Theme-Internal.pdf',
  },
];

async function seed() {
  console.log('Seeding Dynamic Reports...');

  try {
    for (const seedData of SEEDS) {
      // 1. Read the Typst file
      let typstContent = '';
      if ('templateString' in seedData && (seedData as any).templateString) {
        typstContent = (seedData as any).templateString;
      } else if ('templatePath' in seedData && (seedData as any).templatePath) {
        const absolutePath = join(__dirname, (seedData as any).templatePath);
        try {
          typstContent = readFileSync(absolutePath, 'utf8');
        } catch (e) {
          console.warn('Missing template', absolutePath);
          typstContent = '';
        }
      }

      // 2. Remove any existing reports with the same slug
      const existing = await db
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.slug, seedData.slug));

      if (existing.length > 0) {
        console.log(`Removing existing ${seedData.slug} reports...`);
        await db.delete(reports).where(
          inArray(
            reports.id,
            existing.map((e) => e.id),
          ),
        );
      }

      // 3. Insert the new Report
      const newReportId = uuidv4();
      await db.insert(reports).values({
        id: newReportId,
        slug: seedData.slug,
        name: seedData.name,
        template: typstContent,
        outputNamePattern: seedData.outputPattern,
      });
      console.log(`✅ Created Report: ${seedData.name}`);

      // 4. Assign the hook
      await db
        .insert(reportHookAssignments)
        .values({
          reportId: newReportId,
          hookSlug: seedData.slug,
          contextSlug: (seedData as any).contexts?.[0] || 'sales-order',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: reportHookAssignments.hookSlug,
          set: {
            reportId: newReportId,
            contextSlug: (seedData as any).contexts?.[0] || 'sales-order',
            updatedAt: new Date(),
          },
        });
      console.log(
        `✅ Assigned Hook: ${seedData.slug} -> ${seedData.name} (${(seedData as any).contexts?.[0]})`,
      );

      // 5. Seed report contexts
      if (
        (seedData as any).contexts &&
        Array.isArray((seedData as any).contexts)
      ) {
        for (const ctx of (seedData as any).contexts) {
          await db
            .insert(reportContexts)
            .values({
              reportId: newReportId,
              context: ctx,
            })
            .onConflictDoNothing();
        }
      }
    }

    // cleanup legacy hooks
    console.log('Cleaning up legacy hooks...');
    await db
      .delete(reportHookAssignments)
      .where(inArray(reportHookAssignments.hookSlug, ['sales-quote']));

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding reports:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

void seed();
