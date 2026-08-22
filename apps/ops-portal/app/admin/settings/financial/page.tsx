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

import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';

// ── Main Component ───────────────────────────────────────────────────────────

export default function FinancialSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');
  useDocumentTitle('Financial Settings');

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
      toast.success('Settings updated');
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
      toast.success('Settings updated');
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
      label: 'General Ledger',
      isSubPage: true,
      isActive: activeTab === 'gl',
      onClick: () => setActiveTab('gl'),
      subtargets: [
        { id: 'gl-section', label: 'Defaults', onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('gl-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'coa-section', label: 'Accounts', onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('coa-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'cc-section', label: 'Cost Centers', onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('cc-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: 'Activities', onClick: () => { setActiveTab('gl'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ]
    },
    {
      id: 'tab-operations',
      label: 'Operations',
      isSubPage: true,
      isActive: activeTab === 'operations',
      onClick: () => setActiveTab('operations'),
      subtargets: [
        { id: 'credit-policy', label: 'Credit', onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('credit-policy')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'rates-section', label: 'Currencies', onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('rates-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'tax-section', label: 'Tax Codes', onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('tax-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'tax-positions-section', label: 'Tax Positions', onClick: () => { setActiveTab('operations'); setTimeout(() => document.getElementById('tax-positions-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ]
    }
  ], [activeTab]);

  const configWarnings = useMemo(() => {
    const w: string[] = [];
    if (!glLoading) {
      if (!glSettings?.baseCurrency) {
        w.push('Base Currency is not configured.');
      }
      if (!glSettings?.defaultArAccountId || !glSettings?.defaultApAccountId || !glSettings?.defaultRevenueAccountId || !glSettings?.defaultExpenseAccountId || !glSettings?.defaultSalesTaxAccountId || !glSettings?.defaultPurchaseTaxAccountId || !glSettings?.defaultInventoryAccountId || !glSettings?.defaultCogsAccountId) {
        w.push('One or more default General Ledger accounts are missing (AR, AP, Revenue, Expense, Tax, Inventory, COGS).');
      }
      if (!appSettings?.defaultSalesTaxCategoryId || !appSettings?.defaultPurchaseTaxCategoryId) {
        w.push('Default Sales and/or Purchase Tax Categories are not configured.');
      }
      if (!appSettings?.defaultCustomerTaxPositionId || !appSettings?.defaultSupplierTaxPositionId) {
        w.push('Default Customer and/or Supplier Tax Positions are not configured.');
      }
      
      if (!appSettings?.defaultCustomerTermsId) {
        w.push('No Default Customer Trading Term is configured for Sales.');
      }
      
      if (!appSettings?.defaultSupplierTermsId) {
        w.push('No Default Supplier Trading Term is configured for Purchasing.');
      }
    }
    return w;
  }, [glLoading, glSettings, appSettings]);

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="Financial Settings"
        subtitle={tSettings('subtitle')}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {configWarnings.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
            <div className="flex">
              <div className="flex-shrink-0">
                {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
                <span className="material-symbols-outlined text-yellow-400">{'warning'}</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold">{tSettings('financialSettings.configurationRequired')}</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul role="list" className="list-disc space-y-1 pl-5">
                    {configWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
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
