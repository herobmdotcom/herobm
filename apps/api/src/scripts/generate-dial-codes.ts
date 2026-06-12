import fs from 'fs';
import path from 'path';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const seedDir = path.resolve(
  __dirname,
  '../../../../../pipelines/abm_transform/seeds',
);
if (!fs.existsSync(seedDir)) {
  fs.mkdirSync(seedDir, { recursive: true });
}

const csvPath = path.join(seedDir, 'country_dial_codes.csv');

const rows = ['country_code,dial_code'];

const countries = getCountries();
for (const country of countries) {
  try {
    const code = getCountryCallingCode(country);
    rows.push(`${country},+${code}`);
  } catch (err) {
    // some codes might not have mappings, ignore
  }
}

fs.writeFileSync(csvPath, rows.join('\n'));
console.log(`Wrote ${rows.length - 1} country dial codes to ${csvPath}`);
