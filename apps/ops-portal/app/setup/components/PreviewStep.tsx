'use client';

import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  onNext: () => void;
}

export default function PreviewStep({ config, onNext }: Props) {
  const t = useTranslations('setup.preview');
  const [tables, setTables] = useState<{name: string, rowCount: number}[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    async function loadPreview() {
      try {
        setLoadingPreview(true);
        const data = await apiFetch<any>('/api/setup/abm-preview', { cache: 'no-store' });
        if (data && data.tables) {
          setTables(data.tables);
        }
      } catch (err) {
        reportError(err, 'Failed to load live preview data');
      } finally {
        setLoadingPreview(false);
      }
    }
    loadPreview();
  }, []);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('title')}</h2>
        <p className="text-slate-500">
          {t.rich('description', { 
            database: config.database, 
            host: config.host,
            highlight: (chunks) => <strong className="text-[#006b5c] font-semibold">{chunks}</strong>
          })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 mb-6" style={{ maxHeight: '400px' }}>
        {loadingPreview ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-medium">
            <span className="w-5 h-5 mr-3 border-2 border-[#006b5c] border-t-transparent rounded-full animate-spin" />
            {t('loading')}
          </div>
        ) : tables.length === 0 ? (
           <div className="h-full flex items-center justify-center text-slate-400">
             {t('noTables')}
           </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {tables.map((entity) => (
              <div key={entity.name} className="border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-white shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl font-bold text-slate-900 mb-1">{entity.rowCount.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entity.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 flex items-center justify-end border-t border-slate-100">
        <button
          onClick={onNext}
          className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
}
