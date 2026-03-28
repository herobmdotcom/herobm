require('dotenv').config({ path: '../../.env' });
const { spawnSync } = require('child_process');
const fs = require('fs');

// Ensure DATABASE_URL is unset, so Drizzle falls back to POSTGRES_* vars
delete process.env.DATABASE_URL;

const result = spawnSync('npm', ['run', 'test:e2e', '--', 'test/inventory-cycle.e2e-spec.ts'], { 
  env: { ...process.env, PATH: process.env.PATH },
  shell: true 
});

fs.writeFileSync('e2e-output.txt', result.stdout.toString() + '\n' + result.stderr.toString());
