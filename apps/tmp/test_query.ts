import { CustomerOverdueNoticeService } from '../api/src/pdf-templates/customer-overdue-notice.service';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export default async function (db: any, schema: any) {
  // Find customer with overdue invoices
  const overdueInvoice = await db.select().from(schema.salesInvoices).limit(1);
  const customerId = overdueInvoice.length > 0 ? overdueInvoice[0].customerId : null;

  if (!customerId) {
    console.log('No customer found.');
    return { success: false };
  }

  const noticeService = new CustomerOverdueNoticeService(db);

  console.log('1. Assembling data for customer overdue notice for customer:', customerId);
  const data = await noticeService.assembleData(customerId);
  console.log('Data assembled:', JSON.stringify(data, null, 2));

  console.log('2. Fetching org data...');
  const orgQuery = await db.select().from(schema.organization).limit(1);
  const orgData = orgQuery.length > 0 ? orgQuery[0] : {};
  const finalData = { ...data, _org: orgData };

  console.log('3. Loading template & theme...');
  const templatePath = join(process.cwd(), '../../tools/seeds/reports/customer-overdue-notice.typ');
  const themePath = join(process.cwd(), '../../tools/seeds/reports/theme-external.typ');

  const template = readFileSync(templatePath, 'utf8');
  const theme = readFileSync(themePath, 'utf8');

  const workDir = join(process.cwd(), 'tmp/reports');
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  const jobId = randomUUID();
  const typstFile = join(workDir, `${jobId}.typ`);
  const dataFile = join(workDir, `${jobId}.json`);
  const pdfFile = join(workDir, `${jobId}.pdf`);
  const themeFile = join(workDir, `theme-external.typ`);

  writeFileSync(dataFile, JSON.stringify(finalData));
  writeFileSync(typstFile, template);
  writeFileSync(themeFile, theme);

  console.log('4. Compiling Typst...');
  try {
    const res = await execAsync(
      `"typst" compile "${typstFile}" "${pdfFile}" --input data="${jobId}.json"`,
    );
    console.log('Typst compile success:', res);
  } catch (err: any) {
    console.error('Typst compile failed:', err);
    console.error('stderr:', err.stderr);
    console.error('stdout:', err.stdout);
  } finally {
    if (existsSync(typstFile)) unlinkSync(typstFile);
    if (existsSync(dataFile)) unlinkSync(dataFile);
    if (existsSync(pdfFile)) unlinkSync(pdfFile);
  }

  return { success: true };
}
