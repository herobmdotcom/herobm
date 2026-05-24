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
  purchaseOrderEvents,
  suppliers,
  supplierGroups,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { CreateDebitNoteDto } from './dto';
import {
  PURCHASE_RETURN_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getAccountingStrategy } from '../inventory/inventory-accounting';

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

      await tx.insert(purchaseOrderEvents).values({
        purchaseOrderId: ret.purchaseOrderId,
        eventType: EventType.CREATED,
        actor,
        payload: {
          debitNoteId: dn.debitNoteId,
          debitNoteNumber,
          returnId: dto.returnId,
        },
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
      const [updated] = await tx
        .update(purchaseDebitNotes)
        .set({
          stateCode: PURCHASE_DEBIT_NOTE_STATE.POSTED,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseDebitNotes.debitNoteId, debitNoteId))
        .returning();

      // --- Financial Integration: Post Debit Note GL ---
      const accountingStrategy = getAccountingStrategy(
        this.appConfig.inventoryAccountingMode(),
        {
          inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
          grniAccountId: this.appConfig.defaultGrniAccountId(),
          cogsAccountId: this.appConfig.defaultCogsAccountId(),
          shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
        },
      );

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

      // We debit Accounts Payable (reduce liability) and credit GRNI or Inventory.
      // Note: accountingStrategy.onSupplierReturn creates this GL structure.
      const supplierReturnGl = accountingStrategy.onSupplierReturn({
        amount: Number(dn.totalAmount),
        memo: `Debit Note ${dn.debitNoteNumber}`,
        partyType: 'supplier',
        partyId: po.vendorId || undefined,
        costCenterId: suppCostCenterId,
        activityId: suppActivityId,
      });

      if (supplierReturnGl) {
        await this.glService.postJournalEntry(
          supplierReturnGl.lines as any,
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

      await emitEvent(tx as any, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        payload: {
          entity: 'debit_note',
          entityId: debitNoteId,
          debitNoteNumber: dn.debitNoteNumber,
          from: dn.stateCode,
          to: PURCHASE_DEBIT_NOTE_STATE.POSTED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }
}
