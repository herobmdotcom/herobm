import { BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * GL account IDs required for perpetual inventory accounting.
 * Loaded once from AppConfigService and injected into the strategy.
 */
export interface InventoryGlAccounts {
  inventoryAccountId: string | null;
  grniAccountId: string | null;
  cogsAccountId: string | null;
  shrinkageAccountId: string | null;
}

/**
 * Context passed to each strategy method — the minimum information
 * needed to construct a balanced journal entry.
 */
export interface GlPostingContext {
  /** Absolute monetary value of the inventory movement (always positive). */
  amount: number;
  /** Human-readable memo for the journal entry and each line. */
  memo: string;
  /** Supplier or customer party reference for sub-ledger tagging. */
  partyType?: 'supplier' | 'customer';
  partyId?: string;
  /** Financial dimension: Cost Center (resolved from groups at posting time). */
  costCenterId?: string;
  /** Financial dimension: Activity (resolved from groups at posting time). */
  activityId?: string;
}

/**
 * A single line in a journal entry, ready to pass to GlService.postJournalEntry.
 */
export interface InventoryGlLine {
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
  partyType?: 'supplier' | 'customer';
  partyId?: string;
  costCenterId?: string;
  activityId?: string;
}

/**
 * Result from a strategy method. Contains the journal lines and the
 * sourceType tag for the journal entry header.
 */
export interface InventoryGlResult {
  lines: InventoryGlLine[];
  sourceType:
    | 'inventory_receipt'
    | 'inventory_dispatch'
    | 'inventory_adjustment';
}

// ---------------------------------------------------------------------------
// Strategy Interface
// ---------------------------------------------------------------------------

/**
 * Inventory Accounting Strategy.
 *
 * Mirrors the ValuationStrategy pattern in valuation.ts.
 * Each method corresponds to a physical stock action that may or may not
 * have financial (GL) implications depending on the accounting mode.
 *
 * Returns InventoryGlResult when a journal entry should be posted,
 * or null when the action has no financial impact.
 */
export interface InventoryAccountingStrategy {
  /** Goods received from supplier → DR Inventory, CR GRNI */
  onGoodsReceipt(ctx: GlPostingContext): InventoryGlResult | null;

  /** Goods dispatched to customer → DR COGS, CR Inventory */
  onGoodsDispatch(ctx: GlPostingContext): InventoryGlResult | null;

  /** Dispatch reversal (shipment reverted) → DR Inventory, CR COGS */
  onDispatchReversal(ctx: GlPostingContext): InventoryGlResult | null;

  /**
   * Manual inventory adjustment (cycle count / discrepancy).
   * @param direction 'loss' = stock decreased, 'gain' = stock increased
   */
  onManualAdjustment(
    ctx: GlPostingContext,
    direction: 'loss' | 'gain',
  ): InventoryGlResult | null;

  /** Sales return received from customer → DR Inventory, CR COGS */
  onSalesReturn(ctx: GlPostingContext): InventoryGlResult | null;

  /** Supplier return dispatched → DR GRNI, CR Inventory */
  onSupplierReturn(ctx: GlPostingContext): InventoryGlResult | null;
}

// ---------------------------------------------------------------------------
// Periodic Strategy — No GL impact
// ---------------------------------------------------------------------------

class PeriodicAccountingStrategy implements InventoryAccountingStrategy {
  onGoodsReceipt(): null {
    return null;
  }
  onGoodsDispatch(): null {
    return null;
  }
  onDispatchReversal(): null {
    return null;
  }
  onManualAdjustment(): null {
    return null;
  }
  onSalesReturn(): null {
    return null;
  }
  onSupplierReturn(): null {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Perpetual Strategy — Full GL integration
// ---------------------------------------------------------------------------

class PerpetualAccountingStrategy implements InventoryAccountingStrategy {
  constructor(private readonly accts: InventoryGlAccounts) {}

  private requireAccount(id: string | null, label: string): string {
    if (!id) {
      throw new BadRequestException(
        `Perpetual inventory requires the default ${label} account to be configured.`,
      );
    }
    return id;
  }

  onGoodsReceipt(ctx: GlPostingContext): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    const grni = this.requireAccount(this.accts.grniAccountId, 'GRNI');
    return {
      sourceType: 'inventory_receipt',
      lines: [
        {
          accountId: inv,
          debit: ctx.amount,
          credit: 0,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
        {
          accountId: grni,
          debit: 0,
          credit: ctx.amount,
          memo: ctx.memo,
          partyType: ctx.partyType,
          partyId: ctx.partyId,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
      ],
    };
  }

  onGoodsDispatch(ctx: GlPostingContext): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const cogs = this.requireAccount(this.accts.cogsAccountId, 'COGS');
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    return {
      sourceType: 'inventory_dispatch',
      lines: [
        {
          accountId: cogs,
          debit: ctx.amount,
          credit: 0,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
        {
          accountId: inv,
          debit: 0,
          credit: ctx.amount,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
      ],
    };
  }

  onDispatchReversal(ctx: GlPostingContext): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    const cogs = this.requireAccount(this.accts.cogsAccountId, 'COGS');
    return {
      sourceType: 'inventory_dispatch',
      lines: [
        {
          accountId: inv,
          debit: ctx.amount,
          credit: 0,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
        {
          accountId: cogs,
          debit: 0,
          credit: ctx.amount,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
      ],
    };
  }

  onManualAdjustment(
    ctx: GlPostingContext,
    direction: 'loss' | 'gain',
  ): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    const shrink = this.requireAccount(
      this.accts.shrinkageAccountId,
      'Shrinkage',
    );

    if (direction === 'loss') {
      // Stock decreased: DR Shrinkage Expense, CR Inventory Asset
      return {
        sourceType: 'inventory_adjustment',
        lines: [
          {
            accountId: shrink,
            debit: ctx.amount,
            credit: 0,
            memo: ctx.memo,
            costCenterId: ctx.costCenterId,
            activityId: ctx.activityId,
          },
          {
            accountId: inv,
            debit: 0,
            credit: ctx.amount,
            memo: ctx.memo,
            costCenterId: ctx.costCenterId,
            activityId: ctx.activityId,
          },
        ],
      };
    } else {
      // Stock increased: DR Inventory Asset, CR Shrinkage Expense
      return {
        sourceType: 'inventory_adjustment',
        lines: [
          {
            accountId: inv,
            debit: ctx.amount,
            credit: 0,
            memo: ctx.memo,
            costCenterId: ctx.costCenterId,
            activityId: ctx.activityId,
          },
          {
            accountId: shrink,
            debit: 0,
            credit: ctx.amount,
            memo: ctx.memo,
            costCenterId: ctx.costCenterId,
            activityId: ctx.activityId,
          },
        ],
      };
    }
  }

  onSalesReturn(ctx: GlPostingContext): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    const cogs = this.requireAccount(this.accts.cogsAccountId, 'COGS');
    // Customer returned goods: DR Inventory Asset, CR COGS (cost reversal)
    return {
      sourceType: 'inventory_adjustment',
      lines: [
        {
          accountId: inv,
          debit: ctx.amount,
          credit: 0,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
        {
          accountId: cogs,
          debit: 0,
          credit: ctx.amount,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
      ],
    };
  }

  onSupplierReturn(ctx: GlPostingContext): InventoryGlResult | null {
    if (ctx.amount <= 0) return null;
    const grni = this.requireAccount(this.accts.grniAccountId, 'GRNI');
    const inv = this.requireAccount(
      this.accts.inventoryAccountId,
      'Inventory Asset',
    );
    // Returning goods to supplier: DR GRNI, CR Inventory Asset
    return {
      sourceType: 'inventory_receipt',
      lines: [
        {
          accountId: grni,
          debit: ctx.amount,
          credit: 0,
          memo: ctx.memo,
          partyType: ctx.partyType,
          partyId: ctx.partyId,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
        {
          accountId: inv,
          debit: 0,
          credit: ctx.amount,
          memo: ctx.memo,
          costCenterId: ctx.costCenterId,
          activityId: ctx.activityId,
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Factory — mirrors getValuationStrategy() pattern
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate accounting strategy based on the configured mode.
 *
 * Usage:
 * ```
 * const strategy = getAccountingStrategy(
 *   this.appConfig.inventoryAccountingMode(),
 *   {
 *     inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
 *     grniAccountId:      this.appConfig.defaultGrniAccountId(),
 *     cogsAccountId:      this.appConfig.defaultCogsAccountId(),
 *     shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
 *   },
 * );
 * ```
 */
export function getAccountingStrategy(
  mode: string | undefined,
  accounts: InventoryGlAccounts,
): InventoryAccountingStrategy {
  const normalised = (mode || 'periodic').toLowerCase();
  if (normalised === 'perpetual') {
    return new PerpetualAccountingStrategy(accounts);
  }
  return new PeriodicAccountingStrategy();
}
