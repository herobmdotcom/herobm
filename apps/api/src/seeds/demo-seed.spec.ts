import { describe, it, expect } from '@jest/globals';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { runDemoSeeds } from './demo';
import {
  locations,
  zones,
  bins,
  productGroups,
  products,
  productComponents,
  productUoms,
  productDefaultBins,
  discountMatrix,
  actors,
  contacts,
  actorContactLinks,
  actorActorLinks,
  actorNotes,
  projects,
  projectActors,
  projectNotes,
  customerGroups,
  customers,
  customerDeliveryAddresses,
  suppliers,
  workOrders,
  workOrderComponents,
  workOrderPicks,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  purchaseInvoices,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseDebitNoteShipments,
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesInvoices,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesCreditNoteLines,
  backorders,
  paymentEntries,
  paymentAllocations,
  paymentLines,
  glJournalEntries,
  glJournalLines,
  exchangeRates,
  inventoryEntries,
  inventoryLedger,
  binContents,
  masterDataEvents,
  procurementEvents,
  salesEvents,
  inventoryEvents,
  warehouseEvents,
  financialEvents,
} from '@herobm/db-schema';
import {
  PRODUCT_STATE,
  SUPPLIER_STATE,
  CUSTOMER_STATE,
  WORK_ORDER_STATE,
  WORK_ORDER_PICK_STATE,
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  RETURN_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PUTAWAY_STATUS,
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
} from '@herobm/shared';
import type { SeedDB } from './run';

