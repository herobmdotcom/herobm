'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import React, { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import { DataTable } from '@/components/shared/DataTable';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';

export default function EmailOutboxDashboard() {
  const t = useTranslations('admin.emailOutbox');

  useDocumentTitle(t('title'));
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Open API type not perfectly inferred yet
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await api.emailControllerListEmails();
      setData(res.data);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err) : t('errors.loadFailed'));
      reportError(err, 'EmailOutboxDashboard_loadData');
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

  const handleRetry = async (id: string) => {
    setActionInProgress(id);
    try {
      await api.emailControllerRetryEmail(id);
      await loadData();
    } catch (err: unknown) {
      alert(t('errors.retryFailed') + getErrorMessage(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = async (id: string) => {
    if (!confirm(t('confirmDismiss'))) return;
    setActionInProgress(id);
    try {
      await api.emailControllerDismissEmail(id);
      await loadData();
    } catch (err: unknown) {
      alert(t('errors.dismissFailed') + getErrorMessage(err));
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
      </div>
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
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions */}
            <span className="material-symbols-outlined text-[16px]">refresh</span>
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

      {/* Email List */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
        <div style={{ overflowX: 'auto' }}>
              <DataTable
                columns={[
                  {
                    header: t('columns.date'),
                    render: (email) => (
                      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {new Date(email.createdAt).toLocaleString()}
                      </span>
                    ),
                    width: 170
                  },
                  {
                    header: t('columns.to'),
                    accessor: 'toAddress',
                    render: (email) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{email.toAddress}</span>,
                    width: 250
                  },
                  {
                    header: t('columns.subject'),
                    accessor: 'subject',
                    render: (email) => <span style={{ fontWeight: 500, fontSize: 13 }}>{email.subject}</span>
                  },
                  {
                    header: t('columns.entityType'),
                    accessor: 'entityType',
                    render: (email) => {
                      const entityType = email.entityType || 'system';
                      return (
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4 }}>
                          {entityType}
                        </span>
                      );
                    }
                  },
                  {
                    header: t('columns.status'),
                    align: 'center',
                    width: 100,
                    render: (email) => {
                      if (email.status === 'failed') {
                        return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }} title={email.lastError}>{t('status.failed')}</span>;
                      } else if (email.status === 'sent') {
                        return <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}>{t('status.sent')}</span>;
                      } else if (email.status === 'dismissed') {
                        return <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}>{t('status.dismissed')}</span>;
                      }
                      return <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11, textTransform: 'capitalize' }}>{email.status}</span>;
                    }
                  },
                  {
                    header: t('columns.retries'),
                    align: 'right',
                    width: 80,
                    render: (email) => <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{email.retries}</span>
                  },
                  {
                    header: '',
                    align: 'right',
                    width: 150,
                    render: (email) => (
                      <div className="flex gap-2 justify-end">
                        {['failed', 'pending'].includes(email.status) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10, padding: '2px 6px' }}
                            disabled={actionInProgress === email.id}
                            onClick={() => handleRetry(email.id)}
                          >
                            {actionInProgress === email.id ? t('actions.inProgress') : t('actions.retry')}
                          </button>
                        )}
                        {['failed', 'pending'].includes(email.status) && (
                          <button
                            className="btn btn-sm"
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                            disabled={actionInProgress === email.id}
                            onClick={() => handleDismiss(email.id)}
                          >
                            {t('actions.dismiss')}
                          </button>
                        )}
                      </div>
                    )
                  }
                ]}
                data={data}
                keyExtractor={(row) => row.id}
                emptyMessage={t('noEmails')}
                isRowExpanded={(row) => !!row.lastError}
                renderExpandedRow={(email) => (
                  <div style={{ padding: '8px 16px', background: 'var(--bg-primary)' }}>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {`[${(() => {
                        if (email.nextRetryAt && email.retries) {
                          const errorTime = new Date(new Date(email.nextRetryAt).getTime() - Math.pow(2, Number(email.retries) - 1) * 60000);
                          return errorTime.toLocaleString();
                        }
                        return new Date(email.processedAt || email.createdAt).toLocaleString();
                      })()}] ${email.lastError}`}
                    </pre>
                  </div>
                )}
              />
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
