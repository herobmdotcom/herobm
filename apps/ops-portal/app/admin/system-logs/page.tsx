/* eslint-disable i18next/no-literal-string */
'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';

interface LogsResponse {
  lines: string[];
}

export default function SystemLogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineLimit, setLineLimit] = useState(1000);
  const [service, setService] = useState('api');
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<LogsResponse>(`/api/admin/system-logs?service=${service}&lines=${lineLimit}`);
      setLines(res.lines);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [lineLimit, service]);

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
    alert('Logs copied to clipboard!');
  };

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">System Logs</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Live tail of backend container and worker file logs
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 text-xs">
              <label style={{ color: 'var(--text-muted)' }}>Service:</label>
              <select 
                className="input-field py-1 px-2 text-xs h-auto"
                value={service} 
                onChange={(e) => setService(e.target.value)}
              >
                <option value="api">API</option>
                <option value="worker">Outbox Worker</option>
                <option value="postgres">PostgreSQL</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label style={{ color: 'var(--text-muted)' }}>Limit:</label>
              <select 
                className="input-field py-1 px-2 text-xs h-auto"
                value={lineLimit} 
                onChange={(e) => setLineLimit(Number(e.target.value))}
              >
                <option value={100}>100 lines</option>
                <option value={500}>500 lines</option>
                <option value={1000}>1000 lines</option>
                <option value={5000}>5000 lines</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              Auto-refresh (5s)
            </label>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyLogs} disabled={lines.length === 0}>
              Copy Logs
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadLogs}>
              ↻ Refresh
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
              Loading system logs...
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No logs available.
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
    </>
  );
}