describe('Demo Seed Verification Suite', () => {
  const ctx = setupPgliteSuite();

  it('should successfully execute runDemoSeeds and populate active in-progress Picking, Shipping, and Putaway queues across all warehouses', async () => {
    // 1. Execute Demo Seeding
    await runDemoSeeds(ctx.db as unknown as SeedDB, false, true, 'us_standard');

    // 2. Assert Exchange Rates & FX
    const seededFx = await ctx.db.select().from(exchangeRates);
    expect(seededFx.length).toBeGreaterThanOrEqual(5);

    // 3. Assert Master Data (Warehouses, Zones, Bins)
    const seededLocations = await ctx.db.select().from(locations);
    expect(seededLocations.length).toBeGreaterThanOrEqual(3);

    const seededZones = await ctx.db.select().from(zones);
    expect(seededZones.length).toBeGreaterThanOrEqual(6);

    const seededBins = await ctx.db.select().from(bins);
    expect(seededBins.length).toBeGreaterThanOrEqual(18);

    const seededProductGroups = await ctx.db.select().from(productGroups);
    expect(seededProductGroups.length).toBeGreaterThanOrEqual(4);

    // 4. Assert Products, Kits, BOM Components & UOMs
    const seededProducts = await ctx.db.select().from(products);
    expect(seededProducts.length).toBeGreaterThanOrEqual(11);
    for (const p of seededProducts) {
      expect(p.stateCode).toBe(PRODUCT_STATE.ACTIVE);
      if (p.productNumber !== 'SYSTEM-CUSTOM-LINE') {
        expect(Number(p.listPrice)).toBeGreaterThan(0);
        expect(Number(p.standardCost)).toBeGreaterThan(0);
      }
    }

    const seededBoms = await ctx.db.select().from(productComponents);
    expect(seededBoms.length).toBeGreaterThanOrEqual(9);

    const seededUoms = await ctx.db.select().from(productUoms);
    expect(seededUoms.length).toBeGreaterThanOrEqual(2);

    const defaultBins = await ctx.db.select().from(productDefaultBins);
    expect(defaultBins.length).toBeGreaterThan(0);

    // 5. Assert CRM Actors, Groups, Suppliers, Customers & Discounts
    const seededGroups = await ctx.db.select().from(customerGroups);
    expect(seededGroups.length).toBeGreaterThanOrEqual(3);

    const seededDiscounts = await ctx.db.select().from(discountMatrix);
    expect(seededDiscounts.length).toBeGreaterThanOrEqual(3);

    const seededActors = await ctx.db.select().from(actors);
    expect(seededActors.length).toBeGreaterThanOrEqual(10);

    const seededSuppliers = await ctx.db.select().from(suppliers);
    expect(seededSuppliers.length).toBeGreaterThanOrEqual(5);
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

    const seededContacts = await ctx.db.select().from(contacts);
    expect(seededContacts.length).toBeGreaterThanOrEqual(10);

    const seededContactLinks = await ctx.db.select().from(actorContactLinks);
    expect(seededContactLinks.length).toBeGreaterThanOrEqual(10);

    const seededActorLinks = await ctx.db.select().from(actorActorLinks);
    expect(seededActorLinks.length).toBeGreaterThanOrEqual(1);

    const seededActorNotes = await ctx.db.select().from(actorNotes);
    expect(seededActorNotes.length).toBeGreaterThanOrEqual(1);

    // 6. Assert CRM Projects
    const seededProjects = await ctx.db.select().from(projects);
    expect(seededProjects.length).toBeGreaterThanOrEqual(2);

    const seededProjActors = await ctx.db.select().from(projectActors);
    expect(seededProjActors.length).toBeGreaterThanOrEqual(3);

    const seededProjNotes = await ctx.db.select().from(projectNotes);
    expect(seededProjNotes.length).toBeGreaterThanOrEqual(1);

    // 7. Assert Manufacturing Work Orders & Pending Picks
    const seededWorkOrders = await ctx.db.select().from(workOrders);
    expect(seededWorkOrders.length).toBe(6);

    const completedWos = seededWorkOrders.filter(
      (w) => w.stateCode === WORK_ORDER_STATE.COMPLETED,
    );
    expect(completedWos.length).toBe(3);

    const inProgressWos = seededWorkOrders.filter(
      (w) =>
        w.stateCode === WORK_ORDER_STATE.IN_PROGRESS ||
        w.stateCode === WORK_ORDER_STATE.PLANNED,
    );
    expect(inProgressWos.length).toBe(3);

    const seededWoComponents = await ctx.db.select().from(workOrderComponents);
    expect(seededWoComponents.length).toBeGreaterThan(0);

    const seededWoPicks = await ctx.db.select().from(workOrderPicks);
    expect(seededWoPicks.length).toBeGreaterThan(0);

    const pendingWoPicks = seededWoPicks.filter(
      (p) => p.stateCode === WORK_ORDER_PICK_STATE.PENDING,
    );
    expect(pendingWoPicks.length).toBeGreaterThan(0);

    // 8. Assert Inter-Warehouse Transfer Orders & Receipts
    const seededTOs = await ctx.db.select().from(transferOrders);
    expect(seededTOs.length).toBe(6);

    const confirmedTOs = seededTOs.filter(
      (t) => t.stateCode === TRANSFER_ORDER_STATE.CONFIRMED,
    );
    expect(confirmedTOs.length).toBe(2);

    const pickingTOs = seededTOs.filter(
      (t) => t.stateCode === TRANSFER_ORDER_STATE.PICKING,
    );
    expect(pickingTOs.length).toBe(2);

    const receivedTOs = seededTOs.filter(
      (t) => t.stateCode === TRANSFER_ORDER_STATE.RECEIVED,
    );
    expect(receivedTOs.length).toBe(2);

    const seededTOLines = await ctx.db.select().from(transferOrderLines);
    expect(seededTOLines.length).toBe(6);

    const seededTOPicks = await ctx.db.select().from(transferOrderPicks);
    expect(seededTOPicks.length).toBe(4);

    const seededTOShipments = await ctx.db
      .select()
      .from(transferOrderShipments);
    expect(seededTOShipments.length).toBe(2);

    const seededTOShipmentLines = await ctx.db
      .select()
      .from(transferOrderShipmentLines);
    expect(seededTOShipmentLines.length).toBe(2);

    const seededTOReceipts = await ctx.db.select().from(transferOrderReceipts);
    expect(seededTOReceipts.length).toBe(2);

    const seededTOReceiptLines = await ctx.db
      .select()
      .from(transferOrderReceiptLines);
    expect(seededTOReceiptLines.length).toBe(2);

    // 9. Assert Procurement & Inbound Putaway Queue Distribution
    const seededPOs = await ctx.db.select().from(purchaseOrders);
    expect(seededPOs.length).toBe(25);

    const seededPOLines = await ctx.db.select().from(purchaseOrderLineItems);
    expect(seededPOLines.length).toBeGreaterThanOrEqual(50);

    const seededGRs = await ctx.db.select().from(goodsReceived);
    expect(seededGRs.length).toBe(25);

    const seededGRLines = await ctx.db.select().from(goodsReceivedLines);
    expect(seededGRLines.length).toBeGreaterThan(0);

    // Assert Putaway Queue Lines
    const pendingPutawayGrLines = seededGRLines.filter(
      (l) => l.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY,
    );
    expect(pendingPutawayGrLines.length).toBeGreaterThanOrEqual(7);

    const quarantinedGrLines = seededGRLines.filter(
      (l) => l.putawayStatus === PUTAWAY_STATUS.QUARANTINED,
    );
    expect(quarantinedGrLines.length).toBeGreaterThanOrEqual(3);

    const completedGrLines = seededGRLines.filter(
      (l) => l.putawayStatus === PUTAWAY_STATUS.COMPLETED,
    );
    expect(completedGrLines.length).toBeGreaterThanOrEqual(15);

    const seededAPInvoices = await ctx.db.select().from(purchaseInvoices);
    expect(seededAPInvoices.length).toBeGreaterThan(0);

    const seededPoReturns = await ctx.db.select().from(purchaseOrderReturns);
    expect(seededPoReturns.length).toBe(3);

    const seededPoReturnLines = await ctx.db
      .select()
      .from(purchaseOrderReturnLines);
    expect(seededPoReturnLines.length).toBe(3);

    const seededPoRetShipments = await ctx.db
      .select()
      .from(purchaseOrderReturnShipments);
    expect(seededPoRetShipments.length).toBe(3);

    const seededDebitNotes = await ctx.db.select().from(purchaseDebitNotes);
    expect(seededDebitNotes.length).toBe(3);
    for (const dn of seededDebitNotes) {
      expect(dn.stateCode).toBe(PURCHASE_DEBIT_NOTE_STATE.POSTED);
      expect(Number(dn.totalAmount)).toBeGreaterThan(0);
    }

    const seededDebitLines = await ctx.db.select().from(purchaseDebitNoteLines);
    expect(seededDebitLines.length).toBe(3);

    const seededDebitShipments = await ctx.db
      .select()
      .from(purchaseDebitNoteShipments);
    expect(seededDebitShipments.length).toBe(3);

    // 10. Assert Sales Orders Across Operational Queues (Picking, Shipping, Shipped)
    const seededSOs = await ctx.db.select().from(salesOrders);
    expect(seededSOs.length).toBe(70);

    // Picking Queue Orders (Confirmed)
    const confirmedSOs = seededSOs.filter(
      (so) => so.stateCode === SALES_ORDER_STATE.CONFIRMED,
    );
    expect(confirmedSOs.length).toBe(22); // 12 ready + 6 partial + 4 blocked

    // Shipping Queue Orders (Picking)
    const pickingSOs = seededSOs.filter(
      (so) => so.stateCode === SALES_ORDER_STATE.PICKING,
    );
    expect(pickingSOs.length).toBe(13); // 9 ready + 4 partial

    // Shipped Orders
    const shippedSOs = seededSOs.filter(
      (so) => so.stateCode === SALES_ORDER_STATE.SHIPPED,
    );
    expect(shippedSOs.length).toBe(35);

    const seededSOLines = await ctx.db.select().from(salesOrderLineItems);
    expect(seededSOLines.length).toBeGreaterThanOrEqual(100);

    const seededPicks = await ctx.db.select().from(salesOrderPicks);
    expect(seededPicks.length).toBeGreaterThan(0);

    const readyShippingPicks = seededPicks.filter(
      (p) => p.stateCode === SALES_ORDER_PICK_STATE.PICKED,
    );
    expect(readyShippingPicks.length).toBeGreaterThanOrEqual(18);

    const seededShipments = await ctx.db.select().from(salesOrderShipments);
    expect(seededShipments.length).toBe(35);
    for (const shp of seededShipments) {
      expect(shp.trackingNumber).toBeDefined();
    }

    const seededARInvoices = await ctx.db.select().from(salesInvoices);
    expect(seededARInvoices.length).toBe(35);

    // 11. Assert Sales Returns & Credit Notes
    const seededSoReturns = await ctx.db.select().from(salesOrderReturns);
    expect(seededSoReturns.length).toBe(4);

    const seededSoReturnLines = await ctx.db
      .select()
      .from(salesOrderReturnLines);
    expect(seededSoReturnLines.length).toBe(4);

    const pendingPutawayReturnLines = seededSoReturnLines.filter(
      (l) => l.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY,
    );
    expect(pendingPutawayReturnLines.length).toBe(2);

    const quarantinedReturnLines = seededSoReturnLines.filter(
      (l) => l.putawayStatus === PUTAWAY_STATUS.QUARANTINED,
    );
    expect(quarantinedReturnLines.length).toBe(2);

    const seededCreditNotes = await ctx.db.select().from(salesCreditNotes);
    expect(seededCreditNotes.length).toBe(4);

    const seededCreditLines = await ctx.db.select().from(salesCreditNoteLines);
    expect(seededCreditLines.length).toBe(4);

    // 12. Assert Backorders
    const seededBackorders = await ctx.db.select().from(backorders);
    expect(seededBackorders.length).toBe(5);

    // 13. Assert Treasury & Payments
    const seededPayments = await ctx.db.select().from(paymentEntries);
    expect(seededPayments.length).toBeGreaterThanOrEqual(16);

    const seededPaymentLines = await ctx.db.select().from(paymentLines);
    expect(seededPaymentLines.length).toBeGreaterThanOrEqual(16);

    const seededAllocations = await ctx.db.select().from(paymentAllocations);
    expect(seededAllocations.length).toBeGreaterThanOrEqual(16);

    // 14. Assert GL Journal Entries & Segment Dimensions
    const seededJournals = await ctx.db.select().from(glJournalEntries);
    expect(seededJournals.length).toBe(5);

    const seededJournalLines = await ctx.db.select().from(glJournalLines);
    expect(seededJournalLines.length).toBe(10);
    for (const jl of seededJournalLines) {
      expect(jl.costCenterId).toBeDefined();
      expect(jl.activityId).toBeDefined();
    }

    // 15. Assert Double-Entry Inventory Ledger & Stock Levels
    const stockEntries = await ctx.db.select().from(inventoryEntries);
    expect(stockEntries.length).toBeGreaterThan(0);

    const ledgerLines = await ctx.db.select().from(inventoryLedger);
    expect(ledgerLines.length).toBeGreaterThan(0);

    const currentBinContents = await ctx.db.select().from(binContents);
    expect(currentBinContents.length).toBeGreaterThan(0);
    for (const bc of currentBinContents) {
      expect(Number(bc.actualQuantity)).toBeGreaterThanOrEqual(0);
    }

    // 16. Assert All 6 Domain Event Streams
    const mdEvents = await ctx.db.select().from(masterDataEvents);
    expect(mdEvents.length).toBeGreaterThan(0);

    const pEvents = await ctx.db.select().from(procurementEvents);
    expect(pEvents.length).toBeGreaterThan(0);

    const sEvents = await ctx.db.select().from(salesEvents);
    expect(sEvents.length).toBeGreaterThan(0);

    const invEvents = await ctx.db.select().from(inventoryEvents);
    expect(invEvents.length).toBeGreaterThan(0);

    const wEvents = await ctx.db.select().from(warehouseEvents);
    expect(wEvents.length).toBeGreaterThan(0);

    const finEvents = await ctx.db.select().from(financialEvents);
    expect(finEvents.length).toBeGreaterThan(0);
  });
});
