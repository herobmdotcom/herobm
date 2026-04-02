'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  updateConfig: (updates: Partial<ConfigState>) => void;
  onNext: () => void;
}

export default function SettingsStep({ config, updateConfig, onNext }: Props) {
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
        console.error('Failed to load defaults', err);
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
                      config.nonStockBilling !== '' &&
                      config.primaryLocation !== '';

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Configuration</h2>
        <p className="text-slate-500">
          Set your core accounting and operational defaults.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Company Registered Name</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
          placeholder="Acme Logistics Corp."
          value={config.companyName}
          onChange={(e) => updateConfig({ companyName: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Base Currency</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.baseCurrency}
            onChange={(e) => updateConfig({ baseCurrency: e.target.value })}
          >
            <option value="" disabled>Select base currency...</option>
            <option>AUD - Australian Dollar</option>
            <option>USD - US Dollar</option>
            <option>EUR - Euro</option>
            <option>SGD - Singapore Dollar</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Chart of Accounts Preset</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.coaPreset}
            onChange={(e) => updateConfig({ coaPreset: e.target.value })}
            disabled={loadingDefaults}
          >
            <option value="" disabled>{loadingDefaults ? 'Loading...' : 'Select COA preset...'}</option>
            {coaPresets.map(preset => (
              <option key={preset.filename} value={preset.filename}>{preset.name} ({preset.country})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Fiscal Year Start Month</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.fiscalStartMonth}
            onChange={(e) => updateConfig({ fiscalStartMonth: e.target.value })}
          >
            <option value="" disabled>Select start month...</option>
            <option>January</option>
            <option>April</option>
            <option>July</option>
            <option>October</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Revenue Routing Precedence</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.revenueRouting}
            onChange={(e) => updateConfig({ revenueRouting: e.target.value })}
          >
            <option value="" disabled>Select precedence...</option>
            <option>Product Priority</option>
            <option>Customer Priority</option>
            <option>Location Priority</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Expense Routing Precedence</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.expenseRouting}
            onChange={(e) => updateConfig({ expenseRouting: e.target.value })}
          >
            <option value="" disabled>Select precedence...</option>
            <option>Product Priority</option>
            <option>Supplier Priority</option>
            <option>Location Priority</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Inventory Valuation</label>
          <select
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.inventoryValuation}
            onChange={(e) => updateConfig({ inventoryValuation: e.target.value })}
          >
            <option value="" disabled>Select valuation method...</option>
            <option value="weighted_average">Weighted Average</option>
            <option value="fifo">FIFO</option>
          </select>
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Non-Stock Billing Mode</label>
        <select
          className="w-full max-w-[calc(50%-12px)] px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
          value={config.nonStockBilling}
          onChange={(e) => updateConfig({ nonStockBilling: e.target.value })}
        >
          <option value="" disabled>Select billing mode...</option>
          <option value="per_shipment">Per Shipment</option>
          <option value="final_invoice">Final Invoice Only</option>
        </select>
      </div>
      <hr className="border-slate-100 mb-6" />

      <div className="mb-6">
        <h3 className="font-bold text-slate-800 mb-4">Default Fulfillment Location</h3>
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">Select Primary Location</label>
        <select
          className="w-full max-w-[calc(50%-12px)] px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
          value={config.primaryLocation}
          onChange={(e) => updateConfig({ primaryLocation: e.target.value })}
          disabled={loadingDefaults}
        >
            <option value="" disabled>{loadingDefaults ? 'Loading...' : 'Select primary location...'}</option>
            {locations.length === 0 && !loadingDefaults && (
              <option value="none">No Locations Found in Source</option>
            )}
            {locations.map(loc => (
              <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
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
          Finalize Setup
        </button>
      </div>
    </div>
  );
}
