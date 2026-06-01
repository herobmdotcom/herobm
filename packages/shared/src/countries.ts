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
 * Returns the ISO Alpha-2 country code for a given country name.
 * Uses i18n-iso-countries with English names.
 */
export function getCountryCode(name: string): string | undefined {
  return countries.getAlpha2Code(name, 'en');
}
