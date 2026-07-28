import { eq, and, lte, desc } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { exchangeRates, glSettings } from '../drizzle/schema';

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
      `No exchange rate found for currency '${currencyCode}' on or before ${
        date instanceof Date ? date.toISOString() : date
      }`,
    );
  }

  // The buyRate in the database is the direct multiplier against the base currency.
  // Example: if base is AUD and currency is USD, the buyRate represents how many AUD per 1 USD.
  const rate = parseFloat(fromRateRows[0].buyRate);

  return { rate, baseCurrency };
}
