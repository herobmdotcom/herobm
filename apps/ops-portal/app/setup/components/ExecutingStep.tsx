'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
}

export default function ExecutingStep({ config }: Props) {
  const t = useTranslations('setup.execution');
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'starting' | 'running' | 'completed' | 'failed'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef<boolean>(true);
  const hasStartedRef = useRef<boolean>(false);

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
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function startSetup() {
      try {
        setStatus('running');
        setLogs([`--- Initializing HeroBM Base System ---`, `Submitting configuration...`]);
        const monthMap: Record<string, number> = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };

        const executePayload = {
          dbConfig: config.emptyBase ? undefined : {
            host: config.host,
            database: config.database,
            username: config.username,
            password: config.password,
            port: parseInt(config.port, 10)
          },
          abmImport: !config.emptyBase,
          resumeExtraction: config.resume,

          coaPreset: config.coaPreset,
          baseCurrency: config.baseCurrency.split(' ')[0],
          fiscalYearStartMonth: monthMap[config.fiscalStartMonth] || 7,
          companyName: config.companyName,
          defaultLocationCode: config.primaryLocation !== 'none' ? config.primaryLocation : undefined,

          inventoryValuationMethod: config.inventoryValuation || 'weighted_average',
          inventoryAccountingMode: config.inventoryAccountingMode || 'periodic',
          nonStockBillingMode: config.nonStockBilling || 'per_shipment',
          revenueRoutingPrecedence: config.revenueRouting.includes('Product') ? 'product_first' : 'customer_first',
          expenseRoutingPrecedence: config.expenseRouting.includes('Product') ? 'product_first' : 'supplier_first'
        };

        // Run Phase 1 - Synchronization blocking call
        await apiMutate<any>('/api/setup/initialize', 'POST', executePayload);
        
        setLogs(prev => [...prev, `Base system initialization successful!`, `Admin user accounts created.`]);
        setStatus('completed');

        // If ELT is requested, save the payload for Phase 2
        if (executePayload.abmImport) {
           localStorage.setItem('hero_pending_elt', JSON.stringify(executePayload));
        }
        
      } catch (err: any) {
        setStatus('failed');
        setErrorMsg(err.message || 'Failed to initialize base system.');
        setLogs(prev => [...prev, `[ERROR]: Initializing base system failed.`]);
      }
    }
    
    startSetup();
  }, []);

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          {status === 'failed' ? t('failedTitle') : t('runningTitle')}
        </h2>
        <p className="text-slate-500">
          {status === 'failed' ? t('failedDescription') : t('runningDescription')}
        </p>
      </div>

      <div className="bg-[#0f172a] rounded-xl overflow-hidden shadow-lg flex-1 mb-6 flex flex-col font-mono text-sm border border-slate-800" style={{ maxHeight: '400px' }}>
        <div className="bg-[#1e293b] px-4 py-3 flex items-center gap-2 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
          <div className="ml-4 text-slate-400 text-xs font-medium">{t('terminalLabel')}</div>
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
              <span>{t('criticalError', { error: errorMsg })}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {status === 'completed' && (
        <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
          <p className="text-slate-600 mb-4 font-medium text-center">
            {/* eslint-disable no-restricted-syntax */}
            {config.emptyBase 
               ? "System successfully initialized. You must log in as 'admin' to access the platform."
               : "Base system initialized and user accounts created. You must log in as 'admin' to run the Data Import pipeline."}
            {/* eslint-enable no-restricted-syntax */}
          </p>
          <a
            href={config.emptyBase ? "/login" : "/data-import"}
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
          >
            {/* eslint-disable-next-line no-restricted-syntax */}
            {config.emptyBase ? t('goDashboard', { fallback: "Log In to Continue" }) : "Proceed to Data Import"}
          </a>
        </div>
      )}
      
      {status === 'failed' && (
        <div className="mt-auto pt-4 flex items-center justify-center border-t border-slate-100 animate-in fade-in">
           <span className="text-red-500 font-bold">{t('aborted')}</span>
        </div>
      )}
    </div>
  );
}
