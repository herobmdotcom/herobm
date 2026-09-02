'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/shared/Button';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import * as api from '@herobm/sdk';

interface LogsResponse {
  lines: string[];
}

export default function SystemLogsPage() {
  const t = useTranslations('admin.systemLogs');
  useDocumentTitle(t('title'));
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineLimit, setLineLimit] = useState(1000);
  const [service, setService] = useState('api');
  const [isInitialized, setIsInitialized] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const savedService = localStorage.getItem('herobm_logs_service');
    if (savedService) {
      setService(savedService);
    }
    setIsInitialized(true);
  }, []);

  const handleServiceChange = (newService: string) => {
    setService(newService);
    localStorage.setItem('herobm_logs_service', newService);
  };

  const loadLogs = async () => {
    const fetchId = ++fetchIdRef.current;
    try {
      setLoading(true);
      const res = await api.systemControllerGetSystemLogs({ service, lines: lineLimit.toString() });
      if (fetchId === fetchIdRef.current) {
        setLines(res.data.lines);
        setError('');
      }
    } catch (err) {
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : t('toasts.loadFailed'));
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadLogs();
    }
  }, [lineLimit, service, isInitialized]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, lineLimit, service]);

  // Auto-scroll to bottom when lines update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(lines.join('\n'));
    alert(t('actions.copied'));
  };

  return (

      <div className="w-full p-6 lg:p-8 flex flex-col">
        <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto min-h-[calc(100vh-150px)] flex flex-col">
        {/* Header */}
        <ContentPageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={[
            {
              label: (
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-[var(--text-muted)]">{t('filters.service')}</label>
                  <select 
                    className="input-field py-1 px-2 text-xs h-auto"
                    value={service} 
                    onChange={(e) => handleServiceChange(e.target.value)}
                  >
                    <option value="api">{t('filters.services.api')}</option>
                    <option value="worker">{t('filters.services.worker')}</option>
                    <option value="postgres">{t('filters.services.postgres')}</option>
                    <option value="integration">{t('filters.services.integration')}</option>
                  </select>
                </div>
              ),
              onClick: () => {},
              variant: 'ghost'
            },
            {
              label: (
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-[var(--text-muted)]">{t('filters.limit')}</label>
                  <select 
                    className="input-field py-1 px-2 text-xs h-auto"
                    value={lineLimit} 
                    onChange={(e) => setLineLimit(Number(e.target.value))}
                  >
                    <option value={100}>{t('filters.limits.100')}</option>
                    <option value={500}>{t('filters.limits.500')}</option>
                    <option value={1000}>{t('filters.limits.1000')}</option>
                    <option value={5000}>{t('filters.limits.5000')}</option>
                  </select>
                </div>
              ),
              onClick: () => {},
              variant: 'ghost'
            },
            {
              label: (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                  />
                  {t('filters.autoRefresh')}
                </div>
              ),
              onClick: () => setAutoRefresh(!autoRefresh),
              variant: 'ghost'
            },
            {
              label: t('actions.copy'),
              onClick: handleCopyLogs,
              variant: 'secondary',
              disabled: lines.length === 0
            },
            {
              label: (
                <>
                  <span>🔄</span> {t('actions.refresh')}
                </>
              ),
              onClick: loadLogs,
              variant: 'secondary'
            }
          ]}
        />

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm shrink-0 bg-red-500/10 border border-red-500/30 text-red-400"
          >
            {error}
          </div>
        )}

        {/* Log Viewer Terminal */}
        <div 
          className="flex-1 rounded-lg overflow-auto relative bg-[#1e1e1e] border border-[var(--border)] p-4 font-mono text-xs leading-normal text-[#d4d4d4]"
        >
          {loading && lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {t('loading')}
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {t('noLogs')}
            </div>
          ) : (
            <>
              {lines.map((line, idx) => {
                let colorClass = 'text-[#d4d4d4]';
                if (line.includes('[WARN]') || line.includes('"level":"warn"') || line.includes('"level":40')) {
                  colorClass = 'text-amber-500';
                } else if (
                  line.includes('[ERROR]') ||
                  line.includes('"level":"error"') ||
                  line.includes('"level":50') ||
                  line.includes('Error:')
                ) {
                  colorClass = 'text-red-400';
                } else if (
                  line.includes('[DEBUG]') ||
                  line.includes('[VERBOSE]') ||
                  line.includes('"level":"debug"') ||
                  line.includes('"level":20')
                ) {
                  colorClass = 'text-gray-400';
                } else if (
                  line.includes('[INFO]') ||
                  line.includes('[LOG]') ||
                  line.includes('"level":"info"') ||
                  line.includes('"level":30')
                ) {
                  colorClass = 'text-blue-400';
                }
                
                return (
                  <div key={idx} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                    {line}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
