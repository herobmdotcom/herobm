'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';

import { useState, useEffect, useRef } from 'react';
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
    <>
      <style>{`main { background-color: #ffffff !important; }`}</style>
      <div className="w-full p-6 lg:p-8 flex flex-col">
        <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 'calc(100vh - 150px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 text-xs">
              <label style={{ color: 'var(--text-muted)' }}>{t('filters.service')}</label>
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
            <div className="flex items-center gap-2 text-xs">
              <label style={{ color: 'var(--text-muted)' }}>{t('filters.limit')}</label>
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
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              {t('filters.autoRefresh')}
            </label>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyLogs} disabled={lines.length === 0}>
              {t('actions.copy')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadLogs}>
              <span>🔄</span>
              {' '}
              {t('actions.refresh')}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm shrink-0"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Log Viewer Terminal */}
        <div 
          className="flex-1 rounded-lg overflow-auto relative"
          style={{ 
            background: '#1e1e1e', // Dark terminal background
            border: '1px solid var(--border)',
            padding: '16px',
            fontFamily: 'monospace, "Courier New", Courier',
            fontSize: '12px',
            lineHeight: '1.5',
            color: '#d4d4d4', // Light gray text
          }}
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
                // Basic coloration for log levels
                let color = '#d4d4d4'; // default
                if (line.includes('[WARN]')) color = '#f59e0b'; // warning (amber)
                else if (line.includes('[ERROR]') || line.includes('Error:')) color = '#f87171'; // error (red)
                else if (line.includes('[DEBUG]')) color = '#9ca3af'; // debug (gray)
                else if (line.includes('[INFO]')) color = '#60a5fa'; // info (blue)
                
                return (
                  <div key={idx} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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
    </>
  );
}
