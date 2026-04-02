'use client';

import { useState } from 'react';
import ExtractionStep from './ExtractionStep';
import PreviewStep from './PreviewStep';
import SettingsStep from './SettingsStep';
import ReviewStep from './ReviewStep';
import ExecutingStep from './ExecutingStep';

export type ConfigState = {
  host: string;
  port: string;
  database: string;
  username: string;
  password?: string;
  resume: boolean;
  emptyBase: boolean;
  
  // Settings
  companyName: string;
  baseCurrency: string;
  coaPreset: string;
  fiscalStartMonth: string;
  revenueRouting: string;
  expenseRouting: string;
  primaryLocation: string;
  inventoryValuation: string;
  nonStockBilling: string;
};

export default function SetupWizard() {
  const [activeTab, setActiveTab] = useState('Extraction');
  
  const [config, setConfig] = useState<ConfigState>({
    host: '',
    port: '1433',
    database: '',
    username: '',
    password: '',
    resume: false,
    emptyBase: false,
    
    companyName: '',
    baseCurrency: '',
    coaPreset: '',
    fiscalStartMonth: '',
    revenueRouting: '',
    expenseRouting: '',
    primaryLocation: '',
    inventoryValuation: '',
    nonStockBilling: '',
  });

  const tabs = ['Extraction', 'Preview', 'Settings', 'Review', 'Executing'];

  const goNext = (tabName: string) => {
    setActiveTab(tabName);
  };

  const updateConfig = (updates: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  return (
    <>
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <div
            key={tab}
            className={`flex-1 text-center py-4 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'text-[#006b5c] border-b-[3px] border-[#006b5c]'
                : 'text-slate-400 border-b-[3px] border-transparent'
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="p-8 flex-1">
        {activeTab === 'Extraction' && (
          <ExtractionStep config={config} updateConfig={updateConfig} onNext={() => goNext('Preview')} />
        )}
        {activeTab === 'Preview' && (
          <PreviewStep config={config} onNext={() => goNext('Settings')} />
        )}
        {activeTab === 'Settings' && (
          <SettingsStep config={config} updateConfig={updateConfig} onNext={() => goNext('Review')} />
        )}
        {activeTab === 'Review' && (
          <ReviewStep config={config} onNext={() => goNext('Executing')} />
        )}
        {activeTab === 'Executing' && (
          <ExecutingStep config={config} />
        )}
      </div>
    </>
  );
}
