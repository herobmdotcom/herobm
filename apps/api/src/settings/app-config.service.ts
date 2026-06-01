import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { eq } from 'drizzle-orm';
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
    } catch (err) {
      this.logger.error('Failed to load appSettings:', err);
      this.appCache = null;
    }

    this.logger.log(
      `Settings cache loaded: GL=${this.glCache ? 'yes' : 'empty'}, App=${this.appCache ? 'yes' : 'empty'}`,
    );
  }

  private getGl(): typeof glSettings.$inferSelect {
    if (!this.glCache) {
      throw new Error(
        'GL Settings not configured or cache empty. Run setup first.',
      );
    }
    return this.glCache;
  }

  private getApp(): typeof appSettings.$inferSelect {
    if (!this.appCache) {
      throw new Error(
        'App Settings not configured or cache empty. Run setup first.',
      );
    }
    return this.appCache;
  }

  // ---------------------------------------------------------------------------
  // GL Settings Getters
  // ---------------------------------------------------------------------------

  /** ISO currency code for the home/base currency. */
  homeCurrency(): string {
    return this.getGl().baseCurrency;
  }

  /** Month (1-12) the fiscal year starts. */
  fiscalYearStartMonth(): number {
    return this.getGl().fiscalYearStartMonth;
  }

  /** Revenue routing precedence */
  revenueRoutingPrecedence(): RevenueRoutingStrategy {
    return this.getGl().revenueRoutingPrecedence as RevenueRoutingStrategy;
  }

  /** Expense routing precedence */
  expenseRoutingPrecedence(): ExpenseRoutingStrategy {
    return this.getGl().expenseRoutingPrecedence as ExpenseRoutingStrategy;
  }

  /** Default AR customer UUID. */
  defaultArAccountId(): string | null {
    return this.getGl().defaultArAccountId;
  }

  /** Default Revenue customer UUID. */
  defaultRevenueAccountId(): string | null {
    return this.getGl().defaultRevenueAccountId;
  }

  /** Default Tax customer UUID. */
  defaultTaxAccountId(): string | null {
    return this.getGl().defaultTaxAccountId;
  }

  /** Default Inventory Asset customer UUID. */
  defaultInventoryAccountId(): string | null {
    return this.getGl().defaultInventoryAccountId;
  }

  /** Default GRNI (Goods Received Not Invoiced) liability customer UUID. */
  defaultGrniAccountId(): string | null {
    return this.getGl().defaultGrniAccountId;
  }

  /** Default Inventory Shrinkage (Expense) customer UUID. */
  defaultShrinkageAccountId(): string | null {
    return this.getGl().defaultShrinkageAccountId;
  }

  /** Default Cost of Goods Sold (COGS) expense customer UUID. */
  defaultCogsAccountId(): string | null {
    return this.getGl().defaultCogsAccountId;
  }

  /** Default Fee Revenue customer UUID (e.g. restocking fees). */
  defaultFeeRevenueAccountId(): string | null {
    return this.getGl().defaultFeeRevenueAccountId ?? null;
  }

  // ---------------------------------------------------------------------------
  // App Settings Getters
  // ---------------------------------------------------------------------------

  /** Default fulfillment location UUID. Returns null if not configured. */
  defaultFulfillmentLocationId(): string | null {
    return this.getApp().defaultFulfillmentLocationId;
  }

  /** Inventory valuation method: 'weighted_average' or 'fifo' or 'standard'. */
  valuationMethod(): string {
    return this.getApp().inventoryValuationMethod;
  }

  /** Inventory accounting mode: 'periodic' or 'perpetual'. */
  inventoryAccountingMode(): string {
    return this.getApp().inventoryAccountingMode;
  }

  /** Non-stock billing mode: 'per_shipment' or 'final_invoice'. */
  nonStockBillingMode(): string {
    return this.getApp().nonStockBillingMode;
  }

  /** Credit limit behavior: 'hard' or 'soft'. */
  creditLimitBehavior(): 'hard' | 'soft' {
    return this.getApp().creditLimitBehavior as 'hard' | 'soft';
  }

  /** Whether the initial setup wizard has been completed. */
  isSetupComplete(): boolean {
    return !!this.appCache?.setupCompletedAt;
  }

  /** The mapping of country code to external tax provider (e.g. {"US": "taxjar"}). */
  taxProviderMappings(): Record<string, string> {
    return (this.appCache?.taxProviderMappings as Record<string, string>) || {};
  }

  /** The raw GL settings row, if available. */
  getGlSettingsRaw(): typeof glSettings.$inferSelect | null {
    return this.glCache;
  }

  /** The raw app settings row, if available. */
  getAppSettingsRaw(): typeof appSettings.$inferSelect | null {
    return this.appCache;
  }

  /** Update app settings. */
  async update(dto: { defaultFulfillmentLocationId?: string }) {
    const settings = this.getAppSettingsRaw();
    if (!settings) {
      throw new Error('App Settings not configured.');
    }

    const [updated] = await this.db
      .update(appSettings)
      .set(dto)
      .where(eq(appSettings.settingsId, settings.settingsId))
      .returning();

    await this.reload();
    return updated;
  }
}
