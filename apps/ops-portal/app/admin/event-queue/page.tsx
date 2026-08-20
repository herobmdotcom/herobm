'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, Fragment } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
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
          <p className="text-[var(--text-muted)]">{t('loading')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="w-full p-6 lg:p-8">
        <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
        {/* Header */}
        <ContentPageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={[
            {
              label: (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={() => setAutoRefresh(!autoRefresh)}
                  />
                  {t('autoRefresh')}
                </div>
              ),
              onClick: () => setAutoRefresh(!autoRefresh),
              variant: 'ghost'
            },
            {
              label: (
                <>
                  <span>🔄</span> {t('refresh')}
                </>
              ),
              onClick: loadData,
              variant: 'secondary'
            }
          ]}
        />

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400"
          >
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div
                className={`p-5 rounded-xl text-center border ${data.summary.pending > 0 ? 'bg-amber-500/[0.08] border-amber-500/30' : 'border-[var(--border)]'}`}
              >
                <div className="text-xs font-semibold mb-2 text-[var(--text-muted)] uppercase tracking-wider">
                  {t('summary.pending')}
                </div>
                <div
                  className={`text-3xl font-bold tabular-nums ${data.summary.pending > 0 ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}
                >
                  {data.summary.pending}
                </div>
              </div>
              <div className="p-5 rounded-xl text-center border border-[var(--border)]">
                <div className="text-xs font-semibold mb-2 text-[var(--text-muted)] uppercase tracking-wider">
                  {t('summary.processed')}
                </div>
                <div className="text-3xl font-bold text-green-400 tabular-nums">
                  {data.summary.processed}
                </div>
              </div>
              <div
                className={`p-5 rounded-xl text-center border ${data.summary.failed > 0 ? 'bg-red-500/[0.08] border-red-500/30' : 'border-[var(--border)]'}`}
              >
                <div className="text-xs font-semibold mb-2 text-[var(--text-muted)] uppercase tracking-wider">
                  {t('summary.failed')}
                </div>
                <div
                  className={`text-3xl font-bold tabular-nums ${data.summary.failed > 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}
                >
                  {data.summary.failed}
                </div>
              </div>
              <div className="p-5 rounded-xl text-center border border-[var(--border)]">
                <div className="text-xs font-semibold mb-2 text-[var(--text-muted)] uppercase tracking-wider">
                  {t('summary.total')}
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  {data.summary.pending + data.summary.processed + data.summary.failed}
                </div>
              </div>
            </div>

            {/* By-type breakdown */}
            {data.byType.length > 0 && (
              <div className="mb-6 border border-[var(--border)] rounded-xl p-5">
                <h3
                  className="text-sm font-semibold mb-4 text-[var(--text-muted)] uppercase tracking-wider"
                >
                  {t('eventTypes')}
                </h3>
                <DataTable
                  columns={[
                    {
                      header: t('columns.eventType'),
                      render: (row) => (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold font-mono bg-blue-500/10 text-[var(--accent)]">
                          {row.eventType}
                        </span>
                      )
                    },
                    { header: t('columns.total'), align: 'right', width: 80, render: (row) => <span className="tabular-nums">{row.total}</span> },
                    { header: t('columns.pending'), align: 'right', width: 80, render: (row) => <span className={`tabular-nums ${row.pending > 0 ? 'text-amber-500' : ''}`}>{row.pending}</span> },
                    { header: t('columns.failed'), align: 'right', width: 80, render: (row) => <span className={`tabular-nums ${row.failed > 0 ? 'text-red-500' : ''}`}>{row.failed}</span> },
                    { header: t('columns.processed'), align: 'right', width: 80, render: (row) => <span className="tabular-nums">{row.processed}</span> },
                    { 
                      header: t('columns.status'), width: 110, 
                      render: (row) => {
                        if (row.failed > 0) return <span className="text-red-500 font-bold text-[11px]">❌ {t('status.errors', { count: row.failed })}</span>;
                        if (row.pending === 0) return <span className="text-green-400 font-bold text-[11px]">✅ {t('status.allSynced')}</span>;
                        return <span className="text-amber-500 font-bold text-[11px]">⏳ {t('status.pending', { count: row.pending })}</span>;
                      } 
                    },
                    {
                      header: t('columns.actions'), align: 'right', width: 160,
                      render: (row) => (
                        <div className="flex gap-1 justify-end">
                          <Button variant="secondary" size="xs" onClick={() => handleViewEvents(row.eventType)}>
                            {drawerType === row.eventType ? t('actions.hide') : t('actions.view')}
                          </Button>
                          {row.pending > 0 && (
                            <Button
                              size="xs"
                              className="bg-red-500/10 text-red-400 border border-red-500/30"
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
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md mx-2 my-1 max-h-[400px] overflow-y-auto">
                      {drawerLoading ? (
                        <div className="p-4 text-center text-[var(--text-muted)] text-xs">{t('drawer.loading')}</div>
                      ) : (
                        <DataTable
                          columns={[
                            { header: t('columns.timestamp'), width: 170, render: (evt) => <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{new Date(evt.createdOn).toLocaleString()}</span> },
                            { header: t('columns.aggregate'), render: (evt) => <span className="text-[10px] font-mono text-[var(--text-secondary)]">{evt.entityType}:{(evt.entityId || '').substring(0, 12)}</span> },
                            {
                              header: t('columns.status'), width: 80,
                              render: (evt) => {
                                if (evt.lastError) return <span className="text-red-500 font-bold text-[10px]" title={evt.lastError}>❌</span>;
                                if (evt.processedAt) return <span className="text-green-400 font-bold text-[10px]">✅</span>;
                                return <span className="text-amber-500 font-bold text-[10px]">⏳</span>;
                              }
                            },
                            {
                              header: t('columns.payload'), width: 60,
                              render: (evt) => (
                                <Button
                                  variant="secondary"
                                  size="xs"
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
            <div className="border border-[var(--border)] rounded-xl p-5">
              <h3
                className="text-sm font-semibold mb-4 text-[var(--text-muted)] uppercase tracking-wider"
              >
                {t('recentEvents', { count: data.recentEvents.length })}
              </h3>
              <div className="max-h-[600px] overflow-y-auto">
                <DataTable
                  columns={[
                    { header: t('columns.timestamp'), width: 170, render: (evt) => <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{new Date(evt.createdOn).toLocaleString()}</span> },
                    { header: t('columns.eventType'), width: 150, render: (evt) => <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono bg-blue-500/10 text-[var(--accent)]">{evt.eventType}</span> },
                    { header: t('columns.aggregate'), render: (evt) => {
                      const e = evt as unknown as Record<string, unknown>;
                      const aggType = e.aggregateType as string | undefined;
                      const aggId = e.aggregateId as string | undefined;
                      return <span className="text-[11px] font-mono text-[var(--text-secondary)]">{aggType}:{aggId?.substring(0, 8)}</span>;
                    } },
                    { header: t('columns.processedAt'), width: 170, render: (evt) => <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{evt.processedAt ? new Date(evt.processedAt).toLocaleString() : '—'}</span> },
                    { 
                      header: t('columns.status'), width: 80, align: 'center',
                      render: (evt) => {
                        if (evt.lastError) return <span className="text-red-500 font-bold text-[11px]" title={evt.lastError}>❌</span>;
                        if (evt.processedAt) return <span className="text-green-400 font-bold text-[11px]">✅</span>;
                        return <span className="text-amber-500 font-bold text-[11px]">⏳</span>;
                      }
                    },
                    {
                      header: t('columns.payload'), width: 70,
                      render: (evt) => (
                        <Button variant="secondary" size="xs" onClick={() => setSlideOverEvent(evt as OutboxEvent)}>
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
