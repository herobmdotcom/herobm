import * as path from 'path';
import * as fs from 'fs';

const rootDir = path.resolve(__dirname, 'test', '..', '..', '..');
const envPath = path.join(rootDir, '.env');
const content = fs.readFileSync(envPath, 'utf-8');
for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.includes('DEV_ADMIN_PASSWORD')) {
    console.log('FOUND LINE:', trimmed);
    const eqIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    console.log('KEY:', key, 'VALUE:', value);
  }
}
