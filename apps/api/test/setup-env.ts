/**
 * E2E test setup — loads .env from the project root so that the auth service
 * and drizzle module can read POSTGRES_*, DEV_ADMIN_PASSWORD etc.
 */
export {};
import * as path from 'path';
import * as fs from 'fs';

const rootDir = path.resolve(__dirname, '..', '..', '..');

let envFileName = '.env';
const profilePath = path.join(rootDir, '.active_profile');
if (fs.existsSync(profilePath)) {
  const profileName = fs.readFileSync(profilePath, 'utf-8').trim();
  if (profileName) {
    envFileName = `.env.${profileName}`;
  }
}

const envPath = path.join(rootDir, envFileName);
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

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-value-for-e2e';
}
if (!process.env.SETUP_TOKEN) {
  process.env.SETUP_TOKEN = 'test-setup-token';
}

