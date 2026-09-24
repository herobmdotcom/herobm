import { describe, it, expect } from '@jest/globals';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
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
  organizations,
  contacts,
  organizationContactLinks,
  organizationOrganizationLinks,
  organizationNotes,
  opportunities,
  opportunityOrganizations,
  opportunityContacts,
  opportunityNotes,
  crmActivities,
  crmActivityContacts,
  users,
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
  projects,
  projectTasks,
  projectResources,
  projectBudgetLines,
  projectLedgerEntries,
  masterDataEvents,
  procurementEvents,
  salesEvents,
  inventoryEvents,
  warehouseEvents,
  financialEvents,
  taxPositions,
  taxPositionMappings,
  supplierGroups,
  supplierExpiries,
  csvMappingProfiles,
  reconciliationRules,
  apiKeys,
  webhooks,
  integrations,
  emailOutbox,
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
  glMatchGroups,
  bankStatementLines,
  glReconciliations,
  glFiscalPeriods,
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
  PROJECT_STATE,
  PROJECT_TASK_STATE,
  PROJECT_BILLING_TYPE,
  RESOURCE_TYPE,
  PROJECT_LINE_TYPE,
  PROJECT_LEDGER_ENTRY_TYPE,
} from '@herobm/shared';
import type { SeedDB } from './run';
import { executeLedgerIntegrityAudit } from '../gl/gl-integrity-audit.utils';

