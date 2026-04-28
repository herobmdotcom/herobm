/**
 * Global currency configuration and utilities.
 * Shared between API, Background Workers, and Frontend.
 */

// ----- Display preference -----
// Set to 'symbol' to display €, $, etc. or 'code' to display EUR, USD, etc.
// In the shared package, we default to 'symbol' but components can override.
export const CURRENCY_DISPLAY: 'symbol' | 'code' = 'symbol';

// ----- Revenue routing precedence -----
export type RevenueRoutingStrategy = 'product_first' | 'customer_first';
export const REVENUE_ROUTING_PRECEDENCE: RevenueRoutingStrategy = 'product_first';

// ----- Expense routing precedence -----
export type ExpenseRoutingStrategy = 'product_first' | 'supplier_first';
export const EXPENSE_ROUTING_PRECEDENCE: ExpenseRoutingStrategy = 'product_first';

// ----- Currency definitions -----
export interface CurrencyDef {
  code: string;       // ISO 4217
  symbol: string;     // e.g. €, $, ¥
  name: string;       // e.g. Euro, US Dollar
  decimals: number;   // decimal places (2 for most, 0 for JPY/KRW, etc.)
  abmCode: number;    // ABM phone-prefix country code
}

/**
 * Complete mapping of ABM phone-prefix country codes to ISO 4217 currencies.
 * Source: ABM Currencies table.
 */
export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', symbol: '€',   name: 'Euro',              decimals: 2, abmCode: 0   },
  { code: 'USD', symbol: '$',   name: 'US Dollar',         decimals: 2, abmCode: 1   },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',   decimals: 2, abmCode: 11  },
  { code: 'GBP', symbol: '£',   name: 'British Pound',     decimals: 2, abmCode: 44  },
  { code: 'DKK', symbol: 'kr',  name: 'Danish Krone',      decimals: 2, abmCode: 45  },
  { code: 'SEK', symbol: 'kr',  name: 'Swedish Krona',     decimals: 2, abmCode: 46  },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit', decimals: 2, abmCode: 60  },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar', decimals: 2, abmCode: 61  },
  { code: 'IDR', symbol: 'Rp',  name: 'Indonesian Rupiah', decimals: 0, abmCode: 62  },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar',decimals: 2, abmCode: 64  },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',  decimals: 2, abmCode: 65  },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',      decimals: 0, abmCode: 81  },
  { code: 'KRW', symbol: '₩',   name: 'South Korean Won',  decimals: 0, abmCode: 82  },
  { code: 'LKR', symbol: 'Rs',  name: 'Sri Lankan Rupee',  decimals: 2, abmCode: 94  },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand',decimals: 2, abmCode: 271 },
  { code: 'SAR', symbol: 'SR',  name: 'Saudi Riyal',       decimals: 2, abmCode: 966 },
];

/** Lookup by ISO code */
const BY_CODE = new Map<string, CurrencyDef>(CURRENCIES.map((c) => [c.code, c]));

/** Lookup by ABM phone-prefix code */
const BY_ABM = new Map<number, CurrencyDef>(CURRENCIES.map((c) => [c.abmCode, c]));

/** 
 * Default fallback currency if nothing is provided or found.
 * Used internally to prevent crashes, but UI should always provide explicit currencies.
 */
const FALLBACK_CURRENCY = BY_CODE.get('EUR')!;

/**
 * Get a CurrencyDef by ISO code. Returns FALLBACK_CURRENCY if not found.
 */
export function getCurrency(code: string): CurrencyDef {
  return BY_CODE.get(code) ?? FALLBACK_CURRENCY;
}

/**
 * Get a CurrencyDef by ABM phone-prefix. Returns FALLBACK_CURRENCY if not found.
 */
export function getCurrencyByAbmCode(abmCode: number): CurrencyDef {
  return BY_ABM.get(abmCode) ?? FALLBACK_CURRENCY;
}

/**
 * Format an amount with the appropriate currency prefix.
 *
 * @example
 *   formatAmount(475.00, 'EUR')  → "€475.00"
 */
export function formatAmount(
  amount: number, 
  currencyCode: string,
  display: 'symbol' | 'code' = CURRENCY_DISPLAY
): string {
  const def = getCurrency(currencyCode);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: def.decimals,
    maximumFractionDigits: def.decimals,
  });

  if (display === 'symbol') {
    return `${def.symbol}${formatted}`;
  }
  return `${def.code} ${formatted}`;
}

/**
 * Custom error thrown when a currency conversion is requested
 * but the required exchange rate is not provided.
 */
export class MissingExchangeRateError extends Error {
  constructor(public readonly currencyCode: string) {
    super(`Missing exchange rate for currency: ${currencyCode}`);
    this.name = 'MissingExchangeRateError';
  }
}

/**
 * Convert an amount from one currency to another using provided rates.
 * 
 * Rates must be provided as a map where the key is the currency code 
 * and the value is the rate relative to the HOME_CURRENCY (which is 1.0).
 * 
 * @example
 *   const rates = new Map([['USD', 1.08], ['GBP', 0.85]]);
 *   convertAmount(100, 'EUR', 'USD', rates) // → 108.00
 */
export function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  baseCurrencyCode: string,
  rates: Map<string, number | string>
): number {
  if (fromCode === toCode) return amount;

  const getRate = (code: string): number => {
    if (code === baseCurrencyCode) return 1.0;
    const rate = rates.get(code);
    if (rate === undefined || rate === null) {
      throw new MissingExchangeRateError(code);
    }
    const num = typeof rate === 'string' ? parseFloat(rate) : rate;
    if (isNaN(num)) throw new MissingExchangeRateError(code);
    return num;
  };

  const fromRate = getRate(fromCode);
  const toRate = getRate(toCode);

  // Conversion logic: amount in HOME = amount / fromRate
  // amount in TARGET = (amount in HOME) * toRate
  const raw = (amount / fromRate) * toRate;
  
  // Round to appropriate decimals for the target currency
  const def = getCurrency(toCode);
  return Number(Math.round(Number(raw + `e${def.decimals}`)) + `e-${def.decimals}`);
}
