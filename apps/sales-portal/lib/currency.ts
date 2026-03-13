/**
 * Currency configuration for the Sales Portal.
 *
 * Provides the complete ABM phone-prefix → ISO 4217 mapping, currency symbols,
 * and a global display preference (symbol vs code).
 */

// ----- Display preference -----
// Set to 'symbol' to display €, $, etc. or 'code' to display EUR, USD, etc.
export const CURRENCY_DISPLAY: 'symbol' | 'code' = 'symbol';

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
 * Source: ABM Currencies table (screenshot reference).
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

/** Home / base currency */
export const HOME_CURRENCY = BY_CODE.get('EUR')!;

/**
 * Get a CurrencyDef by ISO code. Returns HOME_CURRENCY if not found.
 */
export function getCurrency(code: string): CurrencyDef {
  return BY_CODE.get(code) ?? HOME_CURRENCY;
}

/**
 * Get a CurrencyDef by ABM phone-prefix. Returns HOME_CURRENCY if not found.
 */
export function getCurrencyByAbmCode(abmCode: number): CurrencyDef {
  return BY_ABM.get(abmCode) ?? HOME_CURRENCY;
}

/**
 * Format an amount with the appropriate currency prefix.
 * Uses CURRENCY_DISPLAY to decide between symbol (€) and code (EUR).
 *
 * @example
 *   formatAmount(475.00, 'EUR')  → "€475.00"  (symbol mode)
 *   formatAmount(475.00, 'EUR')  → "EUR 475.00" (code mode)
 */
export function formatAmount(amount: number, currencyCode: string = 'EUR'): string {
  const def = getCurrency(currencyCode);
  const formatted = amount.toFixed(def.decimals);

  if (CURRENCY_DISPLAY === 'symbol') {
    return `${def.symbol}${formatted}`;
  }
  return `${def.code} ${formatted}`;
}
