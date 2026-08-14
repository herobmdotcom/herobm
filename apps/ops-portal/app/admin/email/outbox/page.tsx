'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import React, { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
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
        <p className="text-[var(--text-muted)]">{t('loading')}</p>
      </div>
    );
  }

  return (
    <>
    <div className="w-full p-6 lg:p-8">
      <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
        {/* Header */}
        <ContentPageHeader
          title={t('title')}
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
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material UI icon */}
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  {t('refresh')}
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

      {/* Email List */}
      <div className="border border-[var(--border)] rounded-lg">
        <div className="overflow-x-auto">
              <DataTable
                columns={[
                  {
                    header: t('columns.date'),
                    render: (email) => (
                      <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                        {new Date(email.createdAt).toLocaleString()}
                      </span>
                    ),
                    width: 170
                  },
                  {
                    header: t('columns.to'),
                    accessor: 'toAddress',
                    render: (email) => <span className="text-xs text-[var(--text-secondary)]">{email.toAddress}</span>,
                    width: 250
                  },
                  {
                    header: t('columns.subject'),
                    accessor: 'subject',
                    render: (email) => <span className="font-medium text-[13px]">{email.subject}</span>
                  },
                  {
                    header: t('columns.entityType'),
                    accessor: 'entityType',
                    render: (email) => {
                      const entityType = email.entityType || 'system';
                      return (
                        <span className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1 py-0.5 rounded">
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
                        return <span className="text-red-500 font-bold text-[11px] capitalize" title={email.lastError}>{t('status.failed')}</span>;
                      } else if (email.status === 'sent') {
                        return <span className="text-green-400 font-bold text-[11px] capitalize">{t('status.sent')}</span>;
                      } else if (email.status === 'dismissed') {
                        return <span className="text-[var(--text-muted)] font-bold text-[11px] capitalize">{t('status.dismissed')}</span>;
                      }
                      return <span className="text-amber-500 font-bold text-[11px] capitalize">{email.status}</span>;
                    }
                  },
                  {
                    header: t('columns.retries'),
                    align: 'right',
                    width: 80,
                    render: (email) => <span className="tabular-nums text-xs">{email.retries}</span>
                  },
                  {
                    header: '',
                    align: 'right',
                    width: 150,
                    render: (email) => (
                      <div className="flex gap-2 justify-end">
                        {['failed', 'pending'].includes(email.status) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-[10px] px-1.5 py-0.5"
                            disabled={actionInProgress === email.id}
                            onClick={() => handleRetry(email.id)}
                          >
                            {actionInProgress === email.id ? t('actions.inProgress') : t('actions.retry')}
                          </Button>
                        )}
                        {['failed', 'pending'].includes(email.status) && (
                          <Button
                            size="sm"
                            className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30"
                            disabled={actionInProgress === email.id}
                            onClick={() => handleDismiss(email.id)}
                          >
                            {t('actions.dismiss')}
                          </Button>
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
                  <div className="px-4 py-2 bg-[var(--bg-primary)]">
                    <pre
                      className="m-0 text-[11px] font-mono overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-words"
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
