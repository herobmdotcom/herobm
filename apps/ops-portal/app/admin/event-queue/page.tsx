'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, Fragment } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { DataTable } from '@/components/shared/DataTable';
import EventPayloadSlideOver from './EventPayloadSlideOver';
import { Button } from '@/components/shared/Button';

interface OutboxEvent {
  outboxId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  payload: unknown;
  createdOn: string;
  processedAt: string | null;
  lastError: string | null;
}

export default function EventQueueDashboard() {
  const t = useTranslations('admin.eventQueue');
  useDocumentTitle(t('title'));
  
  const [data, setData] = useState<api.SyncStatusResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Detail drawer state
  const [drawerType, setDrawerType] = useState<string | null>(null);
  const [drawerEvents, setDrawerEvents] = useState<OutboxEvent[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Payload SlideOver state
  const [slideOverEvent, setSlideOverEvent] = useState<OutboxEvent | null>(null);

  // Clearing state
  const [clearing, setClearing] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await api.externalSyncControllerGetSyncStatus({ limit: '100' });
      setData(res.data);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err) : t('errors.loadFailed'));
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
    try {
      const { data: page } = await api.externalSyncControllerGetEventsByType({ type: eventType, status: 'all', limit: '50' });
      setDrawerEvents((page?.events as OutboxEvent[]) || []);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err) : t('errors.clearFailed'));
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
      <style>{`main { background-color: #ffffff !important; }`}</style>
      <div className="w-full p-6 lg:p-8">
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
            <Button variant="secondary" size="sm" onClick={loadData}>
              <span>🔄</span>
              {' '}
              {t('refresh')}
            </Button>
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
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  background: data.summary.pending > 0 ? 'rgba(245, 158, 11, 0.08)' : undefined,
                  border: data.summary.pending > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)',
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
              <div style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.processed')}
                </div>
                <div className="text-3xl font-bold" style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                  {data.summary.processed}
                </div>
              </div>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  background: data.summary.failed > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
                  border: data.summary.failed > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
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
              <div style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('summary.total')}
                </div>
                <div className="text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {data.summary.pending + data.summary.processed + data.summary.failed}
                </div>
              </div>
            </div>

            {/* By-type breakdown */}
            {data.byType.length > 0 && (
              <div className="mb-6" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {t('eventTypes')}
                </h3>
                <DataTable
                  columns={[
                    {
                      header: t('columns.eventType'),
                      render: (row) => (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: 'monospace', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)' }}>
                          {row.eventType}
                        </span>
                      )
                    },
                    { header: t('columns.total'), align: 'right', width: 80, render: (row) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.total}</span> },
                    { header: t('columns.pending'), align: 'right', width: 80, render: (row) => <span style={{ fontVariantNumeric: 'tabular-nums', color: row.pending > 0 ? '#f59e0b' : undefined }}>{row.pending}</span> },
                    { header: t('columns.failed'), align: 'right', width: 80, render: (row) => <span style={{ fontVariantNumeric: 'tabular-nums', color: row.failed > 0 ? '#ef4444' : undefined }}>{row.failed}</span> },
                    { header: t('columns.processed'), align: 'right', width: 80, render: (row) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.processed}</span> },
                    { 
                      header: t('columns.status'), width: 110, 
                      render: (row) => {
                        if (row.failed > 0) return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>❌ {t('status.errors', { count: row.failed })}</span>;
                        if (row.pending === 0) return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11 }}>✅ {t('status.allSynced')}</span>;
                        return <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⏳ {t('status.pending', { count: row.pending })}</span>;
                      } 
                    },
                    {
                      header: t('columns.actions'), align: 'right', width: 160,
                      render: (row) => (
                        <div className="flex gap-1 justify-end">
                          <Button variant="secondary" size="sm" style={{ fontSize: 10 }} onClick={() => handleViewEvents(row.eventType)}>
                            {drawerType === row.eventType ? t('actions.hide') : t('actions.view')}
                          </Button>
                          {row.pending > 0 && (
                            <Button
                              size="sm"
                              style={{ fontSize: 10, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                              disabled={clearing === row.eventType}
                              onClick={() => handleClearEvents(row.eventType)}
                            >
                              {clearing === row.eventType ? '…' : `✕ ${t('actions.clear')}`}
                            </Button>
                          )}
                        </div>
                      )
                    }
                  ]}
                  data={data.byType}
                  keyExtractor={(row) => row.eventType}
                  isRowExpanded={(row) => drawerType === row.eventType}
                  renderExpandedRow={() => (
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, margin: '4px 8px 8px', maxHeight: 400, overflowY: 'auto' }}>
                      {drawerLoading ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{t('drawer.loading')}</div>
                      ) : (
                        <DataTable
                          columns={[
                            { header: t('columns.timestamp'), width: 170, render: (evt) => <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{new Date(evt.createdOn).toLocaleString()}</span> },
                            { header: t('columns.aggregate'), render: (evt) => <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{evt.entityType}:{(evt.entityId || '').substring(0, 12)}</span> },
                            {
                              header: t('columns.status'), width: 80,
                              render: (evt) => {
                                if (evt.lastError) return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }} title={evt.lastError}>❌</span>;
                                if (evt.processedAt) return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 10 }}>✅</span>;
                                return <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 10 }}>⏳</span>;
                              }
                            },
                            {
                              header: t('columns.payload'), width: 60,
                              render: (evt) => (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  style={{ fontSize: 9, padding: '1px 4px' }}
                                  onClick={() => setSlideOverEvent(evt)}
                                >
                                  📄
                                </Button>
                              )
                            }
                          ]}
                          data={drawerEvents}
                          keyExtractor={(evt) => evt.outboxId}
                          emptyMessage={t('drawer.noEvents')}
                        />
                      )}
                    </div>
                  )}
                />
              </div>
            )}

            {/* Recent events log */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('recentEvents', { count: data.recentEvents.length })}
              </h3>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                <DataTable
                  columns={[
                    { header: t('columns.timestamp'), width: 170, render: (evt) => <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{new Date(evt.createdOn).toLocaleString()}</span> },
                    { header: t('columns.eventType'), width: 150, render: (evt) => <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: 'monospace', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)' }}>{evt.eventType}</span> },
                    { header: t('columns.aggregate'), render: (evt) => {
                      const e = evt as unknown as Record<string, unknown>;
                      const aggType = e.aggregateType as string | undefined;
                      const aggId = e.aggregateId as string | undefined;
                      return <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{aggType}:{aggId?.substring(0, 8)}</span>;
                    } },
                    { header: t('columns.processedAt'), width: 170, render: (evt) => <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{evt.processedAt ? new Date(evt.processedAt).toLocaleString() : '—'}</span> },
                    { 
                      header: t('columns.status'), width: 80, align: 'center',
                      render: (evt) => {
                        if (evt.lastError) return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }} title={evt.lastError}>❌</span>;
                        if (evt.processedAt) return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11 }}>✅</span>;
                        return <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⏳</span>;
                      }
                    },
                    {
                      header: t('columns.payload'), width: 70,
                      render: (evt) => (
                        <Button variant="secondary" size="sm" style={{ fontSize: 10 }} onClick={() => setSlideOverEvent(evt as OutboxEvent)}>
                          📄
                        </Button>
                      )
                    }
                  ]}
                  data={data.recentEvents}
                  keyExtractor={(evt) => evt.outboxId}
                  emptyMessage={t('noEvents')}
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      <EventPayloadSlideOver
        isOpen={!!slideOverEvent}
        onClose={() => setSlideOverEvent(null)}
        event={slideOverEvent}
      />
    </div>
    </>
  );
}
