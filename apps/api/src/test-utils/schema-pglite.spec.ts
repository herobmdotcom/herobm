import { setupPgliteSuite } from './pglite-suite';

describe('Schema PGLite Test', () => {
  const pg = setupPgliteSuite();

  it('should run a query on a seeded table', async () => {
    const result = await pg.client.query(
      'SELECT count(*) as count FROM herobm_core.tax_categories',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log('Tax categories count:', (result.rows[0] as any).count);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Number((result.rows[0] as any).count)).toBeGreaterThan(0);
  });

  it('should run many queries on a seeded table', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await pg.client.query(
        'SELECT count(*) as count FROM herobm_core.tax_categories',
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(Number((result.rows[0] as any).count)).toBeGreaterThan(0);
    }
  });
});
