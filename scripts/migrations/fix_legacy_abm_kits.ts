import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load .env from cwd
dotenv.config();

async function run() {
  const user = process.env.POSTGRES_USER || 'postgres';
  const pass = process.env.POSTGRES_PASSWORD || '';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'herobm';
  
  const connectionString = `postgres://${user}:${pass}@${host}:${port}/${db}`;

  const client = new Client({ connectionString });
  await client.connect();

  console.log('Finding non-stock kits that have physical inventory...');

  try {
    const result = await client.query(`
      WITH kit_inventory AS (
          SELECT 
              il.product_id,
              SUM(il.quantity_on_hand) as total_qty
          FROM herobm_core.inventory_levels il
          JOIN herobm_core.products p ON p.product_id = il.product_id
          WHERE p.product_type = 'non-stock' 
            AND p.structure_type = 'kit'
          GROUP BY il.product_id
          HAVING SUM(il.quantity_on_hand) > 0
      )
      UPDATE herobm_core.products p
      SET product_type = 'inventory'
      FROM kit_inventory k
      WHERE p.product_id = k.product_id
      RETURNING p.product_id, p.product_number, k.total_qty;
    `);

    console.log(`Successfully converted ${result.rowCount} legacy non-stock kits to 'inventory' type.`);
    result.rows.forEach((row: any) => {
      console.log(`- Product ${row.product_number} (Qty: ${row.total_qty})`);
    });

  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

run();
