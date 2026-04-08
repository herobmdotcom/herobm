import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { glSettings, appSettings } from '../drizzle/modbm-core-schema';
import type {
  RevenueRoutingStrategy,
  ExpenseRoutingStrategy,
} from '@modbm/shared';

/**
 * Boot-time settings cache.
 *
 * Loads gl_settings and app_settings once at API startup into memory.
 * All services read from this cache — zero additional DB queries per request.
 *
 * Call `reload()` after setup completes or when admin changes settings.
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly logger = new Logger(AppConfigService.name);

  // GL settings cache
  private glCache: typeof glSettings.$inferSelect | null = null;
  // App settings cache
  private appCache: typeof appSettings.$inferSelect | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Reload settings from the database into memory.
   * Called at startup and after setup/settings changes.
   */
  async reload(): Promise<void> {
    try {
      const [gl] = await this.db.select().from(glSettings).limit(1);
      this.glCache = gl ?? null;
    } catch {
      // Table may not exist yet (pre-migration) — graceful degradation
      this.glCache = null;
    }

    try {
      const [app] = await this.db.select().from(appSettings).limit(1);
      this.appCache = app ?? null;
    } catch {
      this.appCache = null;
    }

    this.logger.log(
      `Settings cache loaded: GL=${this.glCache ? 'yes' : 'empty'}, App=${this.appCache ? 'yes' : 'empty'}`,
    );
  }

  // ---------------------------------------------------------------------------
  // GL Settings Getters
  // ---------------------------------------------------------------------------

  /** ISO currency code for the home/base currency. Falls back to 'EUR'. */
  homeCurrency(): string {
    return this.glCache?.baseCurrency ?? 'EUR';
  }

  /** Month (1-12) the fiscal year starts. Falls back to 7 (July). */
  fiscalYearStartMonth(): number {
    return this.glCache?.fiscalYearStartMonth ?? 7;
  }

  /**
   * Revenue routing precedence: determines which group's GL account takes
   * priority when routing revenue in invoicing.
   */
  revenueRoutingPrecedence(): RevenueRoutingStrategy {
    return (
      (this.glCache?.revenueRoutingPrecedence as RevenueRoutingStrategy) ??
      'product_first'
    );
  }

  /**
   * Expense routing precedence: determines which group's GL account takes
   * priority when routing expenses in purchase invoicing.
   */
  expenseRoutingPrecedence(): ExpenseRoutingStrategy {
    return (
      (this.glCache?.expenseRoutingPrecedence as ExpenseRoutingStrategy) ??
      'product_first'
    );
  }

  /** Default AR account UUID. */
  defaultArAccountId(): string | null {
    return this.glCache?.defaultArAccountId ?? null;
  }

  /** Default Revenue account UUID. */
  defaultRevenueAccountId(): string | null {
    return this.glCache?.defaultRevenueAccountId ?? null;
  }

  /** Default Tax account UUID. */
  defaultTaxAccountId(): string | null {
    return this.glCache?.defaultTaxAccountId ?? null;
  }

  // ---------------------------------------------------------------------------
  // App Settings Getters
  // ---------------------------------------------------------------------------

  /** Default fulfillment location UUID. Returns null if not configured. */
  defaultFulfillmentLocationId(): string | null {
    return this.appCache?.defaultFulfillmentLocationId ?? null;
  }

  /** Inventory valuation method: 'weighted_average' or 'fifo'. */
  valuationMethod(): string {
    return (
      this.appCache?.inventoryValuationMethod ??
      process.env.INVENTORY_VALUATION_METHOD ??
      'weighted_average'
    );
  }

  /** Non-stock billing mode: 'per_shipment' or 'final_invoice'. */
  nonStockBillingMode(): string {
    return (
      this.appCache?.nonStockBillingMode ??
      process.env.NON_STOCK_BILLING_MODE ??
      'per_shipment'
    );
  }

  /** Credit limit behavior: 'hard' or 'soft'. */
  creditLimitBehavior(): 'hard' | 'soft' {
    return (this.appCache?.creditLimitBehavior as 'hard' | 'soft') ?? 'soft';
  }

  /** Whether the initial setup wizard has been completed. */
  isSetupComplete(): boolean {
    return !!this.appCache?.setupCompletedAt;
  }

  /** The raw GL settings row, if available. */
  getGlSettingsRaw(): typeof glSettings.$inferSelect | null {
    return this.glCache;
  }

  /** The raw app settings row, if available. */
  getAppSettingsRaw(): typeof appSettings.$inferSelect | null {
    return this.appCache;
  }
}
