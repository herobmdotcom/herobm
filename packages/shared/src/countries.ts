import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register english locale
countries.registerLocale(enLocale);

export interface CountryDef {
  code: string; // ISO Alpha-2 code (e.g. 'US')
  name: string; // English display name
}

// Generate the standard COUNTRIES array sorted alphabetically
export const COUNTRIES: CountryDef[] = Object.entries(countries.getNames('en'))
  .map(([code, name]) => ({
    code,
    name
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Returns the ISO Alpha-2 country code for a given country name or code (e.g. 'United States', 'USA', 'US').
 * Uses i18n-iso-countries with English names.
 */
export function getCountryCode(nameOrCode?: string | null): string | undefined {
  if (!nameOrCode) return undefined;
  const trimmed = nameOrCode.trim();
  if (!trimmed) return undefined;
  const alpha2 = countries.toAlpha2(trimmed) || countries.getAlpha2Code(trimmed, 'en');
  if (alpha2 && countries.isValid(alpha2)) {
    return alpha2.toUpperCase();
  }
  return undefined;
}
