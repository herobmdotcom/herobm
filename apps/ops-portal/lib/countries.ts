import * as countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

export const COUNTRIES = Object.entries(countries.getNames('en')).map(([code, name]) => ({
  code,
  name: name as string,
})).sort((a, b) => a.name.localeCompare(b.name));
