import { text, numeric, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { herobmCore, validCurrencyCheck } from './core.schema';

// ---------------------------------------------------------------------------
// exchange_rates  (Static currency exchange rates)
// ---------------------------------------------------------------------------
export const exchangeRates = herobmCore.table(
  'exchange_rates',
  {
    exchangeRateId: uuid('exchange_rate_id').primaryKey().defaultRandom(),
    currencyCode: text('currency_code').notNull(), // ISO 4217
    currencyName: text('currency_name').notNull(),
    buyRate: numeric('buy_rate').notNull(), // units of this currency per 1 EUR
    sellRate: numeric('sell_rate').notNull(), // units of this currency per 1 EUR
    effectiveDate: timestamp('effective_date').defaultNow(),
    updatedOn: timestamp('updated_on').defaultNow(),
  },
  (t) => ({
    currencyCheck: validCurrencyCheck('exchange_rates'),
    unq: unique('exchange_rates_currency_effective_date_unq').on(
      t.currencyCode,
      t.effectiveDate,
    ),
  }),
);
