'use client';

import React from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reportConfigs: Record<string, { id: string; name: string }[]>;
  pinnedReports: { slug: string; configId: string; name: string }[];
  reports: { slug: string; name: string }[];
  onChange: (pinnedReports: { slug: string; configId: string; name: string }[]) => void;
}

export default function ReportSettingsSlideOver({ isOpen, onClose, reportConfigs, pinnedReports, reports, onChange }: Props) {
  const t = useTranslations('dashboard');
  const togglePin = (slug: string, configId: string, name: string) => {
    const isPinned = pinnedReports.some(p => p.configId === configId);
    if (isPinned) {
      onChange(pinnedReports.filter(p => p.configId !== configId));
    } else {
      onChange([...pinnedReports, { slug, configId, name }]);
    }
  };

  const hasAnySaved = Object.keys(reportConfigs || {}).length > 0;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Dashboard Reports">
      <div className="flex flex-col gap-6">
        <p className="text-[13px] opacity-70 text-[var(--text-primary)]">
          {t('reportSettingsDescription')}
        </p>
        
        {!hasAnySaved ? (
          <div className="text-[13px] italic opacity-50">
            {t('noSavedReports')}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(reportConfigs).map(([slug, configs]) => {
              if (!configs || configs.length === 0) return null;
              
              const reportDef = reports.find(r => r.slug === slug);
              const formattedSlug = reportDef ? reportDef.name : slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

              return (
                <div key={slug} className="flex flex-col gap-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 mt-2 text-[var(--text-primary)]">
                    {formattedSlug}
                  </div>
                  {configs.map(config => {
                    const isChecked = pinnedReports.some(p => p.configId === config.id);
                    const pinName = `${formattedSlug} - ${config.name}`;
                    return (
                      <label key={config.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => togglePin(slug, config.id, pinName)}
                          className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span className="text-[14px] text-[var(--text-primary)]">
                          {config.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SlideOver>
  );
}
