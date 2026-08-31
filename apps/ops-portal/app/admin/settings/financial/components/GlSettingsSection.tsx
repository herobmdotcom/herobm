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

  return (
    <div id="gl-section" className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading !mb-0">
          {''}
          {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
          <span className="material-symbols-outlined">{'account_balance_wallet'}</span>
          {''}
          <span>{tSettings('financialSettings.defaults')}</span>
        </h3>
      </div>

      {glLoading ? (
        <div className="text-sm text-muted animate-pulse">{tSettings('gl.loading')}</div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
            {/* Sales & Revenue */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultAr')}
              </label>
              {renderGlAccountSelect('defaultArAccountId', glSettings?.defaultArAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultRevenue')}
              </label>
              {renderGlAccountSelect('defaultRevenueAccountId', glSettings?.defaultRevenueAccountId as string | undefined)}
            </div>

            {/* Purchasing & Expense */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultAp')}
              </label>
              {renderGlAccountSelect('defaultApAccountId', glSettings?.defaultApAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultExpense')}
              </label>
              {renderGlAccountSelect('defaultExpenseAccountId', glSettings?.defaultExpenseAccountId as string | undefined)}
            </div>

            {/* Inventory & COGS */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultInventory')}
              </label>
              {renderGlAccountSelect('defaultInventoryAccountId', glSettings?.defaultInventoryAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultCogs')}
              </label>
              {renderGlAccountSelect('defaultCogsAccountId', glSettings?.defaultCogsAccountId as string | undefined)}
            </div>

            {/* Accruals & Shrinkage */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultGrni')}
              </label>
              {renderGlAccountSelect('defaultGrniAccountId', glSettings?.defaultGrniAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultShrinkage')}
              </label>
              {renderGlAccountSelect('defaultShrinkageAccountId', glSettings?.defaultShrinkageAccountId as string | undefined)}
            </div>

            {/* Misc */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultFeeRevenue')}
              </label>
              {renderGlAccountSelect('defaultFeeRevenueAccountId', glSettings?.defaultFeeRevenueAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultDiscountsReceived')}
              </label>
              {renderGlAccountSelect('defaultDiscountsReceivedAccountId', glSettings?.defaultDiscountsReceivedAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultDiscountsGiven')}
              </label>
              {renderGlAccountSelect('defaultDiscountsGivenAccountId', glSettings?.defaultDiscountsGivenAccountId as string | undefined)}
            </div>

            {/* Foreign Exchange */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.realisedFxGain')}
              </label>
              {renderGlAccountSelect('realisedFxGainAccountId', glSettings?.realisedFxGainAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.realisedFxLoss')}
              </label>
              {renderGlAccountSelect('realisedFxLossAccountId', glSettings?.realisedFxLossAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.unrealisedFxGain')}
              </label>
              {renderGlAccountSelect('unrealisedFxGainAccountId', glSettings?.unrealisedFxGainAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.unrealisedFxLoss')}
              </label>
              {renderGlAccountSelect('unrealisedFxLossAccountId', glSettings?.unrealisedFxLossAccountId as string | undefined)}
            </div>

            {/* Tax */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultSalesTax')}
              </label>
              {renderGlAccountSelect('defaultSalesTaxAccountId', glSettings?.defaultSalesTaxAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultPurchaseTax')}
              </label>
              {renderGlAccountSelect('defaultPurchaseTaxAccountId', glSettings?.defaultPurchaseTaxAccountId as string | undefined)}
            </div>

            {/* Over-The-Counter (OTC) Defaults */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultOtcCash')}
              </label>
              {renderGlAccountSelect('defaultOtcCashAccountId', glSettings?.defaultOtcCashAccountId as string | undefined)}
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.defaultOtcCard')}
              </label>
              {renderGlAccountSelect('defaultOtcCardAccountId', glSettings?.defaultOtcCardAccountId as string | undefined)}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.revenueRouting')}
                <span className="material-symbols-outlined text-[14px] cursor-help" title="If customer and product both have a default GL account, this determines which to use">info</span>
              </label>
              <select 
                className="input max-w-sm" 
                value={(glSettings?.revenueRoutingPrecedence as string) || ''} 
                onChange={(e) => updateGlSetting('revenueRoutingPrecedence', e.target.value)}
              >
                <option value="customer_first">{tSettings('gl.customerFirst')}</option>
                <option value="product_first">{tSettings('gl.productFirst')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSettings('labels.expenseRouting')}
                <span className="material-symbols-outlined text-[14px] cursor-help" title="If supplier and product both have a default GL account, this determines which to use">info</span>
              </label>
              <select 
                className="input max-w-sm" 
                value={(glSettings?.expenseRoutingPrecedence as string) || ''} 
                onChange={(e) => updateGlSetting('expenseRoutingPrecedence', e.target.value)}
              >
                <option value="supplier_first">{tSettings('gl.supplierFirst')}</option>
                <option value="product_first">{tSettings('gl.productFirst')}</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
