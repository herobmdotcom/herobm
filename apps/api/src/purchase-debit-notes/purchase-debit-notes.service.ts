import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and, or, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseDebitNoteShipments,
  suppliers,
  supplierGroups,
  actors,
  products,
  glJournalEntries,
  glJournalLines,
  procurementEvents,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { CreateDebitNoteDto } from './dto';
import {
  PURCHASE_RETURN_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import type { InventoryGlAccounts } from '../inventory/inventory-accounting';
import { glAccounts } from '@herobm/db-schema';

const VALID_DN_STATES = getValidStates(PURCHASE_DEBIT_NOTE_TRANSITIONS);

@Injectable()
export class PurchaseDebitNotesService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
  ) {}

  private readonly logger = new Logger(PurchaseDebitNotesService.name);

  private async generateDebitNoteNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PDN-${today}-`;

    const result = await this.db
      .select({ debitNoteNumber: purchaseDebitNotes.debitNoteNumber })
      .from(purchaseDebitNotes)
      .where(sql`${purchaseDebitNotes.debitNoteNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${purchaseDebitNotes.debitNoteNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].debitNoteNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async findAll(vendorId?: string, balanceStatus?: string) {
    let q = this.db
      .select({
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        supplierReferenceNumber: purchaseDebitNotes.supplierReferenceNumber,
        returnId: purchaseDebitNotes.returnId,
        purchaseOrderId: purchaseDebitNotes.purchaseOrderId,
        vendorId: purchaseDebitNotes.vendorId,
        totalAmount: purchaseDebitNotes.totalAmount,
        taxAmount: purchaseDebitNotes.taxAmount,
        feeAmount: purchaseDebitNotes.feeAmount,
        outstandingAmount: purchaseDebitNotes.outstandingAmount,
        currencyCode: purchaseDebitNotes.currencyCode,
        stateCode: purchaseDebitNotes.stateCode,
        notes: purchaseDebitNotes.notes,
        createdBy: purchaseDebitNotes.createdBy,
        createdOn: purchaseDebitNotes.createdOn,
        modifiedOn: purchaseDebitNotes.modifiedOn,
        orderNumber: purchaseOrders.orderNumber,
        vendorCode: suppliers.vendorNumber,
        vendorName: actors.name,
      })
      .from(purchaseDebitNotes)
      .leftJoin(
        purchaseOrders,
        eq(purchaseDebitNotes.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(suppliers, eq(purchaseDebitNotes.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .$dynamic();

    const conditions = [];
    if (vendorId) {
      conditions.push(eq(purchaseDebitNotes.vendorId, vendorId));
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(
        sql`CAST(${purchaseDebitNotes.outstandingAmount} AS numeric) > 0`,
      );
    }

    if (conditions.length > 0) {
      q = q.where(and(...conditions));
    }

    const notes = await q.orderBy(desc(purchaseDebitNotes.createdOn));

    if (notes.length === 0) {
      return [];
    }

    const noteIds = notes.map((n) => n.debitNoteId);
    const allLines: (typeof purchaseDebitNoteLines.$inferSelect)[] = [];
    const CHUNK_SIZE = 500;
    for (let i = 0; i < noteIds.length; i += CHUNK_SIZE) {
      const chunk = noteIds.slice(i, i + CHUNK_SIZE);
      const lines = await this.db
        .select()
        .from(purchaseDebitNoteLines)
        .where(inArray(purchaseDebitNoteLines.debitNoteId, chunk));
      allLines.push(...lines);
    }

    const lineIds = allLines.map((l) => l.debitNoteLineId);
    const allAllocations: (typeof purchaseDebitNoteShipments.$inferSelect)[] =
      [];
    for (let i = 0; i < lineIds.length; i += CHUNK_SIZE) {
      const chunk = lineIds.slice(i, i + CHUNK_SIZE);
      const allocs = await this.db
        .select()
        .from(purchaseDebitNoteShipments)
        .where(inArray(purchaseDebitNoteShipments.debitNoteLineId, chunk));
      allAllocations.push(...allocs);
    }

    const allocationsByLineId = new Map<string, typeof allAllocations>();
    for (const alloc of allAllocations) {
      const existing = allocationsByLineId.get(alloc.debitNoteLineId) || [];
      existing.push(alloc);
      allocationsByLineId.set(alloc.debitNoteLineId, existing);
    }

    const linesByNoteId = new Map<
      string,
      ((typeof allLines)[0] & { shipmentAllocations: typeof allAllocations })[]
    >();
    for (const line of allLines) {
      const lineWithAllocations = {
        ...line,
        shipmentAllocations:
          allocationsByLineId.get(line.debitNoteLineId) || [],
      };
      const existing = linesByNoteId.get(line.debitNoteId) || [];
      existing.push(lineWithAllocations);
      linesByNoteId.set(line.debitNoteId, existing);
    }

    const result = notes.map((dn) => ({
      ...dn,
      lines: linesByNoteId.get(dn.debitNoteId) || [],
    }));

    return result;
  }

  async findOne(id: string) {
    const [dn] = await this.db
      .select({
        debitNoteId: purchaseDebitNotes.debitNoteId,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        supplierReferenceNumber: purchaseDebitNotes.supplierReferenceNumber,
        returnId: purchaseDebitNotes.returnId,
        purchaseOrderId: purchaseDebitNotes.purchaseOrderId,
        vendorId: purchaseDebitNotes.vendorId,
        totalAmount: purchaseDebitNotes.totalAmount,
        taxAmount: purchaseDebitNotes.taxAmount,
        feeAmount: purchaseDebitNotes.feeAmount,
        outstandingAmount: purchaseDebitNotes.outstandingAmount,
        currencyCode: purchaseDebitNotes.currencyCode,
        stateCode: purchaseDebitNotes.stateCode,
        notes: purchaseDebitNotes.notes,
        createdBy: purchaseDebitNotes.createdBy,
        createdOn: purchaseDebitNotes.createdOn,
        modifiedOn: purchaseDebitNotes.modifiedOn,
        orderNumber: purchaseOrders.orderNumber,
        vendorName: actors.name,
      })
      .from(purchaseDebitNotes)
      .leftJoin(
        purchaseOrders,
        eq(purchaseDebitNotes.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(suppliers, eq(purchaseDebitNotes.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(purchaseDebitNotes.debitNoteId, id))
      .limit(1);

    if (!dn) {
      throw new NotFoundException(`Debit Note '${id}' not found`);
    }

    const lines = await this.db
      .select({
        debitNoteLineId: purchaseDebitNoteLines.debitNoteLineId,
        debitNoteId: purchaseDebitNoteLines.debitNoteId,
        purchaseOrderLineId: purchaseDebitNoteLines.purchaseOrderLineId,
        quantityInvoiced: purchaseDebitNoteLines.quantityInvoiced,
        pricePerUnit: purchaseDebitNoteLines.pricePerUnit,
        amount: purchaseDebitNoteLines.amount,
        taxAmount: purchaseDebitNoteLines.taxAmount,
        description: purchaseDebitNoteLines.description,
        productDescription: sql<
          string | null
        >`COALESCE(${purchaseOrderLineItems.productDescription}, ${purchaseDebitNoteLines.description})`,
        productNumber: products.productNumber,
      })
      .from(purchaseDebitNoteLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseDebitNoteLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        products,
        eq(purchaseOrderLineItems.productId, products.productId),
      )
      .where(eq(purchaseDebitNoteLines.debitNoteId, id));

    const linesWithAllocations = [];
    for (const line of lines) {
      const allocations = await this.db
        .select()
        .from(purchaseDebitNoteShipments)
        .where(
          eq(purchaseDebitNoteShipments.debitNoteLineId, line.debitNoteLineId),
        );
      linesWithAllocations.push({
        ...line,
        shipmentAllocations: allocations,
      });
    }

    const events = await this.db
      .select({
        eventId: procurementEvents.eventId,
        eventType: procurementEvents.eventType,
        payload: procurementEvents.payload,
        actor: procurementEvents.actor,
        createdOn: procurementEvents.createdOn,
      })
      .from(procurementEvents)
      .where(
        or(
          eq(procurementEvents.entityId, id),
          sql`${procurementEvents.payload}->>'debitNoteId' = ${id}`,
          sql`${procurementEvents.payload}->>'debitNoteNumber' = ${dn.debitNoteNumber}`,
        ),
      )
      .orderBy(desc(procurementEvents.createdOn));

    return { ...dn, lines: linesWithAllocations, events };
  }

  async createDebitNote(dto: CreateDebitNoteDto, actor: string) {
    if (!dto.returnId) {
      return this.createAdhocDebitNote(dto, actor);
    }

    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, dto.returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode !== PURCHASE_RETURN_STATE.SHIPPED) {
      throw new BadRequestException(
        'Can only create debit notes for SHIPPED returns.',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    if (!po.vendorId) {
      throw new BadRequestException('Purchase Order has no vendor attached.');
    }

    const vendorId = po.vendorId;

    let totalAmount = 0;
    for (const line of dto.lines) {
      totalAmount += parseFloat(line.amount);
    }

    const debitNoteNumber = await this.generateDebitNoteNumber();

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [dn] = await tx
        .insert(purchaseDebitNotes)
        .values({
          debitNoteNumber,
          supplierReferenceNumber: dto.supplierReferenceNumber,
          returnId: dto.returnId,
          purchaseOrderId: ret.purchaseOrderId,
          vendorId: vendorId,
          totalAmount: totalAmount.toFixed(2),
          taxAmount: dto.taxAmount ?? '0',
          feeAmount: dto.feeAmount ?? '0',
          outstandingAmount: totalAmount.toFixed(2),
          currencyCode: po.currencyCode,
          stateCode: PURCHASE_DEBIT_NOTE_STATE.DRAFT,
          notes: dto.notes,
          createdBy: actor,
          baseTotalAmount: '0',
          baseOutstandingAmount: '0',
          exchangeRate: '1',
        })
        .returning();

      const lineValues = dto.lines.map((line) => ({
        debitNoteId: dn.debitNoteId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityInvoiced: line.quantityInvoiced || '1',
        pricePerUnit: line.pricePerUnit || line.amount,
        amount: line.amount,
        taxAmount: line.taxAmount ?? '0',
      }));

      if (lineValues.length > 0) {
        const insertedLines = await tx
          .insert(purchaseDebitNoteLines)
          .values(lineValues)
          .returning();

        const allocationValues = [];
        for (let i = 0; i < dto.lines.length; i++) {
          const inputLine = dto.lines[i];
          const insertedLine = insertedLines[i];
          if (
            inputLine.shipmentAllocations &&
            inputLine.shipmentAllocations.length > 0
          ) {
            for (const alloc of inputLine.shipmentAllocations) {
              allocationValues.push({
                debitNoteLineId: insertedLine.debitNoteLineId,
                shipmentLineId: alloc.shipmentLineId,
                quantityCredited: alloc.quantityCredited,
              });
            }
          }
        }

        if (allocationValues.length > 0) {
          await tx.insert(purchaseDebitNoteShipments).values(allocationValues);
        }
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: ret.purchaseOrderId,
        eventType: EventType.DEBIT_NOTE_CREATED,
        entityDisplayName: po.orderNumber,
        payload: {
          debitNoteId: dn.debitNoteId,
          debitNoteNumber,
          returnId: dto.returnId,
        },
        actor,
      });

      return dn;
    });

    return result;
  }

  private async createAdhocDebitNote(dto: CreateDebitNoteDto, actor: string) {
    if (!dto.vendorId) {
      throw new BadRequestException(
        'vendorId is required for ad-hoc debit notes',
      );
    }
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'lines are required for ad-hoc debit notes',
      );
    }

    const vendorId = dto.vendorId;

    const [suppInfo] = await this.db
      .select({
        vendorId: suppliers.vendorId,
        currencyCode: suppliers.currencyCode,
        costCenterId: supplierGroups.defaultCostCenterId,
        activityId: supplierGroups.defaultActivityId,
        name: actors.name,
      })
      .from(suppliers)
      .leftJoin(
        supplierGroups,
        eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(suppliers.vendorId, vendorId));

    if (!suppInfo) throw new NotFoundException('Supplier not found');

    const currencyCode = suppInfo.currencyCode || this.appConfig.homeCurrency();

    const settings = await this.glService.getSettings(this.db);
    if (!settings?.defaultApAccountId) {
      throw new BadRequestException('GL setting defaultApAccountId is missing');
    }

    const [apAcct] = await this.db
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, settings.defaultApAccountId));

    if (!apAcct) throw new BadRequestException('AP account not found');

    let totalDebitAmount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GL line payload
    const glLines: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Debit note lines
    const dnLineValues: any[] = [];

    for (const line of dto.lines) {
      const amount = parseFloat(line.amount);
      totalDebitAmount += amount;

      dnLineValues.push({
        description: line.description,
        amount: amount.toFixed(2),
        accountId: line.accountId,
        taxCategoryId: line.taxCategoryId ?? null,
        quantityInvoiced: line.quantityInvoiced || '1',
        pricePerUnit: line.pricePerUnit || amount.toFixed(2),
        taxAmount: line.taxAmount ?? '0',
      });

      if (line.accountId) {
        const [acct] = await this.db
          .select()
          .from(glAccounts)
          .where(eq(glAccounts.glAccountId, line.accountId));
        if (!acct)
          throw new BadRequestException(`Account ${line.accountId} not found`);

        glLines.push({
          accountCode: acct.accountCode,
          debit: 0,
          credit: amount,
          memo: line.description || 'Debit note line',
          costCenterId: suppInfo.costCenterId || undefined,
          activityId: suppInfo.activityId || undefined,
        });
      }
    }

    glLines.push({
      accountCode: apAcct.accountCode,
      debit: totalDebitAmount,
      credit: 0,
      memo: dto.notes ?? 'Ad-hoc debit note',
      partyType: 'supplier',
      partyId: vendorId,
      costCenterId: suppInfo.costCenterId || undefined,
      activityId: suppInfo.activityId || undefined,
    });

    const debitNoteNumber = await this.generateDebitNoteNumber();

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [dn] = await tx
        .insert(purchaseDebitNotes)
        .values({
          debitNoteNumber,
          supplierReferenceNumber: dto.supplierReferenceNumber,
          vendorId,
          totalAmount: totalDebitAmount.toFixed(2),
          taxAmount: dto.taxAmount ?? '0',
          feeAmount: dto.feeAmount ?? '0',
          outstandingAmount: totalDebitAmount.toFixed(2),
          currencyCode,
          stateCode: PURCHASE_DEBIT_NOTE_STATE.POSTED,
          notes: dto.notes ?? 'Ad-hoc debit note',
          createdBy: actor,
          baseTotalAmount: '0',
          baseOutstandingAmount: '0',
          exchangeRate: '1',
        })
        .returning();

      if (dnLineValues.length > 0) {
        await tx.insert(purchaseDebitNoteLines).values(
          dnLineValues.map((l) => ({
            debitNoteId: dn.debitNoteId,
            ...l,
          })),
        );
      }

      await this.glService.postJournalEntry(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GL journal lines
        glLines as any,
        {
          sourceType: 'purchase_debit_note',
          sourceId: dn.debitNoteId,
          memo: `Ad-hoc debit note ${debitNoteNumber}`,
          actor,
        },
        tx,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.SUPPLIER,
        entityId: vendorId,
        eventType: EventType.DEBIT_NOTE_POSTED,
        entityDisplayName: suppInfo.name || debitNoteNumber,
        payload: {
          debitNoteId: dn.debitNoteId,
          debitNoteNumber,
          supplierId: vendorId,
          supplierName: suppInfo.name,
          totalDebit: totalDebitAmount.toFixed(2),
        },
        actor,
      });

      return dn;
    });

    return result;
  }

  async postDebitNote(debitNoteId: string, actor: string) {
    const [dn] = await this.db
      .select()
      .from(purchaseDebitNotes)
      .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
      .limit(1);

    if (!dn) throw new NotFoundException('Debit Note not found');
    if (dn.stateCode === PURCHASE_DEBIT_NOTE_STATE.POSTED) {
      throw new BadRequestException('Debit Note is already posted');
    }

    const [po] = dn.purchaseOrderId
      ? await this.db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, dn.purchaseOrderId))
          .limit(1)
      : [null];

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const updated = await this.changeDebitNoteStateInternal(
        debitNoteId,
        PURCHASE_DEBIT_NOTE_STATE.POSTED,
        actor,
        tx,
      );

      const settings = await this.glService.getSettings(tx);
      const apCodeRow = await tx
        .select({ accountCode: glAccounts.accountCode })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, settings?.defaultApAccountId!))
        .limit(1);
      const apCode = apCodeRow[0]?.accountCode;

      const expenseCodeRow = await tx
        .select({ accountCode: glAccounts.accountCode })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, settings?.defaultExpenseAccountId!))
        .limit(1);
      const fallbackExpCode = expenseCodeRow[0]?.accountCode;

      let suppCostCenterId: string | undefined;
      let suppActivityId: string | undefined;
      let supplierName: string | undefined;
      if (po?.vendorId || dn.vendorId) {
        const vendorId = po?.vendorId || dn.vendorId;
        const [supp] = await tx
          .select({
            name: actors.name,
            costCenterId: supplierGroups.defaultCostCenterId,
            activityId: supplierGroups.defaultActivityId,
          })
          .from(suppliers)
          .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
          .leftJoin(
            supplierGroups,
            eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
          )
          .where(eq(suppliers.vendorId, vendorId));
        if (supp) {
          supplierName = supp.name || undefined;
          suppCostCenterId = supp.costCenterId || undefined;
          suppActivityId = supp.activityId || undefined;
        }
      }

      const grniCodeRow = await tx
        .select({ accountCode: glAccounts.accountCode })
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, settings?.defaultGrniAccountId!))
        .limit(1);
      const grniCodeCandidate = grniCodeRow[0]?.accountCode;

      const strategy = getAccountingStrategy(
        this.appConfig.inventoryAccountingMode(),
        {} as InventoryGlAccounts,
      );

      const clearingAccountCode = strategy.resolvePurchaseClearingAccount(
        grniCodeCandidate || null,
        fallbackExpCode || null,
      );

      if (apCode && clearingAccountCode) {
        const glLines = [
          {
            accountCode: apCode,
            debit: Number(dn.totalAmount),
            credit: 0,
            memo: `Debit Note ${dn.debitNoteNumber}`,
            partyType: 'supplier',
            partyId: po?.vendorId || dn.vendorId || undefined,
            costCenterId: suppCostCenterId,
            activityId: suppActivityId,
          },
          {
            accountCode: clearingAccountCode,
            debit: 0,
            credit: Number(dn.totalAmount),
            memo: `Debit Note ${dn.debitNoteNumber}`,
            partyType: 'supplier',
            partyId: po?.vendorId || dn.vendorId || undefined,
            costCenterId: suppCostCenterId,
            activityId: suppActivityId,
          },
        ];

        await this.glService.postJournalEntry(
          glLines as Parameters<GlService['postJournalEntry']>[0],
          {
            actor,
            entryDate: new Date().toISOString().slice(0, 10),
            sourceType: 'purchase_debit_note',
            sourceId: debitNoteId,
            memo: `Supplier Debit Note ${dn.debitNoteNumber}`,
          },
          tx,
        );
      }

      if (po) {
        // @herobm-skip-audit
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: po.purchaseOrderId,
          eventType: EventType.DEBIT_NOTE_POSTED,
          entityDisplayName:
            po.orderNumber || supplierName || dn.debitNoteNumber,
          payload: {
            debitNoteId,
            debitNoteNumber: dn.debitNoteNumber,
            returnId: dn.returnId,
            purchaseOrderId: dn.purchaseOrderId,
            orderNumber: po.orderNumber,
            supplierId: po.vendorId || dn.vendorId,
            supplierName: supplierName || '—',
            totalDebit: dn.totalAmount,
          },
          actor,
        });
      } else {
        // @herobm-skip-audit
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.SUPPLIER,
          entityId: dn.vendorId,
          eventType: EventType.DEBIT_NOTE_POSTED,
          entityDisplayName: supplierName || dn.debitNoteNumber,
          payload: {
            debitNoteId,
            debitNoteNumber: dn.debitNoteNumber,
            returnId: dn.returnId,
            purchaseOrderId: dn.purchaseOrderId,
            orderNumber: undefined,
            supplierId: dn.vendorId,
            supplierName: supplierName || '—',
            totalDebit: dn.totalAmount,
          },
          actor,
        });
      }

      return updated;
    });

    return result;
  }

  async changeDebitNoteState(
    debitNoteId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    if (newState === PURCHASE_DEBIT_NOTE_STATE.POSTED) {
      return this.postDebitNote(debitNoteId, actor);
    }
    return this.changeDebitNoteStateInternal(debitNoteId, newState, actor, tx);
  }

  private async changeDebitNoteStateInternal(
    debitNoteId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const doChange = async (db: DrizzleDB) => {
      if (!VALID_DN_STATES.includes(newState)) {
        throw new BadRequestException(
          `Invalid debit note state: '${newState}'`,
        );
      }

      const [existing] = await db
        .select({
          stateCode: purchaseDebitNotes.stateCode,
          debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
          purchaseOrderId: purchaseDebitNotes.purchaseOrderId,
          vendorId: purchaseDebitNotes.vendorId,
        })
        .from(purchaseDebitNotes)
        .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Debit Note ${debitNoteId} not found`);
      }

      const allowed = PURCHASE_DEBIT_NOTE_TRANSITIONS[existing.stateCode];
      if (!allowed || !allowed.includes(newState)) {
        throw new BadRequestException(
          `Cannot transition debit note from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
        );
      }

      if (newState === PURCHASE_DEBIT_NOTE_STATE.CANCELLED) {
        const [originalEntry] = await db
          .select()
          .from(glJournalEntries)
          .where(
            and(
              eq(glJournalEntries.sourceType, 'purchase_debit_note'),
              eq(glJournalEntries.sourceId, debitNoteId),
            ),
          )
          .limit(1);

        if (originalEntry) {
          const originalLines = await db
            .select()
            .from(glJournalLines)
            .where(
              eq(glJournalLines.journalEntryId, originalEntry.journalEntryId),
            );

          const reversedLines = originalLines.map((line) => ({
            accountId: line.glAccountId,
            debit: parseFloat(line.credit),
            credit: parseFloat(line.debit),
            memo: `Cancellation Reversal: ${line.memo}`,
            costCenterId: line.costCenterId,
            activityId: line.activityId,
            partyType: line.partyType,
            partyId: line.partyId,
          }));

          await this.glService.postJournalEntry(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            reversedLines as any,
            {
              sourceId: debitNoteId,
              sourceType: 'purchase_debit_note',
              memo: `Reversal of Supplier Debit Note ${existing.debitNoteNumber}`,
              entryDate: new Date().toISOString().slice(0, 10),
              actor,
            },
            db,
          );
        }
      }

      const [updated] = await db
        .update(purchaseDebitNotes)
        .set({
          // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-explicit-any -- Dynamic state transition from state machine logic bypasses strict Drizzle schema enums
          stateCode: newState as any,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
        .returning();

      if (existing.purchaseOrderId) {
        const [order] = await db
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, existing.purchaseOrderId));
        await emitEvent(db as unknown as DrizzleDB, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: existing.purchaseOrderId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: order?.orderNumber || existing.debitNoteNumber,
          payload: {
            entity: 'debit_note',
            entityId: debitNoteId,
            debitNoteNumber: existing.debitNoteNumber,
            from: existing.stateCode,
            to: newState,
          },
          actor,
        });
      } else {
        await emitEvent(db as unknown as DrizzleDB, {
          entityType: EntityType.SUPPLIER,
          entityId: existing.vendorId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: existing.debitNoteNumber,
          payload: {
            entity: 'debit_note',
            entityId: debitNoteId,
            debitNoteNumber: existing.debitNoteNumber,
            from: existing.stateCode,
            to: newState,
          },
          actor,
        });
      }

      return updated;
    };

    return tx ? await doChange(tx) : await this.db.transaction(doChange);
  }
}
