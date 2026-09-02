import { spawnSync } from 'child_process';

const name = process.argv[2];

if (!name) {
  console.error("❌ Error: Migration name is required.");
  console.error("Usage: npx tsx tools/generate_migration.ts <migration_name>");
  process.exit(1);
}

const run = (cmd: string) => {
  console.log(`\n> ${cmd}`);
  const result = spawnSync(cmd, { stdio: 'inherit', shell: true, cwd: 'apps/api' });
  if (result.error || result.status !== 0) {
    console.error(`\n❌ Command failed: ${cmd}`);
    process.exit(1);
  }
};

console.log("🛡️ Running pre-generation Drizzle check...");
run('npx drizzle-kit check');

console.log(`\n🏗️ Generating migration: ${name}...`);
run(`npx drizzle-kit generate --name ${name}`);

console.log("\n🛡️ Running post-generation Drizzle check...");
run('npx drizzle-kit check');

console.log("\n✅ Safe migration generation complete!");
