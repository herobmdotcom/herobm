#!/usr/bin/env npx tsx
/**
 * ERPNext Integration Transaction Simulator
 *
 * Drives end-to-end operational cycles through the ModBM API
 * to exercise the outbox→ERPNext sync pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/simulate_transactions.ts --mode=batch --count=10
 *   npx tsx --env-file=.env scripts/simulate_transactions.ts --mode=stream --interval=30
 */

// ─── Configuration ──────────────────────────────────────────────────────────────

const API_BASE = process.env.MODBM_API_URL || 'http://localhost:3001';
const LOGIN_USER = process.env.MODBM_SIM_USER || 'admin';
const LOGIN_PASS = process.env.DEV_ADMIN_PASSWORD || '';

if (!LOGIN_PASS) {
  console.error('ERROR: Set DEV_ADMIN_PASSWORD in .env');
  process.exit(1);
}

let HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

async function login(): Promise<void> {
  console.log(`  Logging in as '${LOGIN_USER}'...`);
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: LOGIN_USER, password: LOGIN_PASS }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const token = data.access_token || data.token;
  if (!token) throw new Error('Login response did not contain a token');
  HEADERS['Authorization'] = `Bearer ${token}`;
  console.log('  ✓ Authenticated');
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function api<T = any>(path: string, method = 'GET', body?: object): Promise<T> {
  const opts: RequestInit = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}/api${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return method === 'DELETE' || res.status === 204 ? (null as any) : res.json();
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Reference Data Cache ───────────────────────────────────────────────────────

let cachedAccounts: any[] = [];
let cachedSuppliers: any[] = [];
let cachedProducts: any[] = [];

async function loadReferenceData(): Promise<void> {
  console.log('  Loading reference data...');

  try {
    const accRes = await api<{ data: any[] }>('/accounts?limit=20');
    cachedAccounts = accRes.data || [];
  } catch { cachedAccounts = []; }

  try {
    const supRes = await api<{ data: any[] }>('/suppliers?limit=20');
    cachedSuppliers = supRes.data || [];
  } catch { cachedSuppliers = []; }

  try {
    const prodRes = await api<{ data: any[] }>('/products?limit=50');
    cachedProducts = prodRes.data || [];
  } catch { cachedProducts = []; }

  console.log(`  ✓ Accounts: ${cachedAccounts.length}, Suppliers: ${cachedSuppliers.length}, Products: ${cachedProducts.length}`);

  if (cachedAccounts.length === 0) {
    console.warn('  ⚠ No accounts found — Sales Order cycles will fail');
  }
  if (cachedSuppliers.length === 0) {
    console.warn('  ⚠ No suppliers found — Purchase Order cycles will fail');
  }
  if (cachedProducts.length === 0) {
    console.warn('  ⚠ No products found — order lines will fail');
  }
}

// ─── Sales Order Cycle ──────────────────────────────────────────────────────────

async function runSalesOrderCycle(label: string): Promise<void> {
  console.log(`\n[${label}] 📦 Starting Sales Order cycle...`);

  if (cachedAccounts.length === 0 || cachedProducts.length === 0) {
    console.log(`  ⚠ Skipping — need at least 1 account and 1 product`);
    return;
  }

  const customer = randomItem(cachedAccounts);
  const customerId = customer.accountId;

  // 1. Create a Sales Order
  const order = await api('/sales-orders', 'POST', {
    name: `Sim SO ${Date.now()}`,
    customerId,
    lines: Array.from({ length: randomBetween(1, 3) }, () => {
      const product = randomItem(cachedProducts);
      return {
        productId: product.productId,
        productDescription: product.name,
        quantity: String(randomBetween(1, 20)),
        pricePerUnit: (randomBetween(10, 500) + randomBetween(0, 99) / 100).toFixed(2),
      };
    }),
  });

  const soId = order.salesOrderId;
  console.log(`  ✓ Created SO: ${order.orderNumber} (${soId})`);

  // 2. Progress → quoted → confirmed → picking (with pick-all) → shipped
  for (const state of ['quoted', 'confirmed', 'picking']) {
    await api(`/sales-orders/${soId}/state`, 'PATCH', { stateCode: state });
    console.log(`  → ${state}`);
    await sleep(200);
  }

  // 3. Pick all lines (required before shipping)
  await api(`/sales-orders/${soId}/picking/pick-all`, 'POST', {});
  console.log(`  → pick-all`);
  await sleep(200);

  // 4. Ship
  await api(`/sales-orders/${soId}/state`, 'PATCH', { stateCode: 'shipped' });
  console.log(`  → shipped`);

  // 3. Generate Invoice
  try {
    const inv = await api(`/sales-orders/${soId}/invoice`, 'POST', {});
    console.log(`  ✓ Invoice created: ${inv.invoiceNumber} → outbox event emitted`);
  } catch (err: any) {
    console.log(`  ⚠ Invoice skipped: ${err.message}`);
  }

  console.log(`[${label}] ✅ Sales Order cycle complete`);
}

// ─── Purchase Order Cycle ───────────────────────────────────────────────────────

async function runPurchaseOrderCycle(label: string): Promise<void> {
  const ts = Date.now();
  console.log(`\n[${label}] 🚚 Starting Purchase Order cycle...`);

  if (cachedSuppliers.length === 0 || cachedProducts.length === 0) {
    console.log(`  ⚠ Skipping — need at least 1 supplier and 1 product`);
    return;
  }

  const supplier = randomItem(cachedSuppliers);
  const vendorId = supplier.vendorId;
  const orderNumber = `SIM-PO-${ts}-${randomBetween(100, 999)}`;

  // 1. Create a Purchase Order
  const order = await api('/purchase-orders', 'POST', {
    orderNumber,
    name: `Sim PO ${orderNumber}`,
    vendorId,
    lines: Array.from({ length: randomBetween(1, 3) }, () => {
      const product = randomItem(cachedProducts);
      return {
        productId: product.productId,
        productDescription: product.name,
        quantity: String(randomBetween(5, 50)),
        pricePerUnit: (randomBetween(5, 200) + randomBetween(0, 99) / 100).toFixed(2),
      };
    }),
  });

  const poId = order.purchaseOrderId;
  console.log(`  ✓ Created PO: ${orderNumber} (${poId})`);

  // 2. Progress → ordered → received
  for (const state of ['ordered', 'received']) {
    await api(`/purchase-orders/${poId}/state`, 'PATCH', { stateCode: state });
    console.log(`  → ${state}`);
    await sleep(200);
  }

  // 3. Enter Supplier Bill
  try {
    const bill = await api(`/purchase-orders/${poId}/invoice`, 'POST', {
      supplierInvoiceNumber: `SUP-${randomBetween(1000, 9999)}`,
    });
    console.log(`  ✓ Supplier Bill created: ${bill.invoiceNumber} → outbox event emitted`);
  } catch (err: any) {
    console.log(`  ⚠ Bill skipped: ${err.message}`);
  }

  console.log(`[${label}] ✅ Purchase Order cycle complete`);
}

// ─── Execution Engine ───────────────────────────────────────────────────────────

async function runOneCycle(index: number): Promise<void> {
  const label = `#${index}`;
  // Randomly choose sales or purchase cycle
  if (Math.random() > 0.4) {
    await runSalesOrderCycle(label);
  } else {
    await runPurchaseOrderCycle(label);
  }
}

async function batchMode(count: number): Promise<void> {
  console.log(`\n🚀 BATCH MODE: Running ${count} transaction cycles...`);
  const start = Date.now();

  for (let i = 1; i <= count; i++) {
    try {
      await runOneCycle(i);
    } catch (err: any) {
      console.error(`  ❌ Cycle ${i} failed: ${err.message}`);
    }
    await sleep(100);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n🏁 Batch complete: ${count} cycles in ${elapsed}s`);
}

async function streamMode(intervalSec: number): Promise<void> {
  console.log(`\n🔄 STREAM MODE: Generating a cycle every ${intervalSec}s (Ctrl+C to stop)`);
  let i = 1;

  const tick = async () => {
    try {
      await runOneCycle(i++);
    } catch (err: any) {
      console.error(`  ❌ Cycle ${i - 1} failed: ${err.message}`);
    }
  };

  await tick();
  setInterval(tick, intervalSec * 1000);
}

// ─── CLI Parsing ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const mode = args.mode || 'batch';
  const count = parseInt(args.count || '10', 10);
  const interval = parseInt(args.interval || '30', 10);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ModBM Transaction Simulator');
  console.log(`  API: ${API_BASE}`);
  console.log(`  Mode: ${mode}`);
  console.log('═══════════════════════════════════════════════════════════');

  await login();
  await loadReferenceData();

  if (mode === 'batch') {
    await batchMode(count);
  } else if (mode === 'stream') {
    await streamMode(interval);
  } else {
    console.error(`Unknown mode: ${mode}. Use --mode=batch or --mode=stream`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
