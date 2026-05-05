/**
 * fix-stale-backorders.ts
 *
 * One-time data fix: Transitions backorder records from 'awaiting_receipt' to
 * 'received_reserved' when the linked PO line has already been fully received.
 *
 * This gap existed because GoodsReceivedService did not previously synchronize
 * backorder states on receipt. The service has now been patched for future receipts.
 *
 * Usage (run from apps/api):
 *   npx tsx src/scripts/fix-stale-backorders.ts              # Dry run (default)
 *   npx tsx src/scripts/fix-stale-backorders.ts --apply       # Apply changes
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const DRY_RUN = !process.argv.includes('--apply');

const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'modbm_core',
    });

async function run() {
  console.log(`\n=== Fix Stale Backorders ===`);
  console.log(
    `Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to execute)' : 'APPLYING CHANGES'}\n`,
  );

  // Find backorders stuck in awaiting_receipt where the PO line is fully received
  const staleRows = await sqlClient`
    SELECT
      b.backorder_id,
      b.quantity AS bo_qty,
      pol.quantity AS po_line_qty,
      pol.quantity_received AS po_line_received,
      po.order_number AS po_num,
      po.state_code AS po_state,
      so.order_number AS so_num
    FROM modbm_core.backorders b
    JOIN modbm_core.purchase_order_lines pol
      ON b.purchase_order_line_id = pol.purchase_order_line_id
    JOIN modbm_core.purchase_orders po
      ON b.purchase_order_id = po.purchase_order_id
    JOIN modbm_core.sales_orders so
      ON b.sales_order_id = so.sales_order_id
    WHERE b.state_code = 'awaiting_receipt'
      AND CAST(pol.quantity_received AS NUMERIC) >= CAST(pol.quantity AS NUMERIC)
  `;

  if (staleRows.length === 0) {
    console.log('No stale backorders found. All good!');
    await sqlClient.end();
    return;
  }

  console.log(`Found ${staleRows.length} stale backorder(s):\n`);
  console.table(
    staleRows.map((r) => ({
      SO: r.so_num,
      PO: r.po_num,
      'PO State': r.po_state,
      'BO Qty': r.bo_qty,
      'PO Line Received': r.po_line_received,
      Action: 'awaiting_receipt → received_reserved',
    })),
  );

  if (DRY_RUN) {
    console.log('\n🔍 Dry run complete. Pass --apply to execute.\n');
    await sqlClient.end();
    return;
  }

  // Apply the fix
  const ids = staleRows.map((r) => r.backorder_id);

  const result = await sqlClient`
    UPDATE modbm_core.backorders
    SET state_code = 'received_reserved',
        modified_on = NOW()
    WHERE backorder_id = ANY(${ids})
      AND state_code = 'awaiting_receipt'
  `;

  console.log(
    `\n✅ Updated ${result.count} backorder(s) to 'received_reserved'.`,
  );
  await sqlClient.end();
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
