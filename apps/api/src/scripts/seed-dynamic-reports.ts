import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { eq, inArray } from 'drizzle-orm';
import { reports, reportHookAssignments } from '../drizzle/modbm-core-schema';

process.loadEnvFile(resolve(__dirname, '../../../../.env'));

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
    description:
      'System default template for generating Sales Invoices and rendering AR Ledger entries.',
    templatePath: '../reports/templates/orders/sales-invoice.typ',
    outputPattern: 'Invoice-{{orderNumber}}.pdf',
  },
  {
    slug: 'picking-slip',
    name: 'Standard Picking Slip',
    description:
      'System default template for generating warehouse Picking Slips and Back-order reports.',
    templatePath: '../reports/templates/orders/picking-slip.typ',
    outputPattern: 'Picking-Slip-{{orderNumber}}.pdf',
  },
];

async function seed() {
  console.log('Seeding Dynamic Reports...');

  try {
    for (const seedData of SEEDS) {
      // 1. Read the Typst file
      const absolutePath = join(__dirname, seedData.templatePath);
      const typstContent = readFileSync(absolutePath, 'utf8');

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
        })
        .onConflictDoUpdate({
          target: reportHookAssignments.hookSlug,
          set: { reportId: newReportId, updatedAt: new Date() },
        });
      console.log(`✅ Assigned Hook: ${seedData.slug} -> ${seedData.name}`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding reports:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

void seed();
