import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

describe('Simple PGLite Test', () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
  });

  afterAll(async () => {
    await client.close();
  });

  it('should run a simple query', async () => {
    const db = drizzle(client);
    const result = await client.query('SELECT 1 as val');
    expect(result.rows[0].val).toBe(1);
  });

  it('should run many simple queries', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await client.query('SELECT 1 as val');
      expect(result.rows[0].val).toBe(1);
    }
  });
});
