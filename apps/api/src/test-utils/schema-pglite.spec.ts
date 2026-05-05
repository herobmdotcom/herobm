import { setupPgliteSuite } from './pglite-suite';

describe('Schema PGLite Test', () => {
  const pg = setupPgliteSuite();

  it('should run a query on a seeded table', async () => {
    const result = await pg.client.query(
      'SELECT count(*) as count FROM modbm_core.tax_categories',
    );
    console.log('Tax categories count:', result.rows[0].count);
    expect(Number(result.rows[0].count)).toBeGreaterThan(0);
  });

  it('should run many queries on a seeded table', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await pg.client.query(
        'SELECT count(*) as count FROM modbm_core.tax_categories',
      );
      expect(Number(result.rows[0].count)).toBeGreaterThan(0);
    }
  });
});
