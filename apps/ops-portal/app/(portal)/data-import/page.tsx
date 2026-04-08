'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function DataImportPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'starting' | 'running' | 'completed' | 'failed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [completedTables, setCompletedTables] = useState<string[] | null>(null);
  
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
    const rawConfig = localStorage.getItem('hero_pending_elt');
    if (!rawConfig) {
      setStatus('failed');
      setErrorMsg('No pending import configuration found in local storage.');
      return;
    }
    setConfig(JSON.parse(rawConfig));

    apiFetch<any>('/api/setup/resume-state')
      .then(res => setCompletedTables(res?.completedTables || []))
      .catch(() => setCompletedTables([]));

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleStartElt = async () => {
    if (!config) return;
    try {
      // Update local storage in case they refresh midway
      localStorage.setItem('hero_pending_elt', JSON.stringify(config));
      
      setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`]);
      setStatus('starting');

      const res = await apiMutate<any>('/api/setup/execute-elt', 'POST', config);
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
        const progressRes = await apiFetch<any>(`/api/setup/progress/${jobId}`);
        if (progressRes) {
          if (progressRes.logs && progressRes.logs.length > 0) {
             setLogs([`--- Initializing ABM Extract-Load-Transform pipeline ---`, `Submitting secure authorized configuration...`, ...progressRes.logs]);
          }
          
          if (progressRes.status === 'completed' || progressRes.status === 'done') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
            localStorage.removeItem('hero_pending_elt');
          } else if (progressRes.status === 'failed') {
            setStatus('failed');
            setErrorMsg(progressRes.error || 'Execution failed on backend.');
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        reportError(err, 'Polling error');
      }
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-5xl mx-auto w-full h-[calc(100vh-64px)]">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {status === 'pending' ? 'Data Import Staged' :
           status === 'failed' ? 'Data Import Failed' : 
           status === 'completed' ? 'Data Import Complete' : 'Executing Data Import'}
        </h1>
        <p className="text-slate-500">
          {status === 'pending'
            ? 'Your legacy Data Import task is ready to begin. Review extraction settings before confirming.'
            : status === 'failed' 
            ? 'The ABM extract-load-transform sequence failed to complete safely.' 
            : status === 'completed'
            ? 'Your legacy data has been successfully imported into the HeroBM platform.'
            : 'Migrating legacy ERP records into HeroBM databases using dbt pipelines...'}
        </p>
      </div>

      {status === 'pending' && config && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6 max-w-2xl mx-auto w-full">
          
          <h2 className="text-xl font-bold text-slate-800 mb-4">Confirmed Settings</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-sm text-slate-800 whitespace-pre leading-relaxed mb-8 flex-1">
            {[
              `# Execution Payload`,
              `Pipeline: ${!config.abmImport ? 'STERILE_INIT' : 'ENABLE_DLT_ABM_IMPORT'}`,
              `Source:   ${!config.abmImport || !config.dbConfig ? 'None' : `read_only@${config.dbConfig.host}:${config.dbConfig.port}/${config.dbConfig.database}`}`,
              `Company Name: ${config.companyName}`,
              `COA Preset: ${config.coaPreset}`,
              `Currency: ${config.baseCurrency}`,
              `Fiscal Start Month: ${config.fiscalYearStartMonth}`,
              `Valuation Strategy: ${config.inventoryValuationMethod || 'weighted_average'}`,
              `Billing Mode: ${config.nonStockBillingMode || 'per_shipment'}`,
              `Default Fulfillment Location: ${config.defaultLocationCode || 'System Default'}`,
              `Revenue Routing: ${config.revenueRoutingPrecedence}`,
              `Expense Routing: ${config.expenseRoutingPrecedence}`
            ].join('\n')}
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-4">Execution Options</h2>
          
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
                  Resume Mode (Recommended)
                  {completedTables !== null && (
                    <span className="bg-[#006b5c]/10 text-[#006b5c] text-xs font-bold px-2 py-0.5 rounded-full">
                      {completedTables.length} Tables Cached
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">Skip tables that have already been fully extracted successfully and only pull missing tables. This is much faster.</div>
                
                {completedTables !== null && completedTables.length > 0 && (
                  <div className="mt-3 text-xs font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded p-2 max-h-24 overflow-y-auto">
                    <strong>Already Staged: </strong> 
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
                <div className="font-bold text-slate-800">Full Extraction</div>
                <div className="text-sm text-slate-500">Wipe the staging area and pull every single table firmly from scratch. Required if upstream schema changed.</div>
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleStartElt}
              className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
            >
              Start Execution
            </button>
          </div>
        </div>
      )}

      {status !== 'pending' && (
      <div className="bg-[#0f172a] rounded-xl overflow-hidden shadow-lg flex-1 mb-6 flex flex-col font-mono text-sm border border-slate-800">
        <div className="bg-[#1e293b] px-4 py-3 flex items-center gap-2 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
          <div className="ml-4 text-slate-400 text-xs font-medium">etl-worker terminal</div>
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
              <span>Critical Error: {errorMsg}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      )}

      {status === 'completed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in">
          <button
            onClick={() => router.push('/')}
            className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
          >
            Go to Dashboard
          </button>
        </div>
      )}
      
      {status === 'failed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => setStatus('pending')}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             Retry Import
           </button>
           <button
            onClick={() => router.push('/')}
            className="text-slate-500 hover:text-slate-800 underline"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
