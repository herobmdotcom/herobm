import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';

interface GlSettingsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  glSettings: Record<string, any> | null;
  updateGlSetting: (field: string, value: unknown) => void;
  glLoading: boolean;
  glAccounts: api.GlAccountResponseDto[];
}

export function GlSettingsSection({ glSettings, updateGlSetting, glLoading, glAccounts }: GlSettingsSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const renderGlAccountSelect = (field: string, value?: string) => {
    return (
      <select 
        className="input" 
        value={value || ''} 
        onChange={(e) => updateGlSetting(field, e.target.value || null)}
      >
        <option value="">{tCommon('notConfigured')}</option>
        {glAccounts.filter(a => !a.isGroup).map(a => (
          <option key={a.glAccountId} value={a.glAccountId}>
            {a.accountCode} - {a.name}
          </option>
        ))}
      </select>
    );
  };

  const renderAccountField = (field: string, label: string, isRequired: boolean) => {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-center justify-between text-xs font-medium mb-1 text-[var(--text-muted)]">
          <span>{label}</span>
          {isRequired ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded uppercase tracking-wider">
              {tSettings('financialSettings.required')}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-muted bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.2 rounded uppercase tracking-wider">
              {tSettings('financialSettings.optional')}
            </span>
          )}
        </label>
        {renderGlAccountSelect(field, glSettings?.[field] as string | undefined)}
      </div>
    );
  };

  return (
    <div id="gl-section" className="card flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="section-heading !mb-0 flex items-center gap-2">
          <span className="material-symbols-outlined">account_balance_wallet</span>
          <span>{tSettings('financialSettings.defaults')}</span>
        </h3>
      </div>

      {glLoading ? (
        <div className="text-sm text-muted animate-pulse">{tSettings('gl.loading')}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 1. Sales & Receivables */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">shopping_cart</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainSales')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainSalesDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('defaultArAccountId', tSettings('labels.defaultAr'), true)}
              {renderAccountField('defaultRevenueAccountId', tSettings('labels.defaultRevenue'), true)}
              {renderAccountField('defaultFeeRevenueAccountId', tSettings('labels.defaultFeeRevenue'), false)}
              {renderAccountField('defaultDiscountsGivenAccountId', tSettings('labels.defaultDiscountsGiven'), false)}
              <div className="flex flex-col gap-1 md:col-span-2 max-w-sm">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                  {tSettings('labels.revenueRouting')}
                  <span className="material-symbols-outlined text-[14px] cursor-help" title="Determines whether customer or product account takes precedence on sales lines">info</span>
                </label>
                <select 
                  className="input" 
                  value={(glSettings?.revenueRoutingPrecedence as string) || 'customer_first'} 
                  onChange={(e) => updateGlSetting('revenueRoutingPrecedence', e.target.value)}
                >
                  <option value="customer_first">{tSettings('gl.customerFirst')}</option>
                  <option value="product_first">{tSettings('gl.productFirst')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Purchasing & Payables */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">shopping_bag</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainPurchasing')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainPurchasingDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('defaultApAccountId', tSettings('labels.defaultAp'), true)}
              {renderAccountField('defaultExpenseAccountId', tSettings('labels.defaultExpense'), true)}
              {renderAccountField('defaultDiscountsReceivedAccountId', tSettings('labels.defaultDiscountsReceived'), false)}
              {renderAccountField('defaultPpvAccountId', tSettings('labels.defaultPpv'), false)}
              <div className="flex flex-col gap-1 md:col-span-2 max-w-sm">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                  {tSettings('labels.expenseRouting')}
                  <span className="material-symbols-outlined text-[14px] cursor-help" title="Determines whether supplier or product account takes precedence on purchase lines">info</span>
                </label>
                <select 
                  className="input" 
                  value={(glSettings?.expenseRoutingPrecedence as string) || 'supplier_first'} 
                  onChange={(e) => updateGlSetting('expenseRoutingPrecedence', e.target.value)}
                >
                  <option value="supplier_first">{tSettings('gl.supplierFirst')}</option>
                  <option value="product_first">{tSettings('gl.productFirst')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Inventory & Costing */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">inventory_2</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainInventory')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainInventoryDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('defaultInventoryAccountId', tSettings('labels.defaultInventory'), true)}
              {renderAccountField('defaultCogsAccountId', tSettings('labels.defaultCogs'), true)}
              {renderAccountField('defaultGrniAccountId', tSettings('labels.defaultGrni'), true)}
              {renderAccountField('defaultShrinkageAccountId', tSettings('labels.defaultShrinkage'), true)}
            </div>
          </div>

          {/* 4. Tax Accounting */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">receipt_long</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainTax')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainTaxDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('defaultSalesTaxAccountId', tSettings('labels.defaultSalesTax'), true)}
              {renderAccountField('defaultPurchaseTaxAccountId', tSettings('labels.defaultPurchaseTax'), true)}
            </div>
          </div>

          {/* 5. Foreign Exchange (Multi-Currency) */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">currency_exchange</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainFx')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainFxDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('realisedFxGainAccountId', tSettings('labels.realisedFxGain'), false)}
              {renderAccountField('realisedFxLossAccountId', tSettings('labels.realisedFxLoss'), false)}
              {renderAccountField('unrealisedFxGainAccountId', tSettings('labels.unrealisedFxGain'), false)}
              {renderAccountField('unrealisedFxLossAccountId', tSettings('labels.unrealisedFxLoss'), false)}
            </div>
          </div>

          {/* 6. Trade Counter & POS */}
          <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-lg flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary-600)]">point_of_sale</span>
                <h4 className="text-sm font-semibold text-foreground">{tSettings('financialSettings.domainPos')}</h4>
              </div>
              <p className="text-xs text-muted mt-0.5">{tSettings('financialSettings.domainPosDesc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {renderAccountField('defaultOtcCashAccountId', tSettings('labels.defaultOtcCash'), false)}
              {renderAccountField('defaultOtcCardAccountId', tSettings('labels.defaultOtcCard'), false)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

