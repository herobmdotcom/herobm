import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import type { DrizzleDB } from '../src/drizzle/drizzle.module';
import { GlService } from '../src/gl/gl.service';
import { GENESIS_HASH } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('Financial Immutability Triggers (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let glService: GlService;

  let sharedOrderId: string;
  let sharedAccountId: string;
  let sharedProductId: string;
  let sharedLocationId: string;
  let sharedZoneId: string;
  let sharedBinId: string;
  let sharedInventoryEntryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    db = app.get(DRIZZLE);
    glService = app.get(GlService);

    // Create baseline test fixtures
    sharedLocationId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.locations (location_id, code, name, source)
      VALUES (${sharedLocationId}::uuid, ${`LOC-${Date.now()}`}, 'Test Warehouse', 'app');
    `);

    sharedZoneId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source)
      VALUES (${sharedZoneId}::uuid, ${sharedLocationId}::uuid, 'ZONE-A', 'Main Zone', 'app');
    `);

    sharedBinId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.bins (bin_id, zone_id, bin_number, bin_type, source)
      VALUES (${sharedBinId}::uuid, ${sharedZoneId}::uuid, 'BIN-A1', 'pick', 'app');
    `);

    sharedProductId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.products (product_id, product_number, name, product_type, structure_type, base_uom, state_code, source)
      VALUES (${sharedProductId}::uuid, ${`PRD-${Date.now()}`}, 'Test Product', 'inventory', 'standard', 'EA', 'active', 'app');
    `);

    sharedOrderId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.sales_orders (
        sales_order_id, order_number, fulfillment_location_id, state_code, currency_code, exchange_rate, source, discrepancies_acknowledged
      ) VALUES (
        ${sharedOrderId}::uuid, ${`ORD-${Date.now()}`}, ${sharedLocationId}::uuid, 'confirmed', 'USD', '1.0', 'app', true
      );
    `);

    const accRes: any = await db.execute(
      sql`SELECT gl_account_id FROM herobm_core.gl_accounts WHERE is_group = false AND is_active = true LIMIT 1;`,
    );
    if (accRes && accRes[0]?.gl_account_id) {
      sharedAccountId = accRes[0].gl_account_id;
    } else {
      sharedAccountId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.gl_accounts (gl_account_id, account_code, account_name, account_type, is_active)
        VALUES (${sharedAccountId}::uuid, '1000', 'Cash', 'asset', true);
      `);
    }

    sharedInventoryEntryId = randomUUID();
    await db.execute(sql`
      INSERT INTO herobm_core.inventory_entries (
        entry_id, entry_number, entry_date, source_type, is_reversed
      ) VALUES (
        ${sharedInventoryEntryId}::uuid, ${`STK-${Date.now()}`}, NOW(), 'ADJUSTMENT', false
      );
    `);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  const getErrorMessage = (err: any) =>
    `${err?.message || ''} ${err?.cause?.message || ''} ${String(err)}`;

  describe('Core Finance & General Ledger', () => {
    it('should reject hard DELETE on sales_invoices with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.sales_invoices (
          invoice_id, invoice_number, sales_order_id, total_amount, outstanding_amount, currency_code, exchange_rate, state_code
        ) VALUES (
          ${testId}::uuid, ${`INV-TEST-${Date.now()}`}, ${sharedOrderId}::uuid, '100.00', '100.00', 'USD', '1.0', 'invoiced'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.sales_invoices WHERE invoice_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('sales_invoices');
    });

    it('should reject hard DELETE on gl_journal_entries with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.gl_journal_entries (
          journal_entry_id, entry_number, entry_date, source_type, is_reversed
        ) VALUES (
          ${testId}::uuid, ${`JE-TEST-${Date.now()}`}, CURRENT_DATE, 'manual', false
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.gl_journal_entries WHERE journal_entry_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('gl_journal_entries');
    });
  });

  describe('Tier 1: Perpetual Inventory & Bank Control', () => {
    it('should reject hard DELETE on inventory_ledger with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.inventory_ledger (
          ledger_id, entry_id, product_id, location_id, zone_id, bin_id, quantity
        ) VALUES (
          ${testId}::uuid, ${sharedInventoryEntryId}::uuid, ${sharedProductId}::uuid, ${sharedLocationId}::uuid, ${sharedZoneId}::uuid, ${sharedBinId}::uuid, '10'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.inventory_ledger WHERE ledger_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('inventory_ledger');
    });

    it('should reject hard DELETE on bank_statement_lines with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.bank_statement_lines (
          line_id, gl_account_id, date, description, amount, is_reconciled
        ) VALUES (
          ${testId}::uuid, ${sharedAccountId}::uuid, CURRENT_DATE, 'Bank deposit', '250.00', false
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.bank_statement_lines WHERE line_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('bank_statement_lines');
    });
  });

  describe('Tier 2: Domain Audit Events', () => {
    it('should reject hard DELETE on warehouse_events with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.warehouse_events (
          event_id, entity_type, entity_id, event_type, payload, actor
        ) VALUES (
          ${testId}::uuid, 'shipment', ${randomUUID()}::uuid, 'created', '{"status":"shipped"}'::jsonb, 'admin'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.warehouse_events WHERE event_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('warehouse_events');
    });

    it('should reject hard DELETE on procurement_events with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.procurement_events (
          event_id, entity_type, entity_id, event_type, payload, actor
        ) VALUES (
          ${testId}::uuid, 'purchase_order', ${randomUUID()}::uuid, 'created', '{"status":"draft"}'::jsonb, 'admin'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.procurement_events WHERE event_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('procurement_events');
    });
  });

  describe('Tier 3: Historical Parameters', () => {
    it('should reject hard DELETE on exchange_rates with COMPLIANCE VIOLATION', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.exchange_rates (
          exchange_rate_id, currency_code, currency_name, buy_rate, sell_rate
        ) VALUES (
          ${testId}::uuid, 'EUR', 'Euro', '0.85', '0.86'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          DELETE FROM herobm_core.exchange_rates WHERE exchange_rate_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('exchange_rates');
    });
  });

  describe('In-Place UPDATE Immutability Triggers', () => {
    it('should reject in-place UPDATE on total_amount of issued sales_invoices', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.sales_invoices (
          invoice_id, invoice_number, sales_order_id, total_amount, outstanding_amount, currency_code, exchange_rate, state_code
        ) VALUES (
          ${testId}::uuid, ${`INV-UPD-${Date.now()}`}, ${sharedOrderId}::uuid, '250.00', '250.00', 'USD', '1.0', 'invoiced'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          UPDATE herobm_core.sales_invoices
          SET total_amount = '100.00'
          WHERE invoice_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('Modifying financial amounts');
    });

    it('should allow UPDATE on outstanding_amount and state_code of issued sales_invoices (payment processing)', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.sales_invoices (
          invoice_id, invoice_number, sales_order_id, total_amount, outstanding_amount, currency_code, exchange_rate, state_code
        ) VALUES (
          ${testId}::uuid, ${`INV-PAY-${Date.now()}`}, ${sharedOrderId}::uuid, '250.00', '250.00', 'USD', '1.0', 'invoiced'
        );
      `);

      await expect(
        db.execute(sql`
          UPDATE herobm_core.sales_invoices
          SET outstanding_amount = '0.00', state_code = 'paid'
          WHERE invoice_id = ${testId}::uuid;
        `),
      ).resolves.not.toThrow();
    });

    it('should reject in-place UPDATE on debit or credit of gl_journal_lines', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const jeId = randomUUID();
      const lineId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.gl_journal_entries (
          journal_entry_id, entry_number, entry_date, source_type, is_reversed
        ) VALUES (
          ${jeId}::uuid, ${`JE-UPD-${Date.now()}`}, CURRENT_DATE, 'manual', false
        );
      `);

      await db.execute(sql`
        INSERT INTO herobm_core.gl_journal_lines (
          journal_line_id, journal_entry_id, gl_account_id, debit, credit, foreign_debit, foreign_credit, is_reconciled
        ) VALUES (
          ${lineId}::uuid, ${jeId}::uuid, ${sharedAccountId}::uuid, '50.00', '0.00', '50.00', '0.00', false
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          UPDATE herobm_core.gl_journal_lines
          SET debit = '75.00'
          WHERE journal_line_id = ${lineId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain(
        'Modifying financial debit, credit',
      );
    });

    it('should allow UPDATE on is_reconciled of gl_journal_lines (bank matching)', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const jeId = randomUUID();
      const lineId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.gl_journal_entries (
          journal_entry_id, entry_number, entry_date, source_type, is_reversed
        ) VALUES (
          ${jeId}::uuid, ${`JE-REC-${Date.now()}`}, CURRENT_DATE, 'manual', false
        );
      `);

      await db.execute(sql`
        INSERT INTO herobm_core.gl_journal_lines (
          journal_line_id, journal_entry_id, gl_account_id, debit, credit, foreign_debit, foreign_credit, is_reconciled
        ) VALUES (
          ${lineId}::uuid, ${jeId}::uuid, ${sharedAccountId}::uuid, '50.00', '0.00', '50.00', '0.00', false
        );
      `);

      await expect(
        db.execute(sql`
          UPDATE herobm_core.gl_journal_lines
          SET is_reconciled = true
          WHERE journal_line_id = ${lineId}::uuid;
        `),
      ).resolves.not.toThrow();
    });

    it('should reject in-place UPDATE on inventory_ledger entries', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const testId = randomUUID();
      await db.execute(sql`
        INSERT INTO herobm_core.inventory_ledger (
          ledger_id, entry_id, product_id, location_id, zone_id, bin_id, quantity
        ) VALUES (
          ${testId}::uuid, ${sharedInventoryEntryId}::uuid, ${sharedProductId}::uuid, ${sharedLocationId}::uuid, ${sharedZoneId}::uuid, ${sharedBinId}::uuid, '10'
        );
      `);

      let error: any = null;
      try {
        await db.execute(sql`
          UPDATE herobm_core.inventory_ledger
          SET quantity = '20'
          WHERE ledger_id = ${testId}::uuid;
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('strictly append-only');
    });
  });

  describe('Database-Level Fiscal Period Hard-Locking', () => {
    it('should reject INSERT on gl_journal_entries when entry_date falls into a hard_closed period', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const periodId = randomUUID();
      const periodName = `TEST-CLOSE-${Date.now()}`;
      await db.execute(sql`
        INSERT INTO herobm_core.gl_fiscal_periods (
          period_id, period_name, fiscal_year, period_number, start_date, end_date, status
        ) VALUES (
          ${periodId}::uuid, ${periodName}, 2024, 1, '2024-01-01', '2024-01-31', 'hard_closed'
        );
      `);

      const jeId = randomUUID();
      let error: any = null;
      try {
        await db.execute(sql`
          INSERT INTO herobm_core.gl_journal_entries (
            journal_entry_id, entry_number, entry_date, source_type, is_reversed
          ) VALUES (
            ${jeId}::uuid, ${`JE-LOCKED-${Date.now()}`}, '2024-01-15', 'manual', false
          );
        `);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(getErrorMessage(error)).toContain('COMPLIANCE VIOLATION');
      expect(getErrorMessage(error)).toContain('hard-closed accounting period');
      expect(getErrorMessage(error)).toContain('2024-01-01 to 2024-01-31');
    });

    it('should allow INSERT on gl_journal_entries when entry_date falls into an open period', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      const periodId = randomUUID();
      const periodName = `TEST-OPEN-${Date.now()}`;
      await db.execute(sql`
        INSERT INTO herobm_core.gl_fiscal_periods (
          period_id, period_name, fiscal_year, period_number, start_date, end_date, status
        ) VALUES (
          ${periodId}::uuid, ${periodName}, 2024, 2, '2024-02-01', '2024-02-28', 'open'
        );
      `);

      const jeId = randomUUID();
      await expect(
        db.execute(sql`
          INSERT INTO herobm_core.gl_journal_entries (
            journal_entry_id, entry_number, entry_date, source_type, is_reversed
          ) VALUES (
            ${jeId}::uuid, ${`JE-OPEN-${Date.now()}`}, '2024-02-15', 'manual', false
          );
        `),
      ).resolves.not.toThrow();
    });
  });

  describe('Cryptographic Ledger Hash Chaining', () => {
    it('should assign sequential sequence_numbers and valid SHA-256 hash chains upon posting', async () => {
      if (process.env.USE_PGLITE === 'true') return;

      // 1. Post first journal entry
      const entry1 = await glService.postJournalEntry(
        [
          { accountId: sharedAccountId, debit: 150, credit: 0 },
          { accountId: sharedAccountId, debit: 0, credit: 150 },
        ],
        {
          sourceType: 'manual',
          memo: 'E2E Hash Chain Test Entry 1',
        },
      );

      expect(entry1).toBeDefined();
      expect(entry1.sequenceNumber).toBeDefined();
      expect(entry1.sequenceNumber).toBeGreaterThan(0);
      expect(entry1.prevHash).toBeDefined();
      expect(entry1.entryHash).toBeDefined();
      expect(entry1.entryHash?.length).toBe(64);

      // 2. Post second journal entry
      const entry2 = await glService.postJournalEntry(
        [
          { accountId: sharedAccountId, debit: 250, credit: 0 },
          { accountId: sharedAccountId, debit: 0, credit: 250 },
        ],
        {
          sourceType: 'manual',
          memo: 'E2E Hash Chain Test Entry 2',
        },
      );

      expect(entry2).toBeDefined();
      expect(entry2.sequenceNumber).toBe(entry1.sequenceNumber! + 1);
      expect(entry2.prevHash).toBe(entry1.entryHash);
      expect(entry2.entryHash?.length).toBe(64);

      // 3. Verify entire ledger hash chain
      const verification = await glService.verifyLedgerHashChain();
      expect(verification.isValid).toBe(true);
      expect(verification.verifiedCount).toBeGreaterThanOrEqual(2);
    });
  });
});
