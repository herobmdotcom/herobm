'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import PageNav from '@/components/shared/PageNav';

import { TaxSettingsSection } from './components/TaxSettingsSection';
import { TaxPositionsSection } from './components/TaxPositionsSection';
import { ExchangeRatesSection } from './components/ExchangeRatesSection';
import { CostCentersSection } from './components/CostCentersSection';
import { ActivitiesSection } from './components/ActivitiesSection';
import { GlSettingsSection } from './components/GlSettingsSection';
import { CoASettingsSection } from './components/CoASettingsSection';
import { TradingTermsSection } from './components/TradingTermsSection';
import { Button } from '@/components/shared/Button';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';

interface MissingConfigItem {
  id: string;
  label: string;
  tab: 'gl' | 'operations';
  sectionId: string;
  sectionName: string;
  impact: string;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FinancialSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');
  useDocumentTitle(tSettings('financialSettings.title'));

  // ── GL Settings state ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon
  const [glSettings, setGlSettings] = useState<Record<string, any> | null>(null);

  // ── App Settings state ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon
  const [appSettings, setAppSettings] = useState<Record<string, any> | null>(null);

  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [glLoading, setGlLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gl' | 'operations'>('gl');

  const areaMap: Record<string, string> = {
    gl: tSettings('sections.gl'),
    tax: tSettings('sections.tax'),
    rates: tSettings('sections.rates'),
    cc: tSettings('sections.costCenters'),
    activity: tSettings('sections.activities'),
  };

  // ── GL Settings data ───────────────────────────────────────────────────────
  
  const loadGl = async () => {
    try {
      setGlLoading(true);
      const [settingsRes, appSettingsRes, accountsRes] = await Promise.all([
        api.glControllerGetSettings(),
        api.appConfigControllerGet(),
        api.glControllerGetAccounts({} as Record<string, never>)
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon
      setGlSettings(settingsRes.data as unknown as Record<string, any>);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon
      setAppSettings(appSettingsRes.data as unknown as Record<string, any>);
      setGlAccounts(accountsRes.data);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.gl }) + ': ' + getErrorMessage(err));
    } finally {
      setGlLoading(false);
    }
  };

