'use client';

import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';
import { formatLocationDisplay } from '@/lib/formatters';

interface Props {
  config: ConfigState;
  updateConfig: (updates: Partial<ConfigState>) => void;
  onNext: () => void;
}

export default function SettingsStep({ config, updateConfig, onNext }: Props) {
  const t = useTranslations('setup.settings');
  const [coaPresets, setCoaPresets] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  useEffect(() => {
    async function fetchDefaults() {
      try {
        setLoadingDefaults(true);
        const [coaRes, previewRes] = await Promise.allSettled([
          apiFetch<any[]>('/api/setup/coa-presets'),
          apiFetch<any>('/api/setup/abm-preview'),
        ]);

        if (coaRes.status === 'fulfilled') {
          setCoaPresets(coaRes.value);
        }
        
        if (previewRes.status === 'fulfilled' && previewRes.value) {
          const locs = previewRes.value.locations || [];
          setLocations(locs);
        }
      } catch (err) {
        reportError(err, 'Failed to load defaults');
      } finally {
        setLoadingDefaults(false);
      }
    }
    fetchDefaults();
  }, []);

  const isFormValid = config.companyName.trim() !== '' &&
                      config.baseCurrency !== '' &&
                      config.coaPreset !== '' &&
                      config.fiscalStartMonth !== '' &&
                      config.revenueRouting !== '' &&
                      config.expenseRouting !== '' &&
                      config.inventoryValuation !== '' &&
                      config.inventoryAccountingMode !== '' &&
                      config.nonStockBilling !== '' &&
                      config.primaryLocation !== '';

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('title')}</h2>
        <p className="text-slate-500">
          {t('description')}
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.companyName')}</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
          placeholder={t('placeholders.companyName')}
          value={config.companyName}
          onChange={(e) => updateConfig({ companyName: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.baseCurrency')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed focus:outline-none"
            value={config.baseCurrency}
            disabled
          >
            <option value={config.baseCurrency}>{config.baseCurrency} (Configured in .env)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.coaPreset')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.coaPreset}
            onChange={(e) => updateConfig({ coaPreset: e.target.value })}
            disabled={loadingDefaults}
          >
            <option value="" disabled>{loadingDefaults ? t('loading') : t('placeholders.selectCoa')}</option>
            {coaPresets.map(preset => (
              <option key={preset.filename} value={preset.filename}>{preset.name} ({preset.country})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.fiscalYearStart')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.fiscalStartMonth}
            onChange={(e) => updateConfig({ fiscalStartMonth: e.target.value })}
          >
            <option value="" disabled>{t('placeholders.selectMonth')}</option>
            <option>{t('options.months.january')}</option>
            <option>{t('options.months.april')}</option>
            <option>{t('options.months.july')}</option>
            <option>{t('options.months.october')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.revenueRouting')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.revenueRouting}
            onChange={(e) => updateConfig({ revenueRouting: e.target.value })}
          >
            <option value="" disabled>{t('placeholders.selectPrecedence')}</option>
            <option>{t('options.precedence.product')}</option>
            <option>{t('options.precedence.customer')}</option>
            <option>{t('options.precedence.location')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.expenseRouting')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.expenseRouting}
            onChange={(e) => updateConfig({ expenseRouting: e.target.value })}
          >
            <option value="" disabled>{t('placeholders.selectPrecedence')}</option>
            <option>{t('options.precedence.product')}</option>
            <option>{t('options.precedence.supplier')}</option>
            <option>{t('options.precedence.location')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.inventoryValuation')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.inventoryValuation}
            onChange={(e) => updateConfig({ inventoryValuation: e.target.value })}
          >
            <option value="" disabled>{t('placeholders.selectValuation')}</option>
            <option value="weighted_average">{t('options.valuation.weightedAverage')}</option>
            <option value="fifo">{t('options.valuation.fifo')}</option>
            <option value="standard">{t('options.valuation.standard')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Inventory Accounting Mode</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.inventoryAccountingMode}
            onChange={(e) => updateConfig({ inventoryAccountingMode: e.target.value })}
          >
            <option value="" disabled>Select Accounting Mode...</option>
            <option value="periodic">Periodic Tracking (Simplified)</option>
            <option value="perpetual">Perpetual Tracking (ERP Standard)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.nonStockBilling')}</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.nonStockBilling}
            onChange={(e) => updateConfig({ nonStockBilling: e.target.value })}
          >
            <option value="" disabled>{t('placeholders.selectBilling')}</option>
            <option value="per_shipment">{t('options.billing.perShipment')}</option>
            <option value="final_invoice">{t('options.billing.finalInvoice')}</option>
          </select>
        </div>
      </div>
      <hr className="border-slate-100 mb-6" />

      <div className="mb-6">
        <h3 className="font-bold text-slate-800 mb-4">{t('fulfillmentHeading')}</h3>
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.primaryLocation')}</label>
        <select
          className="w-full max-w-[calc(50%-12px)] px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
          value={config.primaryLocation}
          onChange={(e) => updateConfig({ primaryLocation: e.target.value })}
          disabled={loadingDefaults}
        >
            <option value="" disabled>{loadingDefaults ? t('loading') : t('placeholders.selectLocation')}</option>
            {locations.length === 0 && !loadingDefaults && (
              <option value="none">{t('noLocations')}</option>
            )}
            {locations.map(loc => (
              <option key={loc.code} value={loc.code}>{formatLocationDisplay(loc)}</option>
            ))}
        </select>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-end border-t border-slate-100">
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className={`px-8 py-3 rounded-lg font-bold transition-colors shadow-sm ${
            isFormValid
              ? 'bg-[#006b5c] hover:bg-[#005246] text-white cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {t('finalize')}
        </button>
      </div>
    </div>
  );
}
