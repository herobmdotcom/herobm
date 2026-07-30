import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { eq, inArray } from 'drizzle-orm';
import {
  pdfTemplates,
  pdfTemplateHooks,
  pdfTemplateContexts,
} from '@herobm/db-schema';
import type { SeedDB } from '../run';

interface SeedData {
  slug: string;
  name: string;
  contexts?: string[];
  description: string;
  outputPattern: string;
  templatePath?: string;
  templateString?: string;
}

const SEEDS: SeedData[] = [
  {
    slug: 'sales-invoice',
    name: 'Standard Sales Invoice',
    contexts: ['sales-invoice'],
    description:
      'System default template for generating Sales Invoices and rendering AR Ledger entries.',
    templatePath: '../../../../tools/seeds/reports/sales-invoice.typ',
    outputPattern: 'Invoice-${orderNumber}.pdf',
  },
  {
    slug: 'sales-order-quote',
    name: 'Standard Sales Quote',
    contexts: ['sales-order'],
    description: 'System default template for generating Sales Quotes.',
    templatePath: '../../../../tools/seeds/reports/sales-quote.typ',
    outputPattern: 'Quote-${orderNumber}.pdf',
  },
  {
    slug: 'sales-order-confirmation',
    name: 'Standard Order Confirmation',
    contexts: ['sales-order'],
    description:
      'System default template for generating Sales Order Confirmations.',
    templatePath:
      '../../../../tools/seeds/reports/sales-order-confirmation.typ',
    outputPattern: 'Confirmation-${orderNumber}.pdf',
  },
  {
    slug: 'pro-forma-invoice',
    name: 'Standard Pro Forma Invoice',
    contexts: ['sales-order'],
    description:
      'System default template for generating Pro Forma Invoices for confirmed orders.',
    templatePath: '../../../../tools/seeds/reports/pro-forma-invoice.typ',
    outputPattern: 'ProForma-${orderNumber}.pdf',
  },
  {
    slug: 'sales-return',
    name: 'Standard Return Credit Note',
    contexts: ['sales-return'],
    description:
      'System default template for generating Credit Notes for returned customer goods.',
    templatePath: '../../../../tools/seeds/reports/sales-credit.typ',
    outputPattern: 'Credit-${returnNumber}.pdf',
  },
  {
    slug: 'return-slip',
    name: 'Standard Return Slip',
    contexts: ['sales-return'],
    description:
      'System default template for generating Return Slips for customers.',
    templatePath: '../../../../tools/seeds/reports/return-slip.typ',
    outputPattern: 'Return-Slip-${returnMeta.returnNumber}.pdf',
  },
  {
    slug: 'shipping-docket',
    name: 'Standard Shipping Docket',
    contexts: ['shipment'],
    description:
      'System default template for generating Shipping Dockets that accompany dispatched goods.',
    templatePath: '../../../../tools/seeds/reports/shipping-docket.typ',
    outputPattern: 'Docket-${shipmentNumber}.pdf',
  },
  {
    slug: 'sales-return-credit',
    name: 'Standard Sales Credit',
    contexts: ['sales-return'],
    description:
      'System default template for generating Sales Credit Notes against returns.',
    templatePath: '../../../../tools/seeds/reports/sales-credit.typ',
    outputPattern: 'Credit-${returnMeta.returnNumber}.pdf',
  },
  {
    slug: 'picking-slip',
    name: 'Standard Picking Slip',
    contexts: ['picking-slip'],
    description:
      'System default template for generating warehouse Picking Slips and Back-order reports.',
    templatePath: '../../../../tools/seeds/reports/picking-slip.typ',
    outputPattern: 'Picking-Slip-${orderNumber}.pdf',
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

export async function seedDynamicReports(db: SeedDB, dryRun = false) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed dynamic reports');
    return;
  }
  try {
    console.log('Seeding Dynamic Reports...');

    for (const seedData of SEEDS) {
      // 1. Read the Typst file
      let typstContent = '';
      if (seedData.templateString) {
        typstContent = seedData.templateString;
      } else if (seedData.templatePath) {
        const absolutePath = join(__dirname, seedData.templatePath);
        try {
          typstContent = readFileSync(absolutePath, 'utf8');
        } catch (e) {
          throw new Error(
            `Failed to read template for ${seedData.slug} at ${absolutePath}`,
          );
        }
      }

      // 2. Remove any existing reports with the same slug
      const existing = await db
        .select({ id: pdfTemplates.id })
        .from(pdfTemplates)
        .where(eq(pdfTemplates.slug, seedData.slug));

      if (existing.length > 0) {
        console.log(`Removing existing ${seedData.slug} reports...`);
        const ids = existing.map((e) => e.id);
        await db
          .delete(pdfTemplateHooks)
          .where(inArray(pdfTemplateHooks.reportId, ids));
        await db
          .delete(pdfTemplateContexts)
          .where(inArray(pdfTemplateContexts.templateId, ids));
        await db.delete(pdfTemplates).where(inArray(pdfTemplates.id, ids));
      }
      // 3. Insert the new Template
      const newTemplateId = uuidv4();
      await db.insert(pdfTemplates).values({
        id: newTemplateId,
        slug: seedData.slug,
        name: seedData.name,
        description: seedData.description,
        template: typstContent,
        outputNamePattern: seedData.outputPattern,
      });
      console.log(`✅ Created Template: ${seedData.name}`);

      // 5. Seed report contexts
      if (seedData.contexts && Array.isArray(seedData.contexts)) {
        for (const ctx of seedData.contexts) {
          await db
            .insert(pdfTemplateContexts)
            .values({
              templateId: newTemplateId,
              context: ctx,
            })
            .onConflictDoNothing();

          await db.insert(pdfTemplateHooks).values({
            hookSlug: seedData.slug,
            reportId: newTemplateId,
            contextSlug: ctx,
          });
        }
      }
    }

    console.log('  Dynamic reports seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding dynamic reports:', error);
    throw error;
  }
}