  const updateGlSetting = async (field: string, value: unknown) => {
    try {
      const payload = { [field]: value };
      const res = await api.glControllerUpdateSettings(payload);
      const updated = res.data;
      setGlSettings(Object.assign({}, glSettings || {}, updated));
      toast.success(tSettings('toasts.settingsUpdated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const updateAppSetting = async (field: string, value: unknown) => {
    try {
      const payload = { [field]: value };
      const res = await api.appConfigControllerUpdate(payload);
      const updated = res.data;
      setAppSettings(Object.assign({}, appSettings || {}, updated));
      toast.success(tSettings('toasts.settingsUpdated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadGl();
  }, []);

  const navSections = useMemo(() => [
    {
      id: 'tab-gl',
      label: tSettings('financialSettings.tabGl'),
      isSubPage: true,
      isActive: activeTab === 'gl',
      onClick: () => setActiveTab('gl'),
      subtargets: [
        { id: 'gl-section', label: tSettings('financialSettings.defaults'), onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('gl-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'coa-section', label: tSettings('financialSettings.accounts'), onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('coa-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'cc-section', label: tSettings('financialSettings.costCenters'), onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('cc-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: tSettings('financialSettings.activities'), onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ]
    },
    {
      id: 'tab-operations',
      label: tSettings('financialSettings.tabOperations'),
      isSubPage: true,
      isActive: activeTab === 'operations',
      onClick: () => setActiveTab('operations'),
      subtargets: [
        { id: 'credit-policy', label: tSettings('financialSettings.credit'), onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('credit-policy')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'rates-section', label: tSettings('financialSettings.currencies'), onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('rates-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'tax-section', label: tSettings('sections.tax'), onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('tax-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'tax-positions-section', label: tSettings('sections.taxPositions'), onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('tax-positions-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ]
    }
  ], [activeTab, tSettings]);

  const missingConfigs = useMemo<MissingConfigItem[]>(() => {
    const items: MissingConfigItem[] = [];
    if (glLoading) return items;

    // 1. General Ledger Defaults
    if (!glSettings?.defaultArAccountId) {
      items.push({
        id: 'defaultArAccountId',
        label: tSettings('labels.defaultAr'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactAr'),
      });
    }
    if (!glSettings?.defaultApAccountId) {
      items.push({
        id: 'defaultApAccountId',
        label: tSettings('labels.defaultAp'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactAp'),
      });
    }
    if (!glSettings?.defaultRevenueAccountId) {
      items.push({
        id: 'defaultRevenueAccountId',
        label: tSettings('labels.defaultRevenue'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactRevenue'),
      });
    }
    if (!glSettings?.defaultExpenseAccountId) {
      items.push({
        id: 'defaultExpenseAccountId',
        label: tSettings('labels.defaultExpense'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactExpense'),
      });
    }
    if (!glSettings?.defaultInventoryAccountId) {
      items.push({
        id: 'defaultInventoryAccountId',
        label: tSettings('labels.defaultInventory'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactInventory'),
      });
    }
    if (!glSettings?.defaultCogsAccountId) {
      items.push({
        id: 'defaultCogsAccountId',
        label: tSettings('labels.defaultCogs'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactCogs'),
      });
    }
    if (!glSettings?.defaultGrniAccountId) {
      items.push({
        id: 'defaultGrniAccountId',
        label: tSettings('labels.defaultGrni'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactGrni'),
      });
    }
    if (!glSettings?.defaultSalesTaxAccountId) {
      items.push({
        id: 'defaultSalesTaxAccountId',
        label: tSettings('labels.defaultSalesTax'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactSalesTax'),
      });
    }
    if (!glSettings?.defaultPurchaseTaxAccountId) {
      items.push({
        id: 'defaultPurchaseTaxAccountId',
        label: tSettings('labels.defaultPurchaseTax'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactPurchaseTax'),
      });
    }
    if (!glSettings?.defaultShrinkageAccountId) {
      items.push({
        id: 'defaultShrinkageAccountId',
        label: tSettings('labels.defaultShrinkage'),
        tab: 'gl',
        sectionId: 'gl-section',
        sectionName: tSettings('financialSettings.defaults'),
        impact: tSettings('financialSettings.impactShrinkage'),
      });
    }

    // 2. Operations: Currencies
    if (!glSettings?.baseCurrency) {
      items.push({
        id: 'baseCurrency',
        label: tSettings('labels.baseCurrency'),
        tab: 'operations',
        sectionId: 'rates-section',
        sectionName: tSettings('financialSettings.currencies'),
        impact: tSettings('financialSettings.impactBaseCurrency'),
      });
    }

    // 3. Operations: Credit & Terms
    if (!appSettings?.defaultCustomerTermsId) {
      items.push({
        id: 'defaultCustomerTermsId',
        label: tSettings('labels.defaultCustomerTerms'),
        tab: 'operations',
        sectionId: 'credit-policy',
        sectionName: tSettings('financialSettings.credit'),
        impact: tSettings('financialSettings.impactCustomerTerms'),
      });
    }
    if (!appSettings?.defaultSupplierTermsId) {
      items.push({
        id: 'defaultSupplierTermsId',
        label: tSettings('labels.defaultSupplierTerms'),
        tab: 'operations',
        sectionId: 'credit-policy',
        sectionName: tSettings('financialSettings.credit'),
        impact: tSettings('financialSettings.impactSupplierTerms'),
      });
    }

    // 4. Operations: Tax Categories
    if (!appSettings?.defaultSalesTaxCategoryId) {
      items.push({
        id: 'defaultSalesTaxCategoryId',
        label: tSettings('labels.defaultSalesTaxCategory'),
        tab: 'operations',
        sectionId: 'tax-section',
        sectionName: tSettings('sections.tax'),
        impact: tSettings('financialSettings.impactSalesTaxCategory'),
      });
    }
    if (!appSettings?.defaultPurchaseTaxCategoryId) {
      items.push({
        id: 'defaultPurchaseTaxCategoryId',
        label: tSettings('labels.defaultPurchaseTaxCategory'),
        tab: 'operations',
        sectionId: 'tax-section',
        sectionName: tSettings('sections.tax'),
        impact: tSettings('financialSettings.impactPurchaseTaxCategory'),
      });
    }

    // 5. Operations: Tax Positions
    if (!appSettings?.defaultCustomerTaxPositionId) {
      items.push({
        id: 'defaultCustomerTaxPositionId',
        label: tSettings('labels.defaultCustomerTaxPosition'),
        tab: 'operations',
        sectionId: 'tax-positions-section',
        sectionName: tSettings('sections.taxPositions'),
        impact: tSettings('financialSettings.impactCustomerTaxPosition'),
      });
    }
    if (!appSettings?.defaultSupplierTaxPositionId) {
      items.push({
        id: 'defaultSupplierTaxPositionId',
        label: tSettings('labels.defaultSupplierTaxPosition'),
        tab: 'operations',
        sectionId: 'tax-positions-section',
        sectionName: tSettings('sections.taxPositions'),
        impact: tSettings('financialSettings.impactSupplierTaxPosition'),
      });
    }

    return items;
  }, [glLoading, glSettings, appSettings, tSettings]);

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={tSettings('financialSettings.title')}
        subtitle={tSettings('financialSettings.subtitle')}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {missingConfigs.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-symbols-outlined text-yellow-500">warning</span>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-yellow-900">
                  {tSettings('financialSettings.configurationRequired')} ({missingConfigs.length})
                </h3>
                <p className="text-xs text-yellow-800 mt-1 mb-3">
                  {tSettings('financialSettings.configurationRequiredSubheading')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {missingConfigs.map((item) => {
                    const tabLabel = item.tab === 'gl' ? tSettings('financialSettings.tabGl') : tSettings('financialSettings.tabOperations');
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 bg-yellow-100/70 p-2.5 rounded border border-yellow-200"
                      >
                        <span className="material-symbols-outlined text-[18px] text-yellow-700 mt-0.5">
                          arrow_right
                        </span>
                        <div className="flex-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="!p-0 !h-auto text-yellow-900 font-semibold hover:underline text-left"
                            onClick={() => {
                              setActiveTab(item.tab);
                              setTimeout(() => {
                                document.getElementById(item.sectionId)?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'start',
                                });
                              }, 50);
                            }}
                          >
                            {item.label}
                          </Button>
                          <span className="text-[11px] text-yellow-800 font-medium block">
                            {tabLabel} → {item.sectionName}
                          </span>
                          <span className="text-xs text-yellow-900/80 block mt-0.5">
                            {item.impact}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'gl' && (
          <>
            {/* ── General Ledger ────────────────────────────────────────── */}
            <GlSettingsSection glSettings={glSettings} updateGlSetting={updateGlSetting} glLoading={glLoading} glAccounts={glAccounts} />

            {/* ── Chart of Accounts ────────────────────────────────────────── */}
            <CoASettingsSection glSettings={glSettings} updateGlSetting={updateGlSetting} glAccounts={glAccounts} loadGl={loadGl} />

            {/* ── Cost Centers ─────────────────────────────────────────────────── */}
            <CostCentersSection glSettings={glSettings} updateGlSetting={updateGlSetting} />

            {/* ── Activities ───────────────────────────────────────────────────── */}
            <ActivitiesSection glSettings={glSettings} updateGlSetting={updateGlSetting} />
          </>
        )}

        {activeTab === 'operations' && (
          <>
            {/* ── Credit Policy & Trading Terms ───────────────────────────── */}
            <TradingTermsSection appSettings={appSettings} updateAppSetting={updateAppSetting} />

            {/* ── Exchange Rates ─────────────────────────────────────────────── */}
            <ExchangeRatesSection glSettings={glSettings} updateGlSetting={updateGlSetting} />

            {/* ── Tax Categories ─────────────────────────────────────────────── */}
            <TaxSettingsSection appSettings={appSettings} updateAppSetting={updateAppSetting} />

            {/* ── Tax Positions ──────────────────────────────────────────────── */}
            <TaxPositionsSection appSettings={appSettings} updateAppSetting={updateAppSetting} />
          </>
        )}
      </div>
    </div>
  );
}
