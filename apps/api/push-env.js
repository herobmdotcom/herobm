require('dotenv').config({ path: '../../.env' });
const { execSync } = require('child_process');
const dbUrl = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
try {
  execSync(`npx drizzle-kit push`, { 
    env: { ...process.env, DATABASE_URL: dbUrl }, 
    stdio: 'inherit' 
  });
} catch (e) {
  process.exit(1);
}
