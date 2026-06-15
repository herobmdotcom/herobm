import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  suppliers,
  supplierGroups,
} from '../drizzle/herobm-core-schema';
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
import { glAccounts } from '../drizzle/herobm-core-schema';

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
    let q = this.db.select().from(purchaseDebitNotes).$dynamic();

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

    const result = [];
    for (const dn of notes) {
      const lines = await this.db
        .select()
        .from(purchaseDebitNoteLines)
        .where(eq(purchaseDebitNoteLines.debitNoteId, dn.debitNoteId));
      result.push({ ...dn, lines });
    }

    return result;
  }

  async createDebitNote(dto: CreateDebitNoteDto, actor: string) {
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
        })
        .returning();

      const lineValues = dto.lines.map((line) => ({
        debitNoteId: dn.debitNoteId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityInvoiced: line.quantityInvoiced,
        pricePerUnit: line.pricePerUnit,
        amount: line.amount,
        taxAmount: line.taxAmount ?? '0',
      }));

      if (lineValues.length > 0) {
        await tx.insert(purchaseDebitNoteLines).values(lineValues);
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: ret.purchaseOrderId,
        eventType: EventType.CREATED,
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

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, dn.purchaseOrderId))
      .limit(1);

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
      if (po.vendorId) {
        const [supp] = await tx
          .select({
            costCenterId: supplierGroups.defaultCostCenterId,
            activityId: supplierGroups.defaultActivityId,
          })
          .from(suppliers)
          .leftJoin(
            supplierGroups,
            eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
          )
          .where(eq(suppliers.vendorId, po.vendorId));
        if (supp) {
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
            partyId: po.vendorId || undefined,
            costCenterId: suppCostCenterId,
            activityId: suppActivityId,
          },
          {
            accountCode: clearingAccountCode,
            debit: 0,
            credit: Number(dn.totalAmount),
            memo: `Debit Note ${dn.debitNoteNumber}`,
            partyType: 'supplier',
            partyId: po.vendorId || undefined,
            costCenterId: suppCostCenterId,
            activityId: suppActivityId,
          },
        ];

        await this.glService.postJournalEntry(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          glLines as any[],
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
    if (!VALID_DN_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid debit note state: '${newState}'`);
    }

    const db = tx || this.db;
    const [existing] = await db
      .select({
        stateCode: purchaseDebitNotes.stateCode,
        debitNoteNumber: purchaseDebitNotes.debitNoteNumber,
        purchaseOrderId: purchaseDebitNotes.purchaseOrderId,
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

    const [updated] = await db
      .update(purchaseDebitNotes)
      .set({
        // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-explicit-any
        stateCode: newState as any,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
      .returning();

    const [order] = await db
      .select({ orderNumber: purchaseOrders.orderNumber })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, existing.purchaseOrderId));
    await emitEvent(db as unknown as DrizzleDB, {
      entityType: EntityType.PURCHASE_ORDER,
      entityId: existing.purchaseOrderId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: order.orderNumber,
      payload: {
        entity: 'debit_note',
        entityId: debitNoteId,
        debitNoteNumber: existing.debitNoteNumber,
        from: existing.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }
}
