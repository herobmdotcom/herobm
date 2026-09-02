'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/shared/Button';
import { useRouter } from 'next/navigation';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

type Step = 'config' | 'preview' | 'executing' | 'finalisation';

export default function CsvImportPage() {
  const router = useRouter();
  const t = useTranslations('setup.dataImport');
  
  const [step, setStep] = useState<Step>('config');
  const [tables, setTables] = useState<{ id: string; name: string; uniqueKey: string; columns: string[] }[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState<'insert' | 'upsert' | 'ignore'>('insert');
  
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'starting' | 'running' | 'completed' | 'failed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{products: number, customers: number, orders: number} | null>(null);
  
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
    api.setupControllerGetCsvMetadata().then((res) => {
      const arr = res.data;
      const sorted = [...arr].sort((a, b) => a.name.localeCompare(b.name));
      setTables(sorted);
      if (sorted.length > 0) setSelectedTable(sorted[0].id);
    }).catch(() => toast.error('Failed to load table metadata'));
  }, []);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.uniqueKey.toLowerCase().includes(q),
    );
  }, [tables, searchQuery]);

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
      const res = await api.setupControllerExecuteCsv({
        tableName: selectedTable,
        strategy: strategy,
        file: file,
      });

      const data = res.data as { jobId: string };
      jobIdRef.current = data.jobId;
      startPolling(data.jobId);
    } catch (err: unknown) {
      setStatus('failed');
      setErrorMsg(getErrorMessage(err));
    }
  };

  const startPolling = (jobId: string) => {
    setStatus('running');
    setLogs(['Connecting to background job...', `JobID: ${jobId}`]);
    
    pollTimerRef.current = setInterval(async () => {
      try {
        const progressRes = await api.setupControllerGetProgress(jobIdRef.current!);
        const progress = progressRes.data;
        if (progress) {
          if (progress.logs) {
             setLogs([`--- Initializing CSV processing pipeline ---`, ...progress.logs]);
          }
          if (progress.status === 'completed') {
            setStatus('completed');
            clearInterval(pollTimerRef.current);
            api.setupControllerGetImportSummary()
              .then((summaryRes) => {
                setImportSummary(summaryRes.data);
                setStep('finalisation');
              })
              .catch((err) => {
                toast.error('Failed to load import summary: ' + getErrorMessage(err));
                reportError(err, 'CsvImportPage.getImportSummary');
                setStep('finalisation');
              });
          } else if (progress.status === 'failed') {
            setStatus('failed');
            const errorLog = progress.logs?.find((l: string) => l.includes('[ERROR]')) || 'Execution failed on backend.';
            setErrorMsg(errorLog);
            clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        reportError(err, 'CsvImportPage.pollProgress');
        setErrorMsg(getErrorMessage(err));
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
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-8 max-w-2xl mx-auto w-full animate-in fade-in shadow-sm">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-[var(--text-primary)]">
                {t('targetTable')}
              </label>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {t('availableEntities', { count: tables.length })}
              </span>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder={t('searchTables')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-lg divide-y divide-[var(--border)] bg-[var(--bg-secondary)]">
              {filteredTables.map((tbl) => {
                const isSelected = tbl.id === selectedTable;
                return (
                  <div
                    key={tbl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTable(tbl.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedTable(tbl.id);
                      }
                    }}
                    className={`w-full text-left p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)]/15 border-l-4 border-l-[var(--accent)] font-semibold text-[var(--text-primary)]'
                        : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {tbl.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        {tbl.id}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] font-mono">
                        Key: {tbl.uniqueKey}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredTables.length === 0 && (
                <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                  No matching entities found
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 flex justify-start">
            <Button
              variant="ghost"
              onClick={handleDownloadTemplate}
              className="text-[var(--accent)] hover:underline font-medium transition-colors p-0 h-auto text-xs flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {t('downloadTemplate')}
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={() => setStep('preview')}
            disabled={!selectedTable}
            className="w-full btn btn-primary px-4 py-3 rounded-lg font-bold transition-colors"
          >
            {t('continue')}
          </Button>
        </div>
      )}

      {step === 'preview' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-8 max-w-2xl mx-auto w-full animate-in fade-in">
          <div className="mb-8 pb-8 border-b border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t('fileUpload')}</h2>
            
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] px-6 py-2.5 rounded-lg font-bold transition-colors inline-flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {t('chooseFile')}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-sm font-medium text-[var(--text-secondary)] truncate max-w-xs">
                {file ? file.name : t('noFileChosen')}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t('mergeStrategy')}</h2>
          <div className="flex flex-col gap-4 mb-8">
            <label className="flex items-start gap-3 p-4 border border-[var(--border)] rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-secondary)] aria-selected:border-[var(--accent)] aria-selected:bg-[var(--accent)]/10" aria-selected={strategy === 'insert'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'insert'}
                onChange={() => setStrategy('insert')}
                className="mt-1 accent-[var(--accent)]" 
              />
              <div>
                <div className="font-bold text-[var(--text-primary)]">{t('insertOnly')}</div>
                <div className="text-sm text-[var(--text-muted)]">{t('insertOnlyDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-[var(--border)] rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-secondary)] aria-selected:border-[var(--accent)] aria-selected:bg-[var(--accent)]/10" aria-selected={strategy === 'ignore'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'ignore'}
                onChange={() => setStrategy('ignore')}
                className="mt-1 accent-[var(--accent)]" 
              />
              <div>
                <div className="font-bold text-[var(--text-primary)]">{t('insertNewOnly')}</div>
                <div className="text-sm text-[var(--text-muted)]">{t('insertNewOnlyDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-[var(--border)] rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-secondary)] aria-selected:border-[var(--accent)] aria-selected:bg-[var(--accent)]/10" aria-selected={strategy === 'upsert'}>
              <input 
                type="radio" 
                name="strategy" 
                checked={strategy === 'upsert'}
                onChange={() => setStrategy('upsert')}
                className="mt-1 accent-[var(--accent)]" 
              />
              <div>
                <div className="font-bold text-[var(--text-primary)]">{t('upsertMerge')}</div>
                <div className="text-sm text-[var(--text-muted)]">{t('upsertMergeDesc')}</div>
              </div>
            </label>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-[var(--border)]">
            <Button variant="ghost"
              onClick={() => setStep('config')}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold px-4 py-2"
            >
              {t('back')}
            </Button>
            <Button variant="primary"
              onClick={handleStartImport}
              disabled={!file}
              className="btn btn-primary px-8 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              {t('startImport')}
            </Button>
          </div>
        </div>
      )}

      {step === 'executing' && (
      <div className="bg-[#0f172a] rounded-xl overflow-hidden flex-1 mb-6 flex flex-col font-mono text-sm border border-slate-800 animate-in fade-in">
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
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-8 max-w-2xl mx-auto w-full animate-in fade-in text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t('importSuccessful')}</h2>
          <p className="text-[var(--text-muted)] mb-8">{t('importSuccessfulDesc')}</p>

          {importSummary && (
            <div className="grid grid-cols-3 gap-6 mb-8 text-left">
              <div className="p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">{t('products')}</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{importSummary.products.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">{t('customers')}</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{importSummary.customers.toLocaleString()}</div>
              </div>
              <div className="p-6 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">{t('orders')}</div>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{importSummary.orders.toLocaleString()}</div>
              </div>
            </div>
          )}

          <Button variant="primary"
            onClick={() => router.push('/')}
            className="btn btn-primary px-8 py-3 rounded-lg font-bold transition-colors w-full"
          >
            {t('goToDashboard')}
          </Button>
        </div>
      )}
      
      {step === 'executing' && status === 'failed' && (
        <div className="mt-4 flex items-center justify-center animate-in fade-in gap-6">
           <Button variant="secondary"
            onClick={() => { setStep('config'); setStatus('pending'); }}
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
           >
             {t('retryImport')}
           </Button>
           <Button variant="ghost"
            onClick={() => router.push('/')}
            className="text-slate-500 hover:text-slate-800 underline"
          >
            {t('returnToDashboard')}
          </Button>
        </div>
      )}
    </div>
  );
}
