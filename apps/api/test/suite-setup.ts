import postgres from 'postgres';

jest.setTimeout(120000);

beforeAll(async () => {
  if (process.env.USE_PGLITE === 'true') {
    return;
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-value-for-e2e';
  }
  if (!process.env.SETUP_TOKEN) {
    process.env.SETUP_TOKEN = 'test-setup-token';
  }

  const user = process.env.POSTGRES_USER || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'herobm_local';

  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${user}:${process.env.POSTGRES_PASSWORD}@${host}:${port}/${db}`;

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PASSWORD) {
    console.warn(
      'DATABASE_URL or POSTGRES_PASSWORD is not set. Setup may fail.',
    );
  }

  // Fresh test DB is provisioned by test/utils/provision-e2e-db.ts per test run
});
