import { describe, it, expect } from '@jest/globals';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { runDemoSeeds } from './demo';
import {
  locations,
  zones,
  bins,
  productGroups,
  products,
  productDefaultBins,
  actors,
  suppliers,
  customers,
  customerDeliveryAddresses,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  purchaseInvoices,
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesInvoices,
  inventoryEntries,
  inventoryLedger,
  binContents,
  masterDataEvents,
  procurementEvents,
  salesEvents,
  inventoryEvents,
} from '@herobm/db-schema';
import { PRODUCT_STATE, SUPPLIER_STATE, CUSTOMER_STATE } from '@herobm/shared';
import type { SeedDB } from './run';

describe('Demo Seed Verification Suite', () => {
  const ctx = setupPgliteSuite();

  it('should successfully execute runDemoSeeds and populate valid relational data across all domains', async () => {
    // 1. Execute Demo Seeding
    await runDemoSeeds(ctx.db as unknown as SeedDB, false, true);

    // 2. Assert Master Data
    const seededLocations = await ctx.db.select().from(locations);
    expect(seededLocations.length).toBeGreaterThanOrEqual(3);

    const seededZones = await ctx.db.select().from(zones);
    expect(seededZones.length).toBeGreaterThanOrEqual(3);

    const seededBins = await ctx.db.select().from(bins);
    expect(seededBins.length).toBeGreaterThanOrEqual(3);

    const seededProductGroups = await ctx.db.select().from(productGroups);
    expect(seededProductGroups.length).toBeGreaterThanOrEqual(3);

    const seededProducts = await ctx.db.select().from(products);
    expect(seededProducts.length).toBeGreaterThanOrEqual(9);
    for (const p of seededProducts) {
      expect(p.stateCode).toBe(PRODUCT_STATE.ACTIVE);
      if (p.productNumber !== 'SYSTEM-CUSTOM-LINE') {
        expect(Number(p.listPrice)).toBeGreaterThan(0);
        expect(Number(p.standardCost)).toBeGreaterThan(0);
      }
    }

    const defaultBins = await ctx.db.select().from(productDefaultBins);
    expect(defaultBins.length).toBeGreaterThan(0);

    // 3. Assert CRM Actors, Suppliers & Customers
    const seededActors = await ctx.db.select().from(actors);
    expect(seededActors.length).toBeGreaterThanOrEqual(9);

    const seededSuppliers = await ctx.db.select().from(suppliers);
    expect(seededSuppliers.length).toBeGreaterThanOrEqual(4);
    for (const s of seededSuppliers) {
      expect(s.actorId).toBeDefined();
      expect(s.stateCode).toBe(SUPPLIER_STATE.ACTIVE);
    }

    const seededCustomers = await ctx.db.select().from(customers);
    expect(seededCustomers.length).toBeGreaterThanOrEqual(5);
    for (const c of seededCustomers) {
      expect(c.actorId).toBeDefined();
      expect(c.stateCode).toBe(CUSTOMER_STATE.ACTIVE);
      expect(Number(c.creditLimit)).toBeGreaterThan(0);
    }

    const deliveryAddresses = await ctx.db
      .select()
      .from(customerDeliveryAddresses);
    expect(deliveryAddresses.length).toBeGreaterThanOrEqual(5);

    // 4. Assert Procurement Transactions
    const seededPOs = await ctx.db.select().from(purchaseOrders);
    expect(seededPOs.length).toBe(20);
    for (const po of seededPOs) {
      expect(Number(po.baseTotalAmount)).toBeGreaterThan(0);
    }

    const seededPOLines = await ctx.db.select().from(purchaseOrderLineItems);
    expect(seededPOLines.length).toBeGreaterThanOrEqual(40);

    const seededGRs = await ctx.db.select().from(goodsReceived);
    expect(seededGRs.length).toBeGreaterThan(0);

    const seededGRLines = await ctx.db.select().from(goodsReceivedLines);
    expect(seededGRLines.length).toBeGreaterThan(0);

    const seededAPInvoices = await ctx.db.select().from(purchaseInvoices);
    expect(seededAPInvoices.length).toBeGreaterThan(0);

    // 5. Assert Sales Transactions
    const seededSOs = await ctx.db.select().from(salesOrders);
    expect(seededSOs.length).toBe(40);
    for (const so of seededSOs) {
      expect(Number(so.baseTotalAmount)).toBeGreaterThan(0);
    }

    const seededSOLines = await ctx.db.select().from(salesOrderLineItems);
    expect(seededSOLines.length).toBeGreaterThanOrEqual(40);

    const seededPicks = await ctx.db.select().from(salesOrderPicks);
    expect(seededPicks.length).toBeGreaterThan(0);

    const seededShipments = await ctx.db.select().from(salesOrderShipments);
    expect(seededShipments.length).toBeGreaterThan(0);

    const seededARInvoices = await ctx.db.select().from(salesInvoices);
    expect(seededARInvoices.length).toBeGreaterThan(0);

    // 6. Assert Double-Entry Inventory Ledger & Bin Stock
    const stockEntries = await ctx.db.select().from(inventoryEntries);
    expect(stockEntries.length).toBeGreaterThan(0);

    const ledgerLines = await ctx.db.select().from(inventoryLedger);
    expect(ledgerLines.length).toBeGreaterThan(0);

    const currentBinContents = await ctx.db.select().from(binContents);
    expect(currentBinContents.length).toBeGreaterThan(0);
    for (const bc of currentBinContents) {
      expect(Number(bc.actualQuantity)).toBeGreaterThanOrEqual(0);
    }

    // 7. Assert Domain Audit Events
    const mdEvents = await ctx.db.select().from(masterDataEvents);
    expect(mdEvents.length).toBeGreaterThan(0);

    const pEvents = await ctx.db.select().from(procurementEvents);
    expect(pEvents.length).toBeGreaterThan(0);

    const sEvents = await ctx.db.select().from(salesEvents);
    expect(sEvents.length).toBeGreaterThan(0);

    const invEvents = await ctx.db.select().from(inventoryEvents);
    expect(invEvents.length).toBeGreaterThan(0);
  });
});
