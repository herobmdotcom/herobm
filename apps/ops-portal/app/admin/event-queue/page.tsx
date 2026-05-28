'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, Fragment } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';

interface SyncSummary {
  pending: number;
  processed: number;
  failed: number;
  total: number;
}

interface TypeBreakdown {
  eventType: string;
  total: number;
  pending: number;
  processed: number;
  failed: number;
}

interface OutboxEvent {
  outboxId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  createdOn: string;
  processedAt: string | null;
  lastError: string | null;
}

interface SyncData {
  summary: SyncSummary;
  byType: TypeBreakdown[];
  recentEvents: OutboxEvent[];
}

export default function EventQueueDashboard() {
  const t = useTranslations('admin.eventQueue');
  useDocumentTitle(t('title'));
  
  const [data, setData] = useState<SyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Detail drawer state
  const [drawerType, setDrawerType] = useState<string | null>(null);
  const [drawerEvents, setDrawerEvents] = useState<OutboxEvent[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerExpandedId, setDrawerExpandedId] = useState<string | null>(null);

  // Clearing state
  const [clearing, setClearing] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await api.externalSyncControllerGetSyncStatus({ limit: '100' });
      setData(res.data as unknown as SyncData);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errors.loadFailed'));
      reportError(err, 'EventQueueDashboard_loadData');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleViewEvents = async (eventType: string) => {
    if (drawerType === eventType) {
      setDrawerType(null);
      return;
    }
    setDrawerType(eventType);
    setDrawerLoading(true);
    setDrawerExpandedId(null);
    try {
      const { data: page } = await api.externalSyncControllerGetEventsByType({ type: eventType, status: 'failed', limit: '50' });
      setDrawerEvents(page.data as unknown as OutboxEvent[]);
    } catch (err: unknown) {
      setDrawerEvents([]);
      reportError(err, 'EventQueueDashboard_handleViewEvents');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleClearEvents = async (eventType: string) => {
    if (!confirm(t('confirmClear', { type: eventType }))) return;
    setClearing(eventType);
    try {
      await api.externalSyncControllerClearEventsByType({ type: eventType, status: 'failed' });
      // Close drawer if viewing that type
      if (drawerType === eventType) {
        setDrawerType(null);
        setDrawerEvents([]);
      }
      await loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('errors.clearFailed'));
      reportError(err, 'EventQueueDashboard_handleClearEvents');
    } finally {
      setClearing(null);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              {t('autoRefresh')}
            </label>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              <span>🔄</span>
              {' '}
              {t('refresh')}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  background: data.summary.pending > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined,
                  border: data.summary.pending > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : undefined,
                }}
              >
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.pending')}
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: data.summary.pending > 0 ? '#f59e0b' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {data.summary.pending}
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.processed')}
                </div>
                <div className="text-3xl font-bold" style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                  {data.summary.processed}
                </div>
              </div>
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  background: data.summary.failed > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
                  border: data.summary.failed > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : undefined,
                }}
              >
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.failed')}
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: data.summary.failed > 0 ? '#ef4444' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {data.summary.failed}
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.total')}
                </div>
                <div className="text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {data.summary.total}
                </div>
              </div>
            </div>

            {/* By-type breakdown */}
            {data.byType.length > 0 && (
              <div className="card mb-6">
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {t('eventTypes')}
                </h3>
                <table className="table-lines">
                  <thead>
                    <tr>
                      <th>{t('columns.eventType')}</th>
                      <th style={{ width: 80, textAlign: 'right' }}>{t('columns.total')}</th>
                      <th style={{ width: 80, textAlign: 'right' }}>{t('columns.pending')}</th>
                      <th style={{ width: 80, textAlign: 'right' }}>{t('columns.failed')}</th>
                      <th style={{ width: 80, textAlign: 'right' }}>{t('columns.processed')}</th>
                      <th style={{ width: 110 }}>{t('columns.status')}</th>
                      <th style={{ width: 160, textAlign: 'right' }}>{t('columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byType.map((row) => (
                      <Fragment key={row.eventType}>
                        <tr>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent)',
                              }}
                            >
                              {row.eventType}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.total}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.pending > 0 ? '#f59e0b' : undefined }}>
                            {row.pending}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.failed > 0 ? '#ef4444' : undefined }}>
                            {row.failed}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.processed}</td>
                          <td>
                            {row.failed > 0 ? (
                               <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>❌ {t('status.errors', { count: row.failed })}</span>
                            ) : row.pending === 0 ? (
                              <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11 }}>✅ {t('status.allSynced')}</span>
                            ) : (
                              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⏳ {t('status.pending', { count: row.pending })}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-1 justify-end">
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 10 }}
                                onClick={() => handleViewEvents(row.eventType)}
                              >
                                {drawerType === row.eventType ? t('actions.hide') : t('actions.view')}
                              </button>
                              {row.pending > 0 && (
                                <button
                                  className="btn btn-sm"
                                  style={{
                                    fontSize: 10,
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                  disabled={clearing === row.eventType}
                                  onClick={() => handleClearEvents(row.eventType)}
                                >
                                  {clearing === row.eventType ? '…' : `✕ ${t('actions.clear')}`}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline event drawer */}
                        {drawerType === row.eventType && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div
                                style={{
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  margin: '4px 8px 8px',
                                  maxHeight: 400,
                                  overflowY: 'auto',
                                }}
                              >
                                {drawerLoading ? (
                                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                    {t('drawer.loading')}
                                  </div>
                                ) : drawerEvents.length === 0 ? (
                                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                    {t('drawer.noEvents')}
                                  </div>
                                ) : (
                                  <table className="table-lines" style={{ margin: 0 }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: 170, fontSize: 10 }}>{t('columns.timestamp')}</th>
                                        <th style={{ fontSize: 10 }}>{t('columns.aggregate')}</th>
                                        <th style={{ width: 80, fontSize: 10 }}>{t('columns.status')}</th>
                                        <th style={{ width: 60, fontSize: 10 }}>{t('columns.payload')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {drawerEvents.map((evt) => (
                                        <Fragment key={evt.outboxId}>
                                          <tr>
                                            <td style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                              {new Date(evt.createdOn).toLocaleString()}
                                            </td>
                                            <td style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                              {evt.aggregateType}:{evt.aggregateId.substring(0, 12)}
                                            </td>
                                            <td style={{ fontSize: 10 }}>
                                              {evt.lastError ? (
                                                  <span style={{ color: '#ef4444', fontWeight: 700 }} title={evt.lastError}>❌</span>
                                                ) : evt.processedAt ? (
                                                  <span style={{ color: '#4ade80', fontWeight: 700 }}>✅</span>
                                                ) : (
                                                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>⏳</span>
                                                )}
                                            </td>
                                            <td>
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                style={{ fontSize: 9, padding: '1px 4px' }}
                                                onClick={() =>
                                                  setDrawerExpandedId(
                                                    drawerExpandedId === evt.outboxId ? null : evt.outboxId,
                                                  )
                                                }
                                              >
                                                {drawerExpandedId === evt.outboxId ? '▼' : '▶'}
                                              </button>
                                            </td>
                                          </tr>
                                          {drawerExpandedId === evt.outboxId && (
                                            <tr>
                                              <td colSpan={4} style={{ padding: '8px 12px' }}>
                                                <pre
                                                  style={{
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 4,
                                                    padding: 8,
                                                    fontSize: 10,
                                                    fontFamily: 'monospace',
                                                    overflowX: 'auto',
                                                    maxHeight: 200,
                                                    color: 'var(--text-secondary)',
                                                    margin: 0,
                                                  }}
                                                >
                                                  {evt.lastError && (
                                                    <span style={{ display: 'block', color: '#ef4444', marginBottom: '8px', fontWeight: 'bold' }}>
                                                      {t('drawer.errorLabel')} {evt.lastError}
                                                    </span>
                                                  )}
                                                  {JSON.stringify(evt.payload, null, 2)}
                                                </pre>
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recent events log */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('recentEvents', { count: data.recentEvents.length })}
              </h3>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <table className="table-lines">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>{t('columns.timestamp')}</th>
                      <th style={{ width: 150 }}>{t('columns.eventType')}</th>
                      <th>{t('columns.aggregate')}</th>
                      <th style={{ width: 170 }}>{t('columns.processedAt')}</th>
                      <th style={{ width: 80, textAlign: 'center' }}>{t('columns.status')}</th>
                      <th style={{ width: 70 }}>{t('columns.payload')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.map((evt) => (
                      <Fragment key={evt.outboxId}>
                        <tr>
                          <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                            {new Date(evt.createdOn).toLocaleString()}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent)',
                              }}
                            >
                              {evt.eventType}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {evt.aggregateType}:{evt.aggregateId.substring(0, 8)}
                          </td>
                          <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                            {evt.processedAt ? new Date(evt.processedAt).toLocaleString() : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {evt.lastError ? (
                              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }} title={evt.lastError}>❌</span>
                            ) : evt.processedAt ? (
                              <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11 }}>✅</span>
                            ) : (
                              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⏳</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10 }}
                              onClick={() =>
                                setExpandedId(expandedId === evt.outboxId ? null : evt.outboxId)
                              }
                            >
                              {expandedId === evt.outboxId ? '▼' : '▶'}
                            </button>
                          </td>
                        </tr>
                        {expandedId === evt.outboxId && (
                          <tr key={`${evt.outboxId}-payload`}>
                            <td colSpan={6} style={{ padding: '12px 16px' }}>
                              <pre
                                style={{
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  padding: 12,
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  overflowX: 'auto',
                                  maxHeight: 300,
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {JSON.stringify(evt.payload, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {data.recentEvents.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                          {t('noEvents')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