describe('Demo Seed Verification Suite', () => {
  const ctx = setupPgliteSuite();

  it('should successfully execute runDemoSeeds and populate active in-progress Picking, Shipping, and Putaway queues across all warehouses', async () => {
    // 1. Execute Demo Seeding
    await runDemoSeeds(ctx.db as unknown as SeedDB, false, true, 'us_standard');

    // Assert Demo Admin User
    const [demoUser] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.username, 'demo'));
    expect(demoUser).toBeDefined();
    expect(demoUser.role).toBe('admin');
    expect(demoUser.isActive).toBe(true);
    const pwMatch = await bcrypt.compare('demodemo', demoUser.passwordHash);
    expect(pwMatch).toBe(true);

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

    // 5. Assert CRM Organizations, Groups, Suppliers, Customers & Discounts
    const seededGroups = await ctx.db.select().from(customerGroups);
    expect(seededGroups.length).toBeGreaterThanOrEqual(3);

    const seededDiscounts = await ctx.db.select().from(discountMatrix);
    expect(seededDiscounts.length).toBeGreaterThanOrEqual(3);

    const seededOrganizations = await ctx.db.select().from(organizations);
    expect(seededOrganizations.length).toBeGreaterThanOrEqual(10);

    const seededSuppliers = await ctx.db.select().from(suppliers);
    expect(seededSuppliers.length).toBeGreaterThanOrEqual(5);
    for (const s of seededSuppliers) {
      expect(s.organizationId).toBeDefined();
      expect(s.stateCode).toBe(SUPPLIER_STATE.ACTIVE);
    }

    const seededCustomers = await ctx.db.select().from(customers);
    expect(seededCustomers.length).toBeGreaterThanOrEqual(5);
    for (const c of seededCustomers) {
      expect(c.organizationId).toBeDefined();
      expect(c.stateCode).toBe(CUSTOMER_STATE.ACTIVE);
      if (c.customerNumber !== 'WALK-IN') {
        expect(Number(c.creditLimit)).toBeGreaterThan(0);
      }
    }

    const deliveryAddresses = await ctx.db
      .select()
      .from(customerDeliveryAddresses);
    expect(deliveryAddresses.length).toBeGreaterThanOrEqual(5);

    const seededContacts = await ctx.db.select().from(contacts);
    expect(seededContacts.length).toBeGreaterThanOrEqual(10);

    const seededContactLinks = await ctx.db
      .select()
      .from(organizationContactLinks);
    expect(seededContactLinks.length).toBeGreaterThanOrEqual(10);

    const seededOrgLinks = await ctx.db
      .select()
      .from(organizationOrganizationLinks);
    expect(seededOrgLinks.length).toBeGreaterThanOrEqual(1);

    const seededOrgNotes = await ctx.db.select().from(organizationNotes);
    expect(seededOrgNotes.length).toBeGreaterThanOrEqual(1);

    // 6. Assert CRM Opportunities & Activities
    const seededOpportunities = await ctx.db.select().from(opportunities);
    expect(seededOpportunities.length).toBeGreaterThanOrEqual(10);

    const seededOppOrgs = await ctx.db.select().from(opportunityOrganizations);
    expect(seededOppOrgs.length).toBeGreaterThanOrEqual(10);

    const seededOppContacts = await ctx.db.select().from(opportunityContacts);
    expect(seededOppContacts.length).toBeGreaterThanOrEqual(5);

    const seededOppNotes = await ctx.db.select().from(opportunityNotes);
    expect(seededOppNotes.length).toBeGreaterThanOrEqual(5);

    const seededActivities = await ctx.db.select().from(crmActivities);
    expect(seededActivities.length).toBeGreaterThanOrEqual(16);
    const openTasks = seededActivities.filter(
      (a) => a.status === 'open' && a.type === 'task',
    );
    expect(openTasks.length).toBeGreaterThanOrEqual(4);

    const seededActivityContacts = await ctx.db
      .select()
      .from(crmActivityContacts);
    expect(seededActivityContacts.length).toBeGreaterThanOrEqual(5);

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
    expect(seededPOs.length).toBe(29);

    const seededPOLines = await ctx.db.select().from(purchaseOrderLineItems);
    expect(seededPOLines.length).toBeGreaterThanOrEqual(50);

    const seededGRs = await ctx.db.select().from(goodsReceived);
    expect(seededGRs.length).toBe(26);

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

    // 10. Assert Sales Orders Across Operational Queues (Picking, Shipping, Shipped, Quotes, OTC)
    const seededSOs = await ctx.db.select().from(salesOrders);
    expect(seededSOs.length).toBe(75);

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
    expect(shippedSOs.length).toBe(37); // 35 normal + 2 OTC

    // Live Sales Quotes
    const quotedSOs = seededSOs.filter(
      (so) => so.stateCode === SALES_ORDER_STATE.QUOTED,
    );
    expect(quotedSOs.length).toBe(3);

    // Assert CRM Opportunity Links
    const oppLinkedSOs = seededSOs.filter((so) => so.opportunityId !== null);
    expect(oppLinkedSOs.length).toBeGreaterThanOrEqual(10);

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
    expect(seededARInvoices.length).toBe(37);

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
    expect(seededJournals.length).toBeGreaterThanOrEqual(75);

    const seededJournalLines = await ctx.db.select().from(glJournalLines);
    expect(seededJournalLines.length).toBeGreaterThanOrEqual(150);
    const linesWithDimensions = seededJournalLines.filter(
      (jl) => jl.costCenterId !== null && jl.activityId !== null,
    );
    expect(linesWithDimensions.length).toBeGreaterThanOrEqual(10);

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

    // 15b. Assert Putaway Queue Lines have active stock in system bins (ADV-200)
    const grHeaderMap = new Map(
      seededGRs.map((gr) => [gr.goodsReceivedId, gr]),
    );
    const zoneMap = new Map(seededZones.map((z) => [z.zoneId, z]));
    const binsByLocationAndNumber = new Map(
      seededBins.map((b) => [
        `${zoneMap.get(b.zoneId)?.locationId}:${b.binNumber}`,
        b,
      ]),
    );
    const binContentsMap = new Map(
      currentBinContents.map((bc) => [
        `${bc.binId}:${bc.productId}`,
        Number(bc.actualQuantity),
      ]),
    );

    for (const grLine of pendingPutawayGrLines) {
      const header = grHeaderMap.get(grLine.goodsReceivedId)!;
      const recvBin = binsByLocationAndNumber.get(
        `${header.locationId}:RECEIVING`,
      )!;
      expect(recvBin).toBeDefined();
      const stock =
        binContentsMap.get(`${recvBin.binId}:${grLine.productId}`) ?? 0;
      expect(stock).toBeGreaterThanOrEqual(Number(grLine.quantityReceived));
    }

    for (const grLine of quarantinedGrLines) {
      const header = grHeaderMap.get(grLine.goodsReceivedId)!;
      const quaranBin = binsByLocationAndNumber.get(
        `${header.locationId}:QUARANTINE`,
      )!;
      expect(quaranBin).toBeDefined();
      const stock =
        binContentsMap.get(`${quaranBin.binId}:${grLine.productId}`) ?? 0;
      expect(stock).toBeGreaterThanOrEqual(Number(grLine.quantityReceived));
    }

    for (const toLine of seededTOReceiptLines) {
      const stock =
        binContentsMap.get(`${toLine.binId}:${toLine.productId}`) ?? 0;
      expect(stock).toBeGreaterThanOrEqual(Number(toLine.quantity));
    }

    const soReturnHeaderMap = new Map(
      seededSoReturns.map((r) => [r.returnId, r]),
    );
    const soLineMap = new Map(
      seededSOLines.map((sol) => [sol.salesOrderLineId, sol]),
    );

    for (const retLine of pendingPutawayReturnLines) {
      const header = soReturnHeaderMap.get(retLine.returnId)!;
      const retBin = binsByLocationAndNumber.get(
        `${header.locationId}:CUSTOMER_RETURNS`,
      )!;
      expect(retBin).toBeDefined();
      const soLine = soLineMap.get(retLine.salesOrderLineId)!;
      const stock =
        binContentsMap.get(`${retBin.binId}:${soLine.productId}`) ?? 0;
      expect(stock).toBeGreaterThanOrEqual(Number(retLine.quantityReceived));
    }

    for (const retLine of quarantinedReturnLines) {
      const header = soReturnHeaderMap.get(retLine.returnId)!;
      const quaranBin = binsByLocationAndNumber.get(
        `${header.locationId}:QUARANTINE`,
      )!;
      expect(quaranBin).toBeDefined();
      const soLine = soLineMap.get(retLine.salesOrderLineId)!;
      const stock =
        binContentsMap.get(`${quaranBin.binId}:${soLine.productId}`) ?? 0;
      expect(stock).toBeGreaterThanOrEqual(Number(retLine.quantityReceived));
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

    // 17. Assert General Ledger Cryptographic Integrity & Sequence Continuity
    const auditReport = await executeLedgerIntegrityAudit(ctx.db as any);
    expect(auditReport.anomaliesCount).toBe(0);
    expect(auditReport.anomalies).toEqual([]);
    expect(auditReport.verifiedInvoicesCount).toBe(37);
    expect(auditReport.verifiedJournalsCount).toBeGreaterThanOrEqual(75);

    // 18. Assert Operational Projects, WBS Hierarchies, Resources, Budgets & Ledger Actuals
    const seededResources = await ctx.db.select().from(projectResources);
    expect(seededResources.length).toBe(7);
    const personResources = seededResources.filter(
      (r) => r.resourceType === RESOURCE_TYPE.PERSON,
    );
    expect(personResources.length).toBe(3);
    const contractorResources = seededResources.filter(
      (r) => r.resourceType === RESOURCE_TYPE.CONTRACTOR,
    );
    expect(contractorResources.length).toBe(2);
    const equipmentResources = seededResources.filter(
      (r) => r.resourceType === RESOURCE_TYPE.EQUIPMENT,
    );
    expect(equipmentResources.length).toBe(2);
    for (const res of seededResources) {
      expect(Number(res.directUnitCost)).toBeGreaterThan(0);
      expect(Number(res.unitPrice)).toBeGreaterThan(0);
      expect(['HOUR', 'DAY', 'EA']).toContain(res.baseUom);
    }

    const seededProjects = await ctx.db.select().from(projects);
    expect(seededProjects.length).toBe(7);

    const activeProjects = seededProjects.filter(
      (p) => p.stateCode === PROJECT_STATE.ACTIVE,
    );
    expect(activeProjects.length).toBe(4);

    const draftProjects = seededProjects.filter(
      (p) => p.stateCode === PROJECT_STATE.DRAFT,
    );
    expect(draftProjects.length).toBe(1);

    const closedProjects = seededProjects.filter(
      (p) => p.stateCode === PROJECT_STATE.CLOSED,
    );
    expect(closedProjects.length).toBe(2);

    for (const prj of seededProjects) {
      expect(prj.customerId).toBeDefined();
      expect(prj.billingType).toBeDefined();
      expect(prj.stage).toBeDefined();
    }

    // Assert WBS Tasks and Hierarchical Parent/Child Links
    const seededTasks = await ctx.db.select().from(projectTasks);
    expect(seededTasks.length).toBeGreaterThanOrEqual(20);

    const parentTasks = seededTasks.filter((t) => t.parentTaskId === null);
    expect(parentTasks.length).toBeGreaterThanOrEqual(15);

    const subTasks = seededTasks.filter((t) => t.parentTaskId !== null);
    expect(subTasks.length).toBeGreaterThanOrEqual(7);

    const milestones = seededTasks.filter((t) => t.isMilestone);
    expect(milestones.length).toBeGreaterThanOrEqual(7);

    // Assert Project Budget Lines (Labor, Item, Expense)
    const seededBudgetLines = await ctx.db.select().from(projectBudgetLines);
    expect(seededBudgetLines.length).toBeGreaterThanOrEqual(20);

    const laborBudgets = seededBudgetLines.filter(
      (b) => b.lineType === PROJECT_LINE_TYPE.RESOURCE,
    );
    expect(laborBudgets.length).toBeGreaterThanOrEqual(10);

    const itemBudgets = seededBudgetLines.filter(
      (b) => b.lineType === PROJECT_LINE_TYPE.ITEM,
    );
    expect(itemBudgets.length).toBeGreaterThanOrEqual(5);

    const expenseBudgets = seededBudgetLines.filter(
      (b) => b.lineType === PROJECT_LINE_TYPE.EXPENSE,
    );
    expect(expenseBudgets.length).toBeGreaterThanOrEqual(2);

    for (const bl of seededBudgetLines) {
      expect(Number(bl.plannedQuantity)).toBeGreaterThan(0);
      expect(Number(bl.unitCost)).toBeGreaterThan(0);
      expect(Number(bl.unitPrice)).toBeGreaterThan(0);
      expect(Number(bl.totalCost)).toBeGreaterThan(0);
      expect(Number(bl.totalPrice)).toBeGreaterThan(0);
    }

    // Assert Project Ledger Entries (Actual Usages & Billed Revenue)
    const seededLedgerEntries = await ctx.db
      .select()
      .from(projectLedgerEntries);
    expect(seededLedgerEntries.length).toBeGreaterThanOrEqual(20);

    const billedEntries = seededLedgerEntries.filter((l) => l.isBilled);
    expect(billedEntries.length).toBeGreaterThanOrEqual(10);

    const unbilledEntries = seededLedgerEntries.filter((l) => !l.isBilled);
    expect(unbilledEntries.length).toBeGreaterThanOrEqual(5);

    const timesheetEntries = seededLedgerEntries.filter(
      (l) => l.sourceType === 'timesheet',
    );
    expect(timesheetEntries.length).toBeGreaterThanOrEqual(8);

    const materialIssues = seededLedgerEntries.filter(
      (l) => l.sourceType === 'inventory_issue',
    );
    expect(materialIssues.length).toBeGreaterThanOrEqual(5);

    for (const le of seededLedgerEntries) {
      expect(Number(le.quantity)).toBeGreaterThan(0);
      expect(Number(le.totalCostBase)).toBeGreaterThan(0);
      expect(Number(le.totalPriceBase)).toBeGreaterThan(0);
    }

    // 19. Assert Tax Positions and Mappings
    const seededTaxPositions = await ctx.db.select().from(taxPositions);
    expect(seededTaxPositions.length).toBeGreaterThanOrEqual(3);

    const seededTaxMappings = await ctx.db.select().from(taxPositionMappings);
    expect(seededTaxMappings.length).toBeGreaterThanOrEqual(2);

    // 20. Assert Supplier Groups & Expiries
    const seededSupplierGroups = await ctx.db.select().from(supplierGroups);
    expect(seededSupplierGroups.length).toBeGreaterThanOrEqual(3);

    const seededSupplierExpiries = await ctx.db.select().from(supplierExpiries);
    expect(seededSupplierExpiries.length).toBeGreaterThanOrEqual(4);

    // 21. Assert CSV Mapping Profiles & Reconciliation Rules Engine
    const seededCsvProfiles = await ctx.db.select().from(csvMappingProfiles);
    expect(seededCsvProfiles.length).toBeGreaterThanOrEqual(3);

    const seededReconRules = await ctx.db.select().from(reconciliationRules);
    expect(seededReconRules.length).toBeGreaterThanOrEqual(3);

    // 22. Assert Developer API Keys, Webhooks, Integrations & Outbox
    const seededApiKeys = await ctx.db.select().from(apiKeys);
    expect(seededApiKeys.length).toBeGreaterThanOrEqual(2);

    const seededWebhooks = await ctx.db.select().from(webhooks);
    expect(seededWebhooks.length).toBeGreaterThanOrEqual(2);

    const seededIntegrations = await ctx.db.select().from(integrations);
    expect(seededIntegrations.length).toBeGreaterThanOrEqual(3);

    const seededOutbox = await ctx.db.select().from(emailOutbox);
    expect(seededOutbox.length).toBeGreaterThanOrEqual(3);

    // 23. Assert Multi-Warehouse Physical Stocktakes
    const seededStocktakes = await ctx.db.select().from(stocktakes);
    expect(seededStocktakes.length).toBe(3);

    const seededStocktakeLines = await ctx.db.select().from(stocktakeLines);
    expect(seededStocktakeLines.length).toBeGreaterThanOrEqual(11);

    const seededStocktakeCounts = await ctx.db.select().from(stocktakeCounts);
    expect(seededStocktakeCounts.length).toBeGreaterThanOrEqual(7);

    // 24. Assert Bank Statement Lines, Match Groups & Reconciliations
    const seededBankLines = await ctx.db.select().from(bankStatementLines);
    expect(seededBankLines.length).toBeGreaterThanOrEqual(15);

    const seededMatchGroups = await ctx.db.select().from(glMatchGroups);
    expect(seededMatchGroups.length).toBeGreaterThanOrEqual(12);

    const seededReconciliations = await ctx.db.select().from(glReconciliations);
    expect(seededReconciliations.length).toBeGreaterThanOrEqual(2);

    // 25. Assert Accounting Fiscal Periods Governance
    const seededPeriods = await ctx.db.select().from(glFiscalPeriods);
    expect(seededPeriods.length).toBe(36);
    const hardClosedPeriods = seededPeriods.filter(
      (p) => p.status === 'hard_closed',
    );
    expect(hardClosedPeriods.length).toBe(20); // FY2025 (12) + FY2026 (8)
  });
});
