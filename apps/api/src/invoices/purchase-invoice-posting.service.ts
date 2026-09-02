import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrderLineItems,
  suppliers,
  supplierGroups,
  products as coreProducts,
  productGroups,
  glAccounts,
  goodsReceivedLines,
  purchaseInvoiceReceipts,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { evaluatePOLifecycleRules } from '../purchase-orders/purchase-order-lifecycle-rules';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';

import {
  computeLinePriceForStorage,
  PURCHASE_INVOICE_STATE,
  MATCH_STATUS,
  LineType,
  JOURNAL_ENTRY_SOURCE_TYPE,
} from '@herobm/shared';
import { resolveGlDimensions } from '../common/utils/gl-resolution.util';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import type { InventoryGlAccounts } from '../inventory/inventory-accounting';
import { PurchaseInvoiceCoreService } from './purchase-invoice-core.service';

@Injectable()
export class PurchaseInvoicePostingService {
  private readonly logger = new Logger(PurchaseInvoicePostingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly core: PurchaseInvoiceCoreService,
  ) {}

  /**
   * Posts a draft invoice, validates totals, and creates the GL entries.
   */
  async postInvoice(invoiceId: string, actor: string, outerTx?: DrizzleDB) {
    const queryDb = outerTx ?? this.db;
    const [invoice] = await queryDb
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId));
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
      throw new BadRequestException('Only draft invoices can be posted');

    const lines = await queryDb
      .select({
        line: purchaseInvoiceLines,
        poProductId: purchaseOrderLineItems.productId,
        productExpenseAccountId: productGroups.defaultExpenseAccountId,
        productCostCenterId: productGroups.defaultCostCenterId,
        productActivityId: productGroups.defaultActivityId,
      })
      .from(purchaseInvoiceLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(
          coreProducts.productId,
          purchaseInvoiceLines.productId || purchaseOrderLineItems.productId,
        ),
      )
      .leftJoin(
        productGroups,
        eq(coreProducts.productGroupId, productGroups.productGroupId),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    const receipts = await queryDb
      .select({
        invoiceLineId: purchaseInvoiceReceipts.invoiceLineId,
        quantityBilled: purchaseInvoiceReceipts.quantityBilled,
        unitCost: goodsReceivedLines.unitCost,
        poExchangeRate: purchaseOrders.exchangeRate,
      })
      .from(purchaseInvoiceReceipts)
      .innerJoin(
        goodsReceivedLines,
        eq(
          purchaseInvoiceReceipts.goodsReceivedLineId,
          goodsReceivedLines.goodsReceivedLineId,
        ),
      )
      .innerJoin(
        purchaseInvoiceLines,
        eq(
          purchaseInvoiceReceipts.invoiceLineId,
          purchaseInvoiceLines.invoiceLineId,
        ),
      )
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    const receiptCosts = new Map<string, { cost: number; poRate: number }>();
    for (const r of receipts) {
      const q = parseFloat(r.quantityBilled);
      const c = parseFloat(r.unitCost || '0');
      const poRate = parseFloat(r.poExchangeRate || '1');
      const existing = receiptCosts.get(r.invoiceLineId) || {
        cost: 0,
        poRate: 1,
      };
      receiptCosts.set(r.invoiceLineId, {
        cost: existing.cost + q * c,
        poRate: poRate,
      });
    }

    let lineTotalForeign = 0;
    const expenseGroups = new Map<
      string,
      {
        foreignAmount: number;
        baseAmount: number;
        accountId: string;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const grniGroups = new Map<
      string,
      {
        baseAmount: number;
        foreignAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const defaultExpenseGroups = new Map<
      string,
      {
        foreignAmount: number;
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const ppvGroups = new Map<
      string,
      {
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();
    const fxVarianceGroups = new Map<
      string,
      {
        baseAmount: number;
        costCenterId: string | null;
        activityId: string | null;
      }
    >();

    const invoiceRate = parseFloat(invoice.exchangeRate || '1');

    for (const row of lines) {
      const {
        line,
        poProductId,
        productExpenseAccountId,
        productCostCenterId,
        productActivityId,
      } = row;
      if (line.matchStatus !== MATCH_STATUS.MATCHED && !line.glAccountId) {
        throw new BadRequestException(
          `Line "${line.description}" is unmatched and must have a GL Customer assigned before finalisation.`,
        );
      }

      const foreignAmt = parseFloat(line.amount);
      const baseAmt = foreignAmt * invoiceRate;
      lineTotalForeign += foreignAmt;

      // Extract CC/Activity from product
      const productDims = {
        accountId: productExpenseAccountId || null,
        costCenterId: productCostCenterId || null,
        activityId: productActivityId || null,
      };

      const acctId = line.glAccountId;
      if (acctId) {
        // Line has specific account
        const key = `${acctId}|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = expenseGroups.get(key);
        if (current) {
          current.foreignAmount += foreignAmt;
          current.baseAmount += baseAmt;
        } else {
          expenseGroups.set(key, {
            foreignAmount: foreignAmt,
            baseAmount: baseAmt,
            accountId: acctId,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }
      } else if (line.matchStatus === MATCH_STATUS.MATCHED && poProductId) {
        const rc = receiptCosts.get(line.invoiceLineId) || {
          cost: 0,
          poRate: 1,
        };
        const receiptCostBase = rc.cost;
        const poRate = rc.poRate;

        const foreignCost = receiptCostBase / poRate;
        const tradeVarianceBase = baseAmt - foreignCost * invoiceRate;
        const fxVarianceBase = foreignCost * invoiceRate - receiptCostBase;

        // GRNI Clearance
        const key = `GRNI|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = grniGroups.get(key);
        if (current) {
          current.baseAmount += receiptCostBase;
          current.foreignAmount += foreignCost;
        } else {
          grniGroups.set(key, {
            baseAmount: receiptCostBase,
            foreignAmount: foreignCost,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }

        // PPV (Trade Variance)
        if (Math.abs(tradeVarianceBase) > 0.005) {
          const ppvKey = `PPV|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
          const ppvCurrent = ppvGroups.get(ppvKey);
          if (ppvCurrent) {
            ppvCurrent.baseAmount += tradeVarianceBase;
          } else {
            ppvGroups.set(ppvKey, {
              baseAmount: tradeVarianceBase,
              costCenterId: productDims.costCenterId,
              activityId: productDims.activityId,
            });
          }
        }

        // FX Variance
        if (Math.abs(fxVarianceBase) > 0.005) {
          const fxKey = `FX|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
          const fxCurrent = fxVarianceGroups.get(fxKey);
          if (fxCurrent) {
            fxCurrent.baseAmount += fxVarianceBase;
          } else {
            fxVarianceGroups.set(fxKey, {
              baseAmount: fxVarianceBase,
              costCenterId: productDims.costCenterId,
              activityId: productDims.activityId,
            });
          }
        }
      } else {
        // Default Expense
        const key = `DEF|${productDims.costCenterId || ''}|${productDims.activityId || ''}`;
        const current = defaultExpenseGroups.get(key);
        if (current) {
          current.foreignAmount += foreignAmt;
          current.baseAmount += baseAmt;
        } else {
          defaultExpenseGroups.set(key, {
            foreignAmount: foreignAmt,
            baseAmount: baseAmt,
            costCenterId: productDims.costCenterId,
            activityId: productDims.activityId,
          });
        }
      }
    }

    const headerTotalForeign = parseFloat(invoice.totalAmount || '0');
    const taxAmountForeign = parseFloat(invoice.taxAmount || '0');
    const taxAmountBase = taxAmountForeign * invoiceRate;
    const expectedHeaderForeign = lineTotalForeign + taxAmountForeign;

    if (Math.abs(headerTotalForeign - expectedHeaderForeign) > 0.01) {
      throw new BadRequestException(
        `Invoice totals mismatch. Header: ${headerTotalForeign.toFixed(2)}, Lines+Tax: ${expectedHeaderForeign.toFixed(2)}`,
      );
    }

    // Verify Vendor default AP / Expense Customers + Dimensions
    const [supp] = await queryDb
      .select({
        vendorId: suppliers.vendorId,
        defaultApAccountId: supplierGroups.defaultApAccountId,
        defaultExpenseAccountId: supplierGroups.defaultExpenseAccountId,
        supplierCostCenterId: supplierGroups.defaultCostCenterId,
        supplierActivityId: supplierGroups.defaultActivityId,
      })
      .from(suppliers)
      .leftJoin(
        supplierGroups,
        eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .where(eq(suppliers.vendorId, invoice.vendorId));
    const supplierApAccountId = supp?.defaultApAccountId;
    const supplierExpenseAccountId = supp?.defaultExpenseAccountId;
    const supplierCostCenterId = supp?.supplierCostCenterId || null;
    const supplierActivityId = supp?.supplierActivityId || null;

    // GL Posting + State Update (atomic transaction)
    const executePost = async (tx: DrizzleDB) => {
      const settings = await this.glService.getSettings(tx);
      const effectiveApAccountId =
        supplierApAccountId || settings?.defaultApAccountId;

      if (effectiveApAccountId) {
        const distinctAccountIds = new Set<string>();
        distinctAccountIds.add(effectiveApAccountId);
        if (settings?.defaultPurchaseTaxAccountId)
          distinctAccountIds.add(settings.defaultPurchaseTaxAccountId);
        if (settings?.defaultExpenseAccountId)
          distinctAccountIds.add(settings.defaultExpenseAccountId);
        if (settings?.defaultGrniAccountId)
          distinctAccountIds.add(settings.defaultGrniAccountId);
        if (settings?.defaultPpvAccountId)
          distinctAccountIds.add(settings.defaultPpvAccountId);
        if (settings?.realisedFxGainAccountId)
          distinctAccountIds.add(settings.realisedFxGainAccountId);
        if (settings?.realisedFxLossAccountId)
          distinctAccountIds.add(settings.realisedFxLossAccountId);
        if (supplierExpenseAccountId)
          distinctAccountIds.add(supplierExpenseAccountId);
        for (const group of expenseGroups.values())
          distinctAccountIds.add(group.accountId);

        const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

        if (settingsIds.length > 0) {
          const acctRows = await tx
            .select({
              glAccountId: glAccounts.glAccountId,
              accountCode: glAccounts.accountCode,
            })
            .from(glAccounts)
            .where(inArray(glAccounts.glAccountId, settingsIds));

          const idToCode = new Map(
            acctRows.map((a) => [a.glAccountId, a.accountCode]),
          );

          const apCode = idToCode.get(effectiveApAccountId);
          // If no specific line expense, fallback to supplier's default expense, or system default
          const fallbackExpCode =
            (supplierExpenseAccountId &&
              idToCode.get(supplierExpenseAccountId)) ||
            (settings.defaultExpenseAccountId &&
              idToCode.get(settings.defaultExpenseAccountId));

          const strategy = getAccountingStrategy(
            this.appConfig.inventoryAccountingMode(),
            {} as InventoryGlAccounts,
          );

          const grniCode = strategy.resolvePurchaseClearingAccount(
            settings.defaultGrniAccountId
              ? idToCode.get(settings.defaultGrniAccountId)
              : null,
            fallbackExpCode,
          );

          const taxCode = settings.defaultPurchaseTaxAccountId
            ? idToCode.get(settings.defaultPurchaseTaxAccountId)
            : null;

          const ppvCode = settings?.defaultPpvAccountId
            ? idToCode.get(settings.defaultPpvAccountId)
            : null;

          const fxGainCode = settings?.realisedFxGainAccountId
            ? idToCode.get(settings.realisedFxGainAccountId)
            : null;
          const fxLossCode = settings?.realisedFxLossAccountId
            ? idToCode.get(settings.realisedFxLossAccountId)
            : null;

          if (apCode) {
            const glLines: Parameters<GlService['postJournalEntry']>[0] = [];

            const sysDefaultCC = this.appConfig.defaultCostCenterId();
            const sysDefaultAct = this.appConfig.defaultActivityId();
            const supplierDims = {
              costCenterId: supplierCostCenterId,
              activityId: supplierActivityId,
            };
            const isSuppFirst =
              this.appConfig.expenseRoutingPrecedence() === 'supplier_first';

            for (const group of defaultExpenseGroups.values()) {
              if (group.baseAmount > 0 && fallbackExpCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: fallbackExpCode,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate,
                  memo: `Expense (Default): ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of grniGroups.values()) {
              if (group.baseAmount > 0 && grniCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: grniCode,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate, // Approx for reporting
                  memo: `GRNI Clearance: ${invoice.invoiceNumber}`,
                  partyId: invoice.vendorId,
                  partyType: 'supplier',
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of ppvGroups.values()) {
              if (Math.abs(group.baseAmount) > 0.005 && ppvCode) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: ppvCode,
                  debit: group.baseAmount > 0 ? group.baseAmount : 0,
                  credit: group.baseAmount < 0 ? Math.abs(group.baseAmount) : 0,
                  foreignDebit: 0,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: 1,
                  memo: `Purchase Price Variance: ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of fxVarianceGroups.values()) {
              if (Math.abs(group.baseAmount) > 0.005) {
                const isGain = group.baseAmount < 0; // Credit = Gain
                const targetCode = isGain ? fxGainCode : fxLossCode;
                if (!targetCode) {
                  throw new BadRequestException(
                    'Realised FX Gain/Loss accounts are not configured in GL Settings.',
                  );
                }
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? supplierDims : prodDims,
                  isSuppFirst ? prodDims : supplierDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                  },
                );
                glLines.push({
                  accountCode: targetCode,
                  debit: !isGain ? group.baseAmount : 0,
                  credit: isGain ? Math.abs(group.baseAmount) : 0,
                  foreignDebit: 0,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: 1,
                  memo: `Realised FX Variance (GRNI): ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            for (const group of expenseGroups.values()) {
              let code = idToCode.get(group.accountId);
              if (!code && fallbackExpCode) {
                code = fallbackExpCode;
              }

              if (!code && group.baseAmount > 0) {
                throw new BadRequestException(
                  `Cannot create purchase bill: Expense account '${group.accountId}' not found in Chart of Accounts, and Default Expense account is not configured in GL Settings. Please configure it in Admin → Settings → Financial.`,
                );
              }

              if (code && group.baseAmount > 0) {
                const prodDims = {
                  costCenterId: group.costCenterId,
                  activityId: group.activityId,
                  accountId: group.accountId,
                };
                const suppDims = {
                  costCenterId: supplierCostCenterId,
                  activityId: supplierActivityId,
                  accountId: supplierExpenseAccountId,
                };
                const dims = resolveGlDimensions(
                  isSuppFirst ? suppDims : prodDims,
                  isSuppFirst ? prodDims : suppDims,
                  {
                    defaultCostCenterId: sysDefaultCC,
                    defaultActivityId: sysDefaultAct,
                    defaultAccountId: settings.defaultExpenseAccountId,
                  },
                );
                glLines.push({
                  accountCode: code,
                  debit: group.baseAmount,
                  credit: 0,
                  foreignDebit: group.foreignAmount,
                  foreignCredit: 0,
                  foreignCurrencyCode: invoice.currencyCode,
                  exchangeRate: invoiceRate,
                  memo: `Expense: ${invoice.invoiceNumber}`,
                  costCenterId: dims.costCenterId || undefined,
                  activityId: dims.activityId || undefined,
                });
              }
            }

            if (taxCode && taxAmountBase > 0) {
              glLines.push({
                accountCode: taxCode,
                debit: taxAmountBase,
                credit: 0,
                foreignDebit: taxAmountForeign,
                foreignCredit: 0,
                foreignCurrencyCode: invoice.currencyCode,
                exchangeRate: invoiceRate,
                memo: `Tax: ${invoice.invoiceNumber}`,
              });
            }

            // AP Credit
            const apDims = resolveGlDimensions(supplierDims, supplierDims, {
              defaultCostCenterId: sysDefaultCC,
              defaultActivityId: sysDefaultAct,
            });

            // Rebalance AP Base vs Debits
            const totalDebits = glLines.reduce(
              (sum, l) => sum + Number(l.debit || 0),
              0,
            );
            const totalCreditsExclAp = glLines.reduce(
              (sum, l) => sum + Number(l.credit || 0),
              0,
            );
            const apBaseCredit = totalDebits - totalCreditsExclAp;

            glLines.push({
              accountCode: apCode,
              debit: 0,
              credit: apBaseCredit,
              foreignDebit: 0,
              foreignCredit: headerTotalForeign,
              foreignCurrencyCode: invoice.currencyCode,
              exchangeRate: invoiceRate,
              memo: `Accounts Payable: ${invoice.invoiceNumber}`,
              partyId: invoice.vendorId,
              partyType: 'supplier',
              costCenterId: apDims.costCenterId || undefined,
              activityId: apDims.activityId || undefined,
            });

            if (headerTotalForeign > 0) {
              if (glLines.length < 2) {
                throw new BadRequestException(
                  'Cannot create purchase bill: Failed to construct balancing GL journal entry lines. Please verify that Default Accounts Payable, Default Expense, and Default Purchase Tax accounts are configured in Admin → Settings → Financial.',
                );
              }

              await this.glService.postJournalEntry(
                glLines,
                {
                  sourceType: JOURNAL_ENTRY_SOURCE_TYPE.PURCHASE_INVOICE,
                  sourceId: invoice.invoiceId,
                  memo: `Purchase Invoice ${invoice.invoiceNumber}`,
                  actor,
                },
                tx,
              );
            }
          }
        }
      }

      // Mark as invoiced (atomic with GL posting)
      await this.core.changePurchaseInvoiceStateInternal(
        invoiceId,
        PURCHASE_INVOICE_STATE.INVOICED,
        actor,
        tx,
      );

      if (invoice.purchaseOrderId) {
        await evaluatePOLifecycleRules(
          tx,
          invoice.purchaseOrderId,
          { entity: 'purchase_invoice', action: 'posted' },
          actor,
        );
      }

      return this.core.findOne(invoiceId, tx);
    };

    const updatedInvoice = outerTx
      ? await executePost(outerTx)
      : await this.db.transaction(executePost);

    // Trigger lifecycle rules for affected POs (non-fatal side effect)
    const affectedPoIds = [
      ...new Set(
        (
          (invoice as unknown as { lines?: { purchaseOrderId?: string }[] })
            .lines || []
        )
          .map((l) => l.purchaseOrderId)
          .filter(Boolean),
      ),
    ] as string[];

    for (const poId of affectedPoIds) {
      try {
        await evaluatePOLifecycleRules(
          this.db,
          poId,
          {
            entity: 'purchase_invoice',
            action: 'posted',
            id: invoiceId,
          },
          actor,
        );
      } catch (err) {
        this.logger.error(
          `Failed to evaluate PO lifecycle rules for PO ${poId} after invoice posting:`,
          err,
        );
      }
    }

    return updatedInvoice;
  }

  /**
   * Allocates/matches an existing invoice line to a PO line.
   */
  async resolveInvoiceLine(
    invoiceLineId: string,
    purchaseOrderLineId: string,
    actor: string,
    outerTx?: DrizzleDB,
  ) {
    const executeResolve = async (tx: DrizzleDB) => {
      const [line] = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));
      if (!line) throw new NotFoundException('Invoice line not found');

      const [poLine] = await tx
        .select()
        .from(purchaseOrderLineItems)
        .where(
          eq(purchaseOrderLineItems.purchaseOrderLineId, purchaseOrderLineId),
        );
      if (!poLine) throw new NotFoundException('PO line not found');

      await tx
        .update(purchaseInvoiceLines)
        .set({
          purchaseOrderLineId,
          productId: poLine.productId,
          matchStatus: MATCH_STATUS.MATCHED,
        })
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      const [order] = await tx
        .select({ orderNumber: purchaseOrders.orderNumber })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseOrderId, poLine.purchaseOrderId));
      await emitEvent(tx, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: poLine.purchaseOrderId,
        eventType: EventType.INVOICE_MATCHED,
        entityDisplayName: order.orderNumber,
        actor,
        payload: {
          invoiceLineId,
          purchaseOrderLineId,
          invoiceId: line.invoiceId,
        },
      });

      return { success: true };
    };

    return outerTx
      ? await executeResolve(outerTx)
      : await this.db.transaction(executeResolve);
  }

  /**
   * Auto-matches unbilled lines from a given PO to this invoice.
   */
  async autoMatchPurchaseOrder(
    invoiceId: string,
    purchaseOrderId: string,
    actor: string,
    outerTx?: DrizzleDB,
  ) {
    const executeAutoMatch = async (tx: DrizzleDB) => {
      const [invoice] = await tx
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId));
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.stateCode !== PURCHASE_INVOICE_STATE.DRAFT)
        throw new BadRequestException(
          'Only draft invoices can be auto-matched',
        );

      // 1. Fetch PO Lines
      const poLines = await tx
        .select()
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

      // 2. Fetch existing unmatched invoice lines
      const invLines = await tx
        .select()
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

      let matchedCount = 0;
      let addedCount = 0;
      const newInvoiceLines: (typeof purchaseInvoiceLines.$inferInsert)[] = [];

      for (const poLine of poLines) {
        if (poLine.lineType === (LineType.COMMENT as string)) {
          continue;
        }

        // Find if we already have an unmatched invoice line for this product
        const match = invLines.find(
          (l) =>
            l.matchStatus === MATCH_STATUS.UNMATCHED &&
            l.productId === poLine.productId,
        );

        if (match) {
          await tx
            .update(purchaseInvoiceLines)
            .set({
              purchaseOrderLineId: poLine.purchaseOrderLineId,
              matchStatus: MATCH_STATUS.MATCHED,
            })
            .where(eq(purchaseInvoiceLines.invoiceLineId, match.invoiceLineId));
          match.matchStatus = MATCH_STATUS.MATCHED; // Prevent mapping to this line again
          matchedCount++;
        } else {
          // Add it as a new matched line
          const qty = parseFloat(poLine.quantity || '0');
          const price = parseFloat(poLine.pricePerUnit || '0');
          const pricing = computeLinePriceForStorage({
            quantity: qty,
            pricePerUnit: price,
          });

          newInvoiceLines.push({
            invoiceLineId: randomUUID(),
            invoiceId,
            description: poLine.productDescription || '',
            productId: poLine.productId,
            glAccountId: null,
            quantityInvoiced: String(qty),
            pricePerUnit: String(price),
            amount: pricing.amount,
            purchaseOrderLineId: poLine.purchaseOrderLineId,
            matchStatus: MATCH_STATUS.MATCHED,
          });
          addedCount++;
        }
      }

      if (newInvoiceLines.length > 0) {
        await tx.insert(purchaseInvoiceLines).values(newInvoiceLines);
      }

      await this.core.recalculateInvoiceTotals(invoiceId, tx);

      if (matchedCount > 0 || addedCount > 0) {
        const [order] = await tx
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId));
        await emitEvent(tx, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: purchaseOrderId,
          eventType: EventType.INVOICE_MATCHED,
          entityDisplayName: order.orderNumber,
          actor,
          payload: {
            invoiceId,
            matchedCount,
            addedCount,
          },
        });
      }

      return { success: true, matchedCount, addedCount };
    };

    return outerTx
      ? await executeAutoMatch(outerTx)
      : await this.db.transaction(executeAutoMatch);
  }

  /**
   * Un-matches an invoice line.
   */
  async unresolveInvoiceLine(
    invoiceLineId: string,
    actor: string,
    outerTx?: DrizzleDB,
  ) {
    const executeUnresolve = async (tx: DrizzleDB) => {
      const [line] = await tx
        .select({
          invoiceId: purchaseInvoiceLines.invoiceId,
          purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        })
        .from(purchaseInvoiceLines)
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      if (!line) throw new NotFoundException('Invoice line not found');

      let poId: string | null = null;
      if (line.purchaseOrderLineId) {
        const [poLine] = await tx
          .select({ purchaseOrderId: purchaseOrderLineItems.purchaseOrderId })
          .from(purchaseOrderLineItems)
          .where(
            eq(
              purchaseOrderLineItems.purchaseOrderLineId,
              line.purchaseOrderLineId,
            ),
          );
        if (poLine) poId = poLine.purchaseOrderId;
      }

      await tx
        .update(purchaseInvoiceLines)
        .set({
          purchaseOrderLineId: null,
          matchStatus: MATCH_STATUS.UNMATCHED,
        })
        .where(eq(purchaseInvoiceLines.invoiceLineId, invoiceLineId));

      if (poId) {
        const [order] = await tx
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, poId));
        await emitEvent(tx, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: poId,
          eventType: EventType.INVOICE_UNMATCHED,
          entityDisplayName: order.orderNumber,
          actor,
          payload: {
            invoiceLineId,
            invoiceId: line.invoiceId,
          },
        });
      }

      return { success: true };
    };

    return outerTx
      ? await executeUnresolve(outerTx)
      : await this.db.transaction(executeUnresolve);
  }
}
