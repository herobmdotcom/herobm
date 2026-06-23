import { eq, and, lte, desc } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { exchangeRates, glSettings } from '../drizzle/herobm-core-schema';

export async function getExchangeRateForCurrency(
  db: DrizzleDB,
  currencyCode: string,
  date: Date = new Date(),
): Promise<{ rate: number; baseCurrency: string }> {
  // 1. Get Base Currency
  const settings = await db.select().from(glSettings).limit(1);
  const baseCurrency = settings[0]?.baseCurrency || 'AUD';

  if (currencyCode === baseCurrency) {
    return { rate: 1.0, baseCurrency };
  }

  // 2. Get From Rate
  const fromRateRows = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currencyCode, currencyCode),
        lte(exchangeRates.effectiveDate, date),
      ),
    )
    .orderBy(desc(exchangeRates.effectiveDate))
    .limit(1);

  if (fromRateRows.length === 0) {
    throw new Error(
      `No exchange rate found for currency '${currencyCode}' on or before ${date.toISOString()}`,
    );
  }

  // 3. Get Base Rate
  const baseRateRows = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currencyCode, baseCurrency),
        lte(exchangeRates.effectiveDate, date),
      ),
    )
    .orderBy(desc(exchangeRates.effectiveDate))
    .limit(1);

  if (baseRateRows.length === 0) {
    throw new Error(
      `No exchange rate found for base currency '${baseCurrency}' on or before ${date.toISOString()}`,
    );
  }

  // Both rates are units per 1 EUR.
  // 1 unit of fromCurrency = 1 / fromRateRows[0].buyRate EUR
  // Thus, fromCurrency in baseCurrency = baseRateRows[0].buyRate / fromRateRows[0].buyRate
  const rate =
    parseFloat(baseRateRows[0].buyRate) / parseFloat(fromRateRows[0].buyRate);
  return { rate, baseCurrency };
}
