'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@modbm/sdk';
import { reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';

type Step = 'config' | 'preview' | 'executing' | 'finalisation';

export default function CsvImportPage() {
  const router = useRouter();
  const t = useTranslations('setup.dataImport');
  
  const [step, setStep] = useState<Step>('config');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState<'insert' | 'upsert' | 'ignore'>('insert');
  
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'starting' | 'running' | 'completed' | 'failed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
    api.setupControllerGetCsvMetadata().then(data => {
      setTables(data as any[]);
      if ((data as any[]).length > 0) setSelectedTable((data as any[])[0].id);
    }).catch(err => toast.error('Failed to load table metadata'));
  }, []);

  const handleDownloadTemplate = () => {
    const table = tables.find(t => t.id === selectedTable);
    if (!table) return;
    const headerRow = table.columns.join(',') + '\n';
    const blob = new Blob([headerRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${table.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;
    try {
      setStatus('starting');
      setStep('executing');
      
      const formData = new FormData();
      formData.append('tableName', selectedTable);
      formData.append('strategy', strategy);
      formData.append('file', file);

      // Using SDK with FormData
      const data = await api.setupControllerExecuteCsv({
        method: 'POST',
        body: formData as any,
      });

      jobIdRef.current = (data as any).jobId;
      startPolling((data as any).jobId);
    } catch (err: any) {
      setStatus('failed');
      setErrorMsg(err.message);
    }
  };

  const startPolling = (jobId: string) => {
    setStatus('running');
    setLogs(['Connecting to background job...', `JobID: ${jobId}`]);
    
    pollTimerRef.current = setInterval(async () => {
      try {
        const progressRes = await api.setupControllerGetProgress(jobId);
        if (progressRes) {
          if (progressRes.logs) {
            setLogs(progressRes.logs);
          }
          if (progressRes.status === 'completed' || progressRes.status === 'done') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
            api.setupControllerGetImportSummary().then(summary => {
               setImportSummary(summary as any);
               setStep('finalisation');
            }).catch(err => {
               reportError(err, 'CsvImportPage.pollProgress.importSummary');
               setStep('finalisation');
            });
          } else if (progressRes.status === 'failed') {
            setStatus('failed');
            setErrorMsg(progressRes.error || 'Execution failed on backend.');
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        reportError(err, 'CsvImportPage.pollProgress');
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col p-8 max-w-5xl mx-auto w-full min-h-[calc(100vh-64px)]">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {step === 'config' ? t('titleConfig') : 
           step === 'preview' ? t('titlePreview') :
           step === 'finalisation' ? t('titleFinalisation') :
           status === 'pending' ? t('titlePending') :
           status === 'failed' ? t('titleFailed') : 
           status === 'completed' ? t('titleCompleted') : 
           t('titleRunning')}
        </h1>
        <p className="text-slate-500">
          {step === 'config' ? t('descConfig') :
           step === 'preview' ? t('descPreview') :
           step === 'finalisation' ? t('descFinalisation') :
           status === 'pending' ? t('descPending') :
           status === 'failed' ? t('descFailed') : 
           status === 'completed' ? t('descCompleted') : 
           t('descRunning')}
        </p>
      </div>

      {step === 'config' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-lg mx-auto w-full animate-in fade-in">
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('targetTable')}</label>
            <select
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c] transition-colors"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-8 flex justify-start">
             <button
               onClick={handleDownloadTemplate}
               className="text-[#006b5c] hover:text-[#005246] hover:underline font-medium transition-colors"
             >
               {t('downloadTemplate')}
             </button>
          </div>
          
          <button
            onClick={() => setStep('preview')}
            className="w-full bg-[#006b5c] hover:bg-[#005246] text-white px-4 py-3 rounded-lg font-bold transition-colors shadow-sm"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          <div className="mb-8 pb-8 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{t('fileUpload')}</h2>
            
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-lg font-bold transition-colors inline-flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {t('chooseFile')}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-sm font-medium text-slate-600 truncate max-w-xs">
                {file ? file.name : t('noFileChosen')}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-4">{t('mergeStrategy')}</h2>
          <div className="flex flex-col gap-4 mb-8">
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={strategy === 'insert'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'insert'}
                onChange={() => setStrategy('insert')}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('insertOnly')}</div>
                <div className="text-sm text-slate-500">{t('insertOnlyDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={strategy === 'ignore'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'ignore'}
                onChange={() => setStrategy('ignore')}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('insertNewOnly')}</div>
                <div className="text-sm text-slate-500">{t('insertNewOnlyDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 aria-selected:border-[#006b5c] aria-selected:bg-[#f0f9f8]" aria-selected={strategy === 'upsert'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'upsert'}
                onChange={() => setStrategy('upsert')}
                className="mt-1 text-[#006b5c] focus:ring-[#006b5c]" 
              />
              <div>
                <div className="font-bold text-slate-800">{t('upsertMerge')}</div>
                <div className="text-sm text-slate-500">{t('upsertMergeDesc')}</div>
              </div>
            </label>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            <button
              onClick={() => setStep('config')}
              className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2"
            >
              {t('back')}
            </button>
            <button
              onClick={handleStartImport}
              disabled={!file}
              className="bg-[#006b5c] hover:bg-[#005246] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              {t('startImport')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
          <div className="ml-4 text-slate-400 text-xs font-medium">{t('csvOutput')}</div>
        </div>
        <div 
          ref={scrollContainerRef} 
          onScroll={handleScroll} 
          className="p-6 flex-1 overflow-y-auto max-h-[600px]"
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
              <span>{t('criticalError')} {errorMsg}</span>
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
          <p className="text-slate-500 mb-8">{t('importSuccessfulDesc')}</p>

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
            {t('goToDashboard')}
          </button>
        </div>
      )}
      
      {step === 'executing' && status === 'failed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <button
            onClick={() => { setStep('config'); setStatus('pending'); }}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
           >
             {t('retryImport')}
           </button>
           <button
            onClick={() => router.push('/')}
            className="text-slate-500 hover:text-slate-800 underline"
          >
            {t('returnToDashboard')}
          </button>
        </div>
      )}
    </div>
  );
}
