import { fetchBalanceSheet } from './src/gl/gl-financial-statements.utils';
import { getDrizzle } from './src/drizzle/drizzle.provider';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.hfp') });

async function main() {
  const db = getDrizzle();
  const bs = await fetchBalanceSheet(db as any, { asOfDate: '2026-10-11' });
  console.log(JSON.stringify({
    totalAssets: bs.validation.totalAssets,
    totalLiabilities: bs.validation.totalLiabilities,
    totalEquity: bs.validation.totalEquity,
    totalLiabilitiesAndEquity: bs.validation.totalLiabilitiesAndEquity,
    drift: bs.validation.drift,
    isBalanced: bs.validation.isBalanced,
    equityTotal: bs.equity.total,
    equityLines: bs.equity.lines
  }, null, 2));
  process.exit(0);
}

main().catch(console.error);
