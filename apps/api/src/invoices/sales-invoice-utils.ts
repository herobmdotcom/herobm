import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesInvoices } from '@herobm/db-schema';
import { sql } from 'drizzle-orm';

/**
 * Generates a structural sequence number for the AR invoice natively in HeroBM.
 */
export async function generateInvoiceNumber(db: DrizzleDB): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${today}-`;

  const result = await db
    .select({ invoiceNumber: salesInvoices.invoiceNumber })
    .from(salesInvoices)
    .where(sql`${salesInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
    .orderBy(sql`${salesInvoices.invoiceNumber} DESC`)
    .limit(1);

  const seq =
    result.length > 0
      ? parseInt(result[0].invoiceNumber.replace(prefix, ''), 10) + 1
      : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}
