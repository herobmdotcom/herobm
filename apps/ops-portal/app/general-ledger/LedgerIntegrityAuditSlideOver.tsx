'use client';

import React, { useState, useEffect, useMemo } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';

export interface LedgerAnomaly {
  type:
    | 'sequence_gap'
    | 'timestamp_inversion'
    | 'missing_gl_journal'
    | 'missing_cancellation_reversal'
    | 'unbalanced_journal_entry'
    | 'hash_chain_violation';
  invoiceNumber?: string;
  invoiceId?: string;
  journalEntryId?: string;
  entryNumber?: string;
  details?: Record<string, unknown>;
}

export interface LedgerAuditData {
  hasAudit: boolean;
  eventId?: string | null;
  entityDisplayName?: string | null;
  createdOn?: string | Date | null;
  anomaliesCount: number;
  anomalies: LedgerAnomaly[];
  auditedAt?: string | null;
  verifiedInvoicesCount?: number;
  verifiedJournalsCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string | null;
  initialData?: LedgerAuditData | null;
}

const PAGE_SIZE = 50;

export default function LedgerIntegrityAuditSlideOver({
  isOpen,
  onClose,
  eventId,
  initialData,
}: Props) {
  const t = useTranslations('gl.ledgerIntegrity');
  const tCommon = useTranslations('common');

  const [auditData, setAuditData] = useState<LedgerAuditData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const handleReRunAudit = async () => {
    setRunningAudit(true);
    try {
      const res = await api.glControllerRunIntegrityAudit();
      setAuditData(res.data as unknown as LedgerAuditData);
    } catch (err) {
      reportError(err, 'LedgerIntegrityAuditSlideOver.runAudit');
    } finally {
      setRunningAudit(false);
    }
  };

  // Fetch audit data if not provided in initialData
  useEffect(() => {
    if (!isOpen) return;

    if (initialData && initialData.anomalies) {
      setAuditData(initialData);
      return;
    }

    setLoading(true);
    const req = eventId
      ? api.glControllerGetIntegrityAuditById(eventId)
      : api.glControllerGetLatestIntegrityAudit();

    req
      .then((res) => {
        setAuditData(res.data as unknown as LedgerAuditData);
      })
      .catch((err) => {
        reportError(err, 'LedgerIntegrityAuditSlideOver');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, eventId, initialData]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, searchTerm]);

  const anomalies = useMemo(() => {
    return auditData?.anomalies || [];
  }, [auditData]);

  // Anomaly category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: anomalies.length,
      missing_gl_journal: 0,
      sequence_gap: 0,
      unbalanced_journal_entry: 0,
      hash_chain_violation: 0,
      timestamp_inversion: 0,
      missing_cancellation_reversal: 0,
    };
    for (const a of anomalies) {
      if (counts[a.type] !== undefined) {
        counts[a.type]++;
      }
    }
    return counts;
  }, [anomalies]);

  // Filtered anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (selectedType !== 'all' && a.type !== selectedType) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const invNum = (a.invoiceNumber || '').toLowerCase();
        const entryNum = (a.entryNumber || '').toLowerCase();
        const detailsStr = JSON.stringify(a.details || {}).toLowerCase();
        return invNum.includes(q) || entryNum.includes(q) || detailsStr.includes(q);
      }
      return true;
    });
  }, [anomalies, selectedType, searchTerm]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredAnomalies.length / PAGE_SIZE));
  const paginatedAnomalies = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAnomalies.slice(start, start + PAGE_SIZE);
  }, [filteredAnomalies, currentPage]);

  const formatAnomalyDetails = (anomaly: LedgerAnomaly) => {
    const details = anomaly.details || {};
    switch (anomaly.type) {
      case 'missing_gl_journal':
        return `Unposted Invoice (Status: ${String(details.stateCode || 'invoiced')}, Amount: ${String(details.totalAmount || '0.00')})`;
      case 'missing_cancellation_reversal':
        return `Cancelled invoice lacking reversal journal (Status: ${String(details.stateCode || 'cancelled')})`;
      case 'sequence_gap':
        return `Missing ${String(details.missingCount || 1)} in prefix "${String(details.prefix || '')}" (Expected: ${String(details.expectedSequence)}, Actual: ${String(details.actualSequence)})`;
      case 'timestamp_inversion':
        return `Chronological inversion: posted at ${String(details.currentCreatedOn || '')} after previous ${String(details.previousCreatedOn || '')}`;
      case 'unbalanced_journal_entry':
        return `Debit: ${String(details.totalDebit || 0)}, Credit: ${String(details.totalCredit || 0)} (Drift: ${String(details.drift || 0)})`;
      case 'hash_chain_violation':
        return `Corrupted hash at sequence #${String(details.brokenSequenceNumber || 0)}: ${String(details.error || 'Hash mismatch')}`;
      default:
        return JSON.stringify(details);
    }
  };

  const getTargetLink = (anomaly: LedgerAnomaly) => {
    if (anomaly.invoiceId) {
      return `/sales-invoices/${anomaly.invoiceId}`;
    }
    if (anomaly.invoiceNumber) {
      return `/sales-invoices?q=${encodeURIComponent(anomaly.invoiceNumber)}`;
    }
    if (anomaly.journalEntryId || anomaly.entryNumber) {
      return `/general-ledger/journal-entries?q=${encodeURIComponent(anomaly.entryNumber || '')}`;
    }
    return null;
  };

  const badgeColor = (type: string) => {
    switch (type) {
      case 'missing_gl_journal':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'unbalanced_journal_entry':
      case 'hash_chain_violation':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'sequence_gap':
      case 'timestamp_inversion':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const auditTimestamp = auditData?.auditedAt || auditData?.createdOn;
  const isClean = anomalies.length === 0;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      width="max-w-3xl"
      subtitle={
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
              isClean
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
            }`}
          >
            {isClean
              ? t('statusClean')
              : t('statusAnomalies', { count: anomalies.length })}
          </span>
          {auditTimestamp && (
            <span className="text-xs text-[var(--text-muted)]">
              {t('auditedAt', {
                timestamp: formatLocalDate(auditTimestamp.toString()),
              })}
            </span>
          )}
          <Button
            variant="secondary"
            size="xs"
            onClick={handleReRunAudit}
            loading={runningAudit}
            icon="refresh"
            className="ml-auto text-xs"
          >
            {runningAudit ? t('reRunningAudit') : t('reRunAudit')}
          </Button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon="menu_book" asChild>
              <Link href="/general-ledger/journal-entries">
                {t('openJournalEntries')}
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReRunAudit}
              loading={runningAudit}
              icon="refresh"
            >
              {runningAudit ? t('reRunningAudit') : t('reRunAudit')}
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border bg-[var(--bg-card)] border-[var(--border)]">
            <div className="text-xs text-[var(--text-muted)] font-medium">
              {t('totalAnomalies')}
            </div>
            <div
              className={`text-xl font-bold mt-1 ${
                anomalies.length > 0 ? 'text-red-500' : 'text-emerald-500'
              }`}
            >
              {anomalies.length.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border bg-[var(--bg-card)] border-[var(--border)]">
            <div className="text-xs text-[var(--text-muted)] font-medium">
              {t('verifiedInvoices')}
            </div>
            <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
              {(auditData?.verifiedInvoicesCount ?? '—').toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border bg-[var(--bg-card)] border-[var(--border)]">
            <div className="text-xs text-[var(--text-muted)] font-medium">
              {t('verifiedJournals')}
            </div>
            <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
              {(auditData?.verifiedJournalsCount ?? '—').toLocaleString()}
            </div>
          </div>
        </div>

        {/* Guidance Resolution Box */}
        <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 text-xs leading-relaxed text-[var(--text-secondary)]">
          <div className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-500">info</span>
            {t('resolutionGuideTitle')}
          </div>
          {t('resolutionGuideBody')}
        </div>

        {/* Category Filter Chips */}
        {anomalies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedType === 'all' ? 'primary' : 'secondary'}
              size="xs"
              onClick={() => setSelectedType('all')}
            >
              {t('allTypes', { count: anomalies.length })}
            </Button>
            {categoryCounts.missing_gl_journal > 0 && (
              <Button
                variant={selectedType === 'missing_gl_journal' ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => setSelectedType('missing_gl_journal')}
              >
                {t('types.missing_gl_journal')} ({categoryCounts.missing_gl_journal})
              </Button>
            )}
            {categoryCounts.unbalanced_journal_entry > 0 && (
              <Button
                variant={selectedType === 'unbalanced_journal_entry' ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => setSelectedType('unbalanced_journal_entry')}
              >
                {t('types.unbalanced_journal_entry')} ({categoryCounts.unbalanced_journal_entry})
              </Button>
            )}
            {categoryCounts.hash_chain_violation > 0 && (
              <Button
                variant={selectedType === 'hash_chain_violation' ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => setSelectedType('hash_chain_violation')}
              >
                {t('types.hash_chain_violation')} ({categoryCounts.hash_chain_violation})
              </Button>
            )}
            {categoryCounts.sequence_gap > 0 && (
              <Button
                variant={selectedType === 'sequence_gap' ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => setSelectedType('sequence_gap')}
              >
                {t('types.sequence_gap')} ({categoryCounts.sequence_gap})
              </Button>
            )}
          </div>
        )}

        {/* Live Search Input */}
        {anomalies.length > 0 && (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[var(--text-muted)]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('filterPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        {/* Loading / Empty / Data Table */}
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : isClean ? (
          <div className="p-8 text-center rounded-2xl border flex flex-col items-center justify-center gap-2 bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]">
            <span className="material-symbols-outlined text-[36px] text-emerald-500">
              verified
            </span>
            <p className="text-sm font-semibold">{t('noAnomalies')}</p>
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-muted)] rounded-xl border bg-[var(--bg-card)] border-[var(--border)]">
            {t('noSearchResults')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Table */}
            <div className="border rounded-xl overflow-hidden bg-[var(--bg-card)] border-[var(--border)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-[var(--bg-hover)] border-[var(--border)] text-[var(--text-muted)] font-semibold">
                    <th className="py-2.5 px-3">{t('columns.type')}</th>
                    <th className="py-2.5 px-3">{t('columns.document')}</th>
                    <th className="py-2.5 px-3">{t('columns.details')}</th>
                    <th className="py-2.5 px-3 text-right">{t('columns.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {paginatedAnomalies.map((a, idx) => {
                    const targetLink = getTargetLink(a);
                    const docNumber = a.invoiceNumber || a.entryNumber || a.journalEntryId || '—';

                    return (
                      <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor(
                              a.type,
                            )}`}
                          >
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- translation key */}
                            {t(('types.' + a.type) as any)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                          {docNumber}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)] max-w-xs truncate">
                          {formatAnomalyDetails(a)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {targetLink ? (
                            <Link
                              href={targetLink}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline"
                            >
                              {t('inspect')}
                              <span className="material-symbols-outlined text-[14px]">
                                arrow_forward
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[var(--text-muted)]">{tCommon('na')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1 py-1 text-xs text-[var(--text-muted)]">
                <div>
                  {t('showingPagination', {
                    start: (currentPage - 1) * PAGE_SIZE + 1,
                    end: Math.min(currentPage * PAGE_SIZE, filteredAnomalies.length),
                    total: filteredAnomalies.length.toLocaleString(),
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </Button>
                  <span className="px-2 font-medium text-[var(--text-primary)]">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SlideOver>
  );
}
