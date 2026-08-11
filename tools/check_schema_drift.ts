import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log("🛡️ Checking for un-migrated schema changes...");

const migrationsDir = path.join(process.cwd(), 'apps/api/migrations');
const metaDir = path.join(migrationsDir, 'meta');
const metaBackupDir = path.join(migrationsDir, '_meta_backup');

let hasDrift = false;

try {
  // Backup meta directory
  if (fs.existsSync(metaBackupDir)) {
    fs.rmSync(metaBackupDir, { recursive: true, force: true });
  }
  if (fs.existsSync(metaDir)) {
    fs.cpSync(metaDir, metaBackupDir, { recursive: true });
  }

  // Run generate
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['drizzle-kit', 'generate', '--name', 'drift_check_temp'], {
    cwd: 'apps/api',
    encoding: 'utf-8',
    shell: true,
  });

  const output = (result.stdout || '') + (result.stderr || '');

  if (output.includes('Interactive prompts require a TTY terminal') || result.status !== 0 || !output.includes('No schema changes')) {
    hasDrift = true;
  }

  const files = fs.readdirSync(migrationsDir);
  for (const file of files) {
    if (file.includes('drift_check_temp')) {
      hasDrift = true;
      fs.unlinkSync(path.join(migrationsDir, file));
    }
  }
} finally {
  // Restore meta directory safely
  if (fs.existsSync(metaBackupDir)) {
    fs.rmSync(metaDir, { recursive: true, force: true });
    fs.renameSync(metaBackupDir, metaDir);
  }
}

if (hasDrift) {
  console.error("❌ Error: Uncommitted schema changes detected!");
  console.error("You must run 'make dev-db-generate NAME=your_migration_name' to capture these changes before migrating.");
  process.exit(1);
} else {
  console.log("✅ Schema matches snapshots.");
  process.exit(0);
}

