'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
}

export default function ExecutingStep({ config }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'starting' | 'running' | 'completed' | 'failed'>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, status, errorMsg]);

  useEffect(() => {
    async function startSetup() {
      try {
        setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting configuration...`]);
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
          nonStockBillingMode: config.nonStockBilling || 'per_shipment',
          revenueRoutingPrecedence: config.revenueRouting.includes('Product') ? 'product_first' : 'customer_first',
          expenseRoutingPrecedence: config.expenseRouting.includes('Product') ? 'product_first' : 'supplier_first'
        };

        const res = await apiMutate<any>('/api/setup/execute', 'POST', executePayload);
        jobIdRef.current = res.jobId;
        setStatus('running');
        startPolling(res.jobId);
      } catch (err: any) {
        setStatus('failed');
        setErrorMsg(err.message || 'Failed to start setup execution.');
        setLogs(prev => [...prev, `[ERROR]: Failed to start setup execution.`]);
      }
    }
    
    startSetup();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const startPolling = (jobId: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const progressRes = await apiFetch<any>(`/api/setup/progress/${jobId}`);
        if (progressRes) {
          if (progressRes.logs && progressRes.logs.length > 0) {
             // Logs from backend are usually the complete array, we will just sync it.
             setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting configuration...`, ...progressRes.logs]);
          }
          
          if (progressRes.status === 'completed') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
          } else if (progressRes.status === 'failed') {
            setStatus('failed');
            setErrorMsg(progressRes.error || 'Execution failed on backend.');
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.error('Polling error', err);
        // We do not stop polling on a temporary network error, but we could cap it.
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          {status === 'failed' ? 'Initialization Failed' : 'Initializing System'}
        </h2>
        <p className="text-slate-500">
          {status === 'failed' ? 'An error occurred during pipeline execution. Check the terminal below.' : 'Please do not close this window. This process may take a few minutes if extracting data.'}
        </p>
      </div>

      <div className="bg-[#0f172a] rounded-xl overflow-hidden shadow-lg flex-1 mb-6 flex flex-col font-mono text-sm border border-slate-800" style={{ maxHeight: '400px' }}>
        <div className="bg-[#1e293b] px-4 py-3 flex items-center gap-2 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
          <div className="ml-4 text-slate-400 text-xs font-medium">Terminal (pipeline-execution.log)</div>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
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
              <span>[CRITICAL]: {errorMsg}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {status === 'completed' && (
        <div className="mt-auto pt-4 flex items-center justify-center border-t border-slate-100 animate-in fade-in">
          <a
            href="/"
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
          >
            Go to Dashboard
          </a>
        </div>
      )}
      
      {status === 'failed' && (
        <div className="mt-auto pt-4 flex items-center justify-center border-t border-slate-100 animate-in fade-in">
           <span className="text-red-500 font-bold">Execution aborted. Please review error logs.</span>
        </div>
      )}
    </div>
  );
}
