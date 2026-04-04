'use client';

import { useState } from 'react';
import { apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  updateConfig: (updates: Partial<ConfigState>) => void;
  onNext: () => void;
}

export default function ExtractionStep({ config, updateConfig, onNext }: Props) {
  const t = useTranslations('setup.extraction');
  const [loading, setLoading] = useState(false);
  
  const isFormValid = config.host.trim() !== '' && 
                      config.port.trim() !== '' && 
                      config.database.trim() !== '' && 
                      config.username.trim() !== '';

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const res = await apiMutate<any>('/api/setup/test-abm', 'POST', {
        host: config.host,
        port: parseInt(config.port, 10),
        database: config.database,
        username: config.username,
        password: config.password || '',
      });
      
      if (res.success === false) {
        toast.error(res.message || t('toasts.connectionFailed'));
      } else {
        toast.success(res.message || t('toasts.connectionVerified'));
        onNext();
      }
    } catch (err: any) {
      toast.error(err.message || t('toasts.apiError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('title')}</h2>
        <p className="text-slate-500">
          {t('description')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.host')}</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="localhost"
            value={config.host}
            onChange={(e) => updateConfig({ host: e.target.value })}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.port')}</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="1433"
            value={config.port}
            onChange={(e) => updateConfig({ port: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.database')}</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="Company_DB"
          value={config.database}
          onChange={(e) => updateConfig({ database: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.username')}</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            placeholder="admin"
            value={config.username}
            onChange={(e) => updateConfig({ username: e.target.value })}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{t('fields.password')}</label>
          <input
            type="password"
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
            value={config.password || ''}
            onChange={(e) => updateConfig({ password: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <input
          type="checkbox"
          id="resumeCheck"
          className="w-5 h-5 rounded border-slate-300 text-[#006b5c] focus:ring-[#006b5c]"
          checked={config.resume}
          onChange={(e) => updateConfig({ resume: e.target.checked })}
          disabled={loading}
        />
        <label htmlFor="resumeCheck" className="text-slate-800 font-medium cursor-pointer">
          {t('resume')} <span className="text-slate-400 font-normal">{t('resumeNote')}</span>
        </label>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-100">
        <button 
          onClick={() => { updateConfig({ emptyBase: true }); onNext(); }}
          className="text-slate-500 hover:text-slate-800 font-medium"
          disabled={loading}
        >
          {t('skip')}
        </button>
        <button
          onClick={handleTestConnection}
          disabled={!isFormValid || loading}
          className={`px-8 py-3 rounded-lg font-bold transition-colors shadow-sm ${
            !isFormValid || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#006b5c] hover:bg-[#005246] text-white cursor-pointer'
          }`}
        >
          {loading ? t('testing') : t('testConnection')}
        </button>

      </div>
    </div>
  );
}
