import { isSupportedCountry, type Country } from 'react-phone-number-input';
import { getCountryCode } from '@herobm/shared';

/**
 * Normalizes input string to an international phone format with a leading '+'
 * if numbers are present and no leading '+' exists.
 */
export const parseInitialPhone = (val: string | null | undefined): string => {
  if (!val) return '';
  if (val.startsWith('+')) return val;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0) return '+' + digits;
  return '';
};

/**
 * Normalizes a country name or code (e.g. 'USA', 'United States', 'AU', 'au')
 * and verifies that it is supported by react-phone-number-input.
 * Returns a valid Country (ISO 3166-1 alpha-2) or undefined.
 */
export const toSupportedCountry = (country?: string | null): Country | undefined => {
  if (!country) return undefined;
  const code = getCountryCode(country);
  if (code && isSupportedCountry(code)) {
    return code as Country;
  }
  return undefined;
};
