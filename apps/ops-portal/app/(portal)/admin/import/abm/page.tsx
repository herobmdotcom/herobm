'use client';

import { useEffect, useState, useRef } from 'react';
import * as api from '@modbm/sdk';
import { reportError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { CURRENCIES, getCurrencyByAbmCode } from '@/lib/currency';

type Step = 'config' | 'preview' | 'executing' | 'finalisation';

export default function AdminImportPage() {
  const router = useRouter();
  const t = useTranslations('setup.dataImport');
  // Re-use extraction translations for the config step
  const tExt = useTranslations('setup.extraction');
  
  const [step, setStep] = useState<Step>('config');
  const [loading, setLoading] = useState(false);
  
  const [config, setConfig] = useState({
    host: '',
    port: '1433',
    database: '',
    username: '',
    password: '',
    extractionMode: 'full' as 'full' | 'resume' | 'skip',
    defaultLocationCode: '',
    baseCurrency: 'AUD',
    defaultTaxCategoryCode: ''
  });
  
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'starting' | 'running' | 'completed' | 'failed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedTables, setCompletedTables] = useState<string[] | null>(null);
  const [abmLocations, setAbmLocations] = useState<any[]>([]);
  const [abmTaxCategories, setAbmTaxCategories] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{products: number, customers: number, orders: number} | null>(null);
  
  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<any>(null);
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
    if (step === 'preview') {
      api.setupControllerGetResumeState()
        .then((res: unknown) => setCompletedTables((res as { completedTables?: string[] })?.completedTables || []))
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
      const res: any = await api.setupControllerTestAbm({
        host: config.host,
        port: parseInt(config.port, 10),
        database: config.database,
        username: config.username,
        password: config.password,
      });
      
      if (res.success === false) {
        toast.error(res.message || tExt('toasts.connectionFailed', { fallback: 'Connection Failed' }));
      } else {
        toast.success(res.message || tExt('toasts.connectionVerified', { fallback: 'Connection Verified' }));
        const locs = res.preview?.locations || [];
        setAbmLocations(locs);
        if (locs.length > 0) {
           setConfig(prev => ({ ...prev, defaultLocationCode: locs[0].code }));
        }
        if (res.preview?.baseCurrencyAbmCode !== undefined) {
           const mappedCurr = getCurrencyByAbmCode(res.preview.baseCurrencyAbmCode);
           setConfig(prev => ({ ...prev, baseCurrency: mappedCurr.code }));
        }
        
        const taxes = res.preview?.taxCategories || [];
        setAbmTaxCategories(taxes);
        if (taxes.length > 0) {
          // Find tax category with highest rate > 0
          const sortedTaxes = [...taxes].sort((a, b) => b.rate - a.rate);
          const highestTax = sortedTaxes.find(t => t.rate > 0) || sortedTaxes[0];
          setConfig(prev => ({ ...prev, defaultTaxCategoryCode: highestTax.code }));
        }
        
        setStep('preview');
      }
    } catch (err: any) {
      toast.error(err.message || tExt('toasts.apiError', { fallback: 'API Error' }));
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
        abmImport: true,
        resumeExtraction: config.extractionMode === 'resume',
        skipExtraction: config.extractionMode === 'skip',
        defaultLocationCode: config.defaultLocationCode,
        baseCurrency: config.baseCurrency,
        defaultTaxCategoryCode: config.defaultTaxCategoryCode,
      };

      setStep('executing');
      setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`]);
      setStatus('starting');

      const res: any = await api.setupControllerExecuteElt(executePayload as any);
      jobIdRef.current = res.jobId;
      setStatus('running');
      startPolling(res.jobId);
    } catch (err: any) {
      setStatus('failed');
      setErrorMsg(err.message || 'Failed to start ELT execution.');
      setLogs(prev => [...prev, `[ERROR]: Failed to start ELT execution.`]);
    }
  };

  const startPolling = (jobId: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const progressRes: any = await api.setupControllerGetProgress(jobId);
        if (progressRes) {
          if (progressRes.logs && progressRes.logs.length > 0) {
             setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`, ...progressRes.logs]);
          }
          
          if (progressRes.status === 'completed' || progressRes.status === 'done') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
          } else if (progressRes.status === 'failed') {
            setStatus('failed');
            setErrorMsg(progressRes.error || 'Execution failed on backend.');
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err: any) {
        if (err.status === 404 || err.message?.includes('not found') || err.message?.toLowerCase().includes('job not found')) {
          setStatus('failed');
          setErrorMsg('Job not found. The server might have restarted.');
          clearInterval(pollTimerRef.current);
        } else {
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
           status === 'pending' ? t('titlePending', { fallback: 'Configure Import' }) :
           status === 'failed' ? t('titleFailed', { fallback: 'Import Failed' }) : 
           status === 'completed' ? t('titleCompleted', { fallback: 'Import Completed' }) : 
           t('titleRunning', { fallback: 'Import Running' })}
        </h1>
        <p className="text-slate-500">
          {step === 'config' ? t('connectSourceSystemDesc') :
           step === 'finalisation' ? t('descFinalisation') :
           status === 'pending' ? t('descPending', { fallback: 'Review settings' }) :
           status === 'failed' ? t('descFailed', { fallback: 'Check the logs' }) : 
           status === 'completed' ? t('descCompleted', { fallback: 'Done' }) : 
           t('descRunning', { fallback: 'Please wait...' })}
        </p>
      </div>

      {step === 'config' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.host', { fallback: 'Host' })}</label>
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
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.port', { fallback: 'Port' })}</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                placeholder="1433"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.database', { fallback: 'Database' })}</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
              placeholder="Company_DB"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.username', { fallback: 'Username' })}</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                placeholder="admin"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 tracking-wide uppercase">{tExt('fields.password', { fallback: 'Password' })}</label>
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
              {loading ? tExt('testing', { fallback: 'Testing...' }) : tExt('testConnection', { fallback: 'Test Connection & Continue' })}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">{t('defaultLocation')}</h2>
              <p className="text-sm text-slate-500 mb-4">{t('defaultLocationDesc')}</p>
              <select
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                value={config.defaultLocationCode}
                onChange={(e) => setConfig({ ...config, defaultLocationCode: e.target.value })}
              >
                {abmLocations.map(loc => (
                  <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">{t('systemBaseCurrency')}</h2>
              <p className="text-sm text-slate-500 mb-4">{t('systemBaseCurrencyDesc')}</p>
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
            
            {abmTaxCategories.length > 0 && (
              <div className="col-span-2 mt-2">
                <h2 className="text-xl font-bold text-slate-800 mb-4">{t('defaultTaxCategory', { fallback: 'Default Tax Category' })}</h2>
                <p className="text-sm text-slate-500 mb-4">{t('defaultTaxCategoryDesc', { fallback: 'Select the default tax category to use when a category is missing or omitted.' })}</p>
                <select
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c]"
                  value={config.defaultTaxCategoryCode}
                  onChange={(e) => setConfig({ ...config, defaultTaxCategoryCode: e.target.value })}
                >
                  {abmTaxCategories.map(tax => (
                    <option key={tax.code} value={tax.code}>{tax.name} ({tax.rate}%) - {tax.code}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-4">{t('sections.executionOptions', { fallback: 'Execution Options' })}</h2>
          
          <div className="flex flex-col gap-4 mb-8">
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={config.extractionMode === 'resume'}>
              <input 
                type="radio" 
                name="extractionMode" 
                checked={config.extractionMode === 'resume'}
                onChange={() => setConfig({ ...config, extractionMode: 'resume' })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  {t('options.resumeModeTitle', { fallback: 'Resume from Checkpoint' })}
                  {completedTables !== null && (
                    <span className="bg-[#006b5c]/10 text-[#006b5c] text-xs font-bold px-2 py-0.5 rounded-full">
                      {t('options.tablesCached', { count: completedTables.length, fallback: `${completedTables.length} tables cached` })}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{t('options.resumeModeDesc', { fallback: 'Skip already imported tables.' })}</div>
                
                {completedTables !== null && completedTables.length > 0 && (
                  <div className="mt-3 text-xs font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded p-2 max-h-24 overflow-y-auto">
                    <strong>{t('options.alreadyStaged', { fallback: 'Already staged: ' })}</strong> 
                    {completedTables.join(', ')}
                  </div>
                )}
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={config.extractionMode === 'skip'}>
              <input 
                type="radio" 
                name="extractionMode" 
                checked={config.extractionMode === 'skip'}
                onChange={() => setConfig({ ...config, extractionMode: 'skip' })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{tExt('skip', { fallback: 'Skip extraction (Empty Base)' })}</div>
                <div className="text-sm text-slate-500">{tExt('skipDesc', { fallback: 'Proceed directly to transformation. No new data will be extracted.' })}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={config.extractionMode === 'full'}>
              <input 
                type="radio" 
                name="extractionMode" 
                checked={config.extractionMode === 'full'}
                onChange={() => setConfig({ ...config, extractionMode: 'full' })}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('options.fullExtractionTitle', { fallback: 'Full Extraction' })}</div>
                <div className="text-sm text-slate-500">{t('options.fullExtractionDesc', { fallback: 'Extract everything from scratch.' })}</div>
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
              {t('buttons.startExecution', { fallback: 'Start Import' })}
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
          <div className="ml-4 text-slate-400 text-xs font-medium">{t('sections.terminal', { fallback: 'Terminal Output' })}</div>
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
              <span>{t('errors.criticalError', { message: errorMsg, fallback: `Critical Error: ${errorMsg}` })}</span>
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
            {t('buttons.goToDashboard', { fallback: 'Go to Dashboard' })}
          </button>
        </div>
      )}
      
      {step === 'executing' && status === 'completed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => {
              api.setupControllerGetImportSummary().then(summary => {
                 setImportSummary(summary as unknown as import('@modbm/sdk').ImportSummaryDto);
                 setStep('finalisation');
              }).catch(err => {
                 reportError(err, 'AdminImportPage.pollProgress.importSummary');
                 setStep('finalisation');
              });
            }}
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             {t('buttons.continueToSummary', { fallback: 'Continue to Summary' })}
           </button>
        </div>
      )}

      {step === 'executing' && status === 'failed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => { setStep('config'); setStatus('pending'); }}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             {t('buttons.retryImport', { fallback: 'Retry Import' })}
           </button>
        </div>
      )}
    </div>
  );
}
