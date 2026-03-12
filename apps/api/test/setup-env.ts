/**
 * E2E test setup — loads .env from the project root so that the auth service
 * and drizzle module can read POSTGRES_*, DEV_ADMIN_PASSWORD etc.
 */
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
