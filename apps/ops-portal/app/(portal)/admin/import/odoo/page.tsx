'use client';

import { useEffect, useState, useRef } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { ExecuteEltDtoSource } from '@herobm/sdk';
import { CURRENCIES, getCurrencyByAbmCode } from '@/lib/currency';
import { getErrorMessage } from '@herobm/shared';

type Step = 'config' | 'preview' | 'executing' | 'finalisation';

export default function OdooImportPage() {
  const router = useRouter();
  const t = useTranslations('setup.dataImport');
  const tExt = useTranslations('setup.extraction');
  
  const [step, setStep] = useState<Step>('config');
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState({
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    resumeExtraction: false,
    defaultLocationCode: '',
    baseCurrency: 'EUR',
    defaultTaxCategoryCode: '',
    enableCustomImports: false
  });
  
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'starting' | 'running' | 'completed' | 'failed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedTables, setCompletedTables] = useState<string[] | null>(null);
  const [odooLocations, setOdooLocations] = useState<{ code: string; name: string }[]>([]);
  const [odooTaxCategories, setOdooTaxCategories] = useState<{ code: string; name: string; rate: number }[]>([]);
  const [importSummary, setImportSummary] = useState<{products: number, customers: number, orders: number} | null>(null);
  const [stopping, setStopping] = useState(false);
  
  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef<boolean>(true);

  useEffect(() => {
    if (isAutoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView();
    }
  }, [logs, status, errorMsg]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  useEffect(() => {
    api.setupControllerGetActiveJob()
      .then((res) => {
        if (res.data.jobId && res.data.type === 'odoo') {
          jobIdRef.current = res.data.jobId;
          setStep('executing');
          startPolling(res.data.jobId);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (step === 'preview') {
      api.setupControllerGetResumeStateOdoo()
        .then((res) => setCompletedTables(res.data.completedTables || []))
        .catch(() => setCompletedTables([]));
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [step]);

  const isFormValid = config.host.trim() !== '' && 
                      config.port.trim() !== '' && 
                      config.database.trim() !== '' && 
                      config.username.trim() !== '';

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const res = await api.setupControllerTestOdoo({
        host: config.host,
        port: parseInt(config.port, 10),
        database: config.database,
        username: config.username,
        password: config.password,
      });
      const result = res.data;
      
      if (result.success === false) {
        toast.error(result.message || tExt('toasts.connectionFailed'));
      } else {
        toast.success(result.message || tExt('toasts.connectionVerified'));
        const preview = result.preview as Record<string, unknown> | undefined;
        const locs = (preview?.locations || []) as { code: string; name: string }[];
        setOdooLocations(locs);
        if (locs.length > 0) {
           setConfig(prev => ({ ...prev, defaultLocationCode: locs[0].code }));
        }
        const mappedCurr = getCurrencyByAbmCode(preview?.baseCurrencyAbmCode as number);
        if (mappedCurr !== undefined && preview?.baseCurrencyCode !== undefined) {
           setConfig(prev => ({ ...prev, baseCurrency: preview!.baseCurrencyCode as string }));
        }
        
        const taxes = (preview?.taxCategories || []) as { code: string; name: string; rate: number }[];
        setOdooTaxCategories(taxes);
        if (taxes.length > 0) {
          // Find tax category with highest rate > 0
          const sortedTaxes = [...taxes].sort((a, b) => b.rate - a.rate);
          const highestTax = sortedTaxes.find(t => t.rate > 0) || sortedTaxes[0];
          setConfig(prev => ({ ...prev, defaultTaxCategoryCode: highestTax.code }));
        }
        
        setStep('preview');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || tExt('toasts.apiError'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartElt = async () => {
    try {
      const executePayload = {
        dbConfig: {
          host: config.host,
          database: config.database,
          username: config.username,
          password: config.password,
          port: parseInt(config.port, 10)
        },
        source: ExecuteEltDtoSource.odoo,
        resumeExtraction: config.resumeExtraction,
        defaultLocationCode: config.defaultLocationCode,
        baseCurrency: config.baseCurrency,
        defaultTaxCategoryCode: config.defaultTaxCategoryCode,
        enableCustomImports: config.enableCustomImports,
      };

      setStep('executing');
      setLogs([`--- Initializing Odoo Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`]);
      setStatus('starting');

      const res = await api.setupControllerExecuteElt(executePayload);
      jobIdRef.current = res.data.jobId;
      setStatus('running');
      startPolling(res.data.jobId);
    } catch (err: unknown) {
      setStatus('failed');
      setErrorMsg(getErrorMessage(err) || 'Failed to start ELT execution.');
      setLogs(prev => [...prev, `[ERROR]: Failed to start ELT execution.`]);
    }
  };

  const handleStopJob = async () => {
    if (!jobIdRef.current) return;
    try {
      setStopping(true);
      await api.setupControllerStopJob(jobIdRef.current);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to stop job');
    } finally {
      setStopping(false);
    }
  };

  const startPolling = (jobId: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const progressRes = await api.setupControllerGetProgress(jobId);
        const progress = progressRes.data;
        if (progress) {
          if (progress.logs && progress.logs.length > 0) {
             setLogs([`--- Initializing Odoo Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`, ...progress.logs]);
          }
          
          if (progress.status === 'completed' || progress.status === 'done') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
            try {
              const stateRes = await api.setupControllerGetResumeStateOdoo();
              const count = stateRes.data.completedTables?.length || 0;
              setLogs(prev => [...prev, `Extraction finished. Successfully extracted ${count} tables.`]);
            } catch(e) { /* ignore */ }
          } else if (progress.status === 'failed') {
            setStatus('failed');
            // Extract error from logs if available, else generic error
            const errorLog = progress.logs?.find((l: string) => l.includes('[ERROR]')) || 'Execution failed on backend.';
            setErrorMsg(errorLog);
            clearInterval(pollTimerRef.current);
            try {
              const stateRes = await api.setupControllerGetResumeStateOdoo();
              const count = stateRes.data.completedTables?.length || 0;
              setLogs(prev => [...prev, `Job stopped or failed. Safely extracted ${count} tables before terminating.`]);
            } catch(e) { /* ignore */ }
          }
        }
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 404 || getErrorMessage(err)?.includes('not found') || getErrorMessage(err)?.toLowerCase().includes('job not found')) {
          setStatus('failed');
          setErrorMsg('Job not found. The server might have restarted.');
          clearInterval(pollTimerRef.current);
        } else if ((err as { status?: number })?.status === 409) {
          reportError(err, 'Polling error');
        }
      }
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-5xl mx-auto w-full min-h-[calc(100vh-64px)]">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {step === 'config' ? t('connectSourceSystem') : 
           step === 'finalisation' ? t('titleFinalisation') :
           status === 'pending' ? t('titlePending') :
           status === 'failed' ? t('titleFailed') : 
           status === 'completed' ? t('titleCompleted') : 
           t('titleRunning')}
        </h1>
        <p className="text-slate-500">
          {step === 'config' ? t('connectSourceSystemDescOdoo') :
           step === 'finalisation' ? t('descFinalisation') :
           status === 'pending' ? t('descPending') :
           status === 'failed' ? t('descFailed') : 
           status === 'completed' ? t('descCompleted') : 
           t('descRunning')}
        </p>
      </div>

      {step === 'config' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.host')}</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                placeholder="localhost"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.port')}</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                placeholder="5432"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.database')}</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
              placeholder="odoo"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.username')}</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                placeholder="odoo"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.password')}</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                value={config.password || ''}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="mt-auto pt-6 flex items-center justify-end border-t border-slate-100">
            <button
              onClick={handleTestConnection}
              disabled={!isFormValid || loading}
              className={`px-8 py-3 rounded-lg font-bold transition-colors shadow-sm ${
                !isFormValid || loading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#006b5c] hover:bg-[#005246] text-white cursor-pointer'
              }`}
            >
              {loading ? tExt('testing') : tExt('testConnection')}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">{t('defaultLocation')}</h2>
              <p className="text-sm text-slate-500 mb-4">{t('defaultLocationDescOdoo')}</p>
              <select
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                value={config.defaultLocationCode}
                onChange={(e) => setConfig({ ...config, defaultLocationCode: e.target.value })}
              >
                {odooLocations.map(loc => (
                  <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">{t('systemBaseCurrency')}</h2>
              <p className="text-sm text-slate-500 mb-4">{t('systemBaseCurrencyDescOdoo')}</p>
              <select
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                value={config.baseCurrency}
                onChange={(e) => setConfig({ ...config, baseCurrency: e.target.value })}
              >
                {CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>{curr.name} ({curr.code})</option>
                ))}
              </select>
            </div>
            
            {odooTaxCategories.length > 0 && (
              <div className="col-span-2 mt-2">
                <h2 className="text-xl font-bold text-slate-800 mb-4">{t('defaultTaxCategory')}</h2>
                <p className="text-sm text-slate-500 mb-4">{t('defaultTaxCategoryDesc')}</p>
                <select
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                  value={config.defaultTaxCategoryCode}
                  onChange={(e) => setConfig({ ...config, defaultTaxCategoryCode: e.target.value })}
                >
                  {odooTaxCategories.map(tax => (
                    <option key={tax.code} value={tax.code}>{t('taxFormat', { name: tax.name, rate: tax.rate, code: tax.code })}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-4">{t('sections.executionOptions')}</h2>
          
          <div className="flex flex-col gap-4 mb-8">
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={config.resumeExtraction}>
              <input 
                type="radio" 
                name="resumeMode" 
                checked={config.resumeExtraction === true}
                onChange={() => setConfig({ ...config, resumeExtraction: true })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  {t('options.resumeModeTitle')}
                  {completedTables !== null && (
                    <span className="bg-[#006b5c]/10 text-[#006b5c] text-xs font-bold px-2 py-0.5 rounded-full">
                      {t('options.tablesCached', { count: completedTables.length })}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{t('options.resumeModeDesc')}</div>
                
                {completedTables !== null && completedTables.length > 0 && (
                  <div className="mt-3 text-xs font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded p-2 max-h-24 overflow-y-auto">
                    <strong>{t('options.alreadyStaged')}</strong> 
                    {completedTables.join(', ')}
                  </div>
                )}
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={!config.resumeExtraction}>
              <input 
                type="radio" 
                name="resumeMode" 
                checked={config.resumeExtraction === false}
                onChange={() => setConfig({ ...config, resumeExtraction: false })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('options.fullExtractionTitle')}</div>
                <div className="text-sm text-slate-500">{t('options.fullExtractionDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50">
              <input 
                type="checkbox" 
                checked={config.enableCustomImports}
                onChange={(e) => setConfig({ ...config, enableCustomImports: e.target.checked })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c] rounded" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('options.enableCustomImports')}</div>
                <div className="text-sm text-slate-500">{t('options.enableCustomImportsDesc')}</div>
              </div>
            </label>
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-6">
            <button
              onClick={() => setStep('config')}
              className="text-slate-500 hover:text-slate-800 font-medium"
            >
              {t('back')}
            </button>
            <button
              onClick={handleStartElt}
              className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
            >
              {t('buttons.startExecution')}
            </button>
          </div>
        </div>
      )}

      {step === 'executing' && (
      <div className="bg-[#0f172a] rounded-xl overflow-hidden shadow-lg flex-1 mb-6 flex flex-col font-mono text-sm border border-slate-800 animate-in fade-in">
        <div className="bg-[#1e293b] px-4 py-3 flex items-center gap-2 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
          <div className="ml-4 text-slate-400 text-xs font-medium flex-1">{t('sections.terminal')}</div>
          {status === 'running' && (
            <button 
              onClick={handleStopJob}
              disabled={stopping}
              className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded font-bold text-xs transition-colors border border-red-500/20 disabled:opacity-50"
            >
              {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              {stopping ? 'Stopping...' : 'Stop Job'}
            </button>
          )}
        </div>
        <div 
          ref={scrollContainerRef} 
          onScroll={handleScroll} 
          className="p-6 flex-1 overflow-y-auto"
        >
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 mb-3 text-slate-300">
              <span className="text-[#0ea5e9] select-none">{'>'}</span>
              <span>{log}</span>
            </div>
          ))}
          {status === 'running' && (
            <div className="flex gap-4 mb-3">
              <span className="text-[#0ea5e9] select-none">{'>'}</span>
              <span className="w-2.5 h-4 bg-[#10b981] animate-pulse"></span>
            </div>
          )}
          {status === 'failed' && errorMsg && (
            <div className="flex gap-4 mb-3 text-red-400">
              <span className="text-[#0ea5e9] select-none">{'>'}</span>
              <span>{t('errors.criticalError', { message: errorMsg })}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      )}

      {step === 'finalisation' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('importSuccessful')}</h2>
          <p className="text-slate-500 mb-8">{t('dbPopulated')}</p>

          {importSummary && (
            <div className="grid grid-cols-3 gap-6 mb-8 text-left">
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">{t('products')}</div>
                <div className="text-3xl font-bold text-slate-900">{importSummary.products.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">{t('customers')}</div>
                <div className="text-3xl font-bold text-slate-900">{importSummary.customers.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">{t('orders')}</div>
                <div className="text-3xl font-bold text-slate-900">{importSummary.orders.toLocaleString()}</div>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/')}
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm w-full"
          >
            {t('buttons.goToDashboard')}
          </button>
        </div>
      )}
      
      {step === 'executing' && status === 'completed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => {
              api.setupControllerGetImportSummary().then((summaryRes) => {
                 setImportSummary(summaryRes.data);
                 setStep('finalisation');
              }).catch(err => {
                 reportError(err, 'OdooImportPage.pollProgress.importSummary');
                 setStep('finalisation');
              });
            }}
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             {t('buttons.continueToSummary')}
           </button>
        </div>
      )}

      {step === 'executing' && status === 'failed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => { setStep('config'); setStatus('pending'); }}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             {t('buttons.retryImport')}
           </button>
        </div>
      )}
    </div>
  );
}
