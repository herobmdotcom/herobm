'use client';

import React, { useEffect, useState } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { formatLocalDate } from '@/lib/date';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { routes } from '@/lib/routes';

export interface JournalEntry {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceNumber?: string | null;
  createdBy: string | null;
}

export interface JournalLine {
  journalLineId: string;
  accountCode?: string;
  accountName?: string;
  partyType?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  debit: string;
  credit: string;
  memo: string | null;
}

interface JournalEntrySlideOverProps {
  entry: JournalEntry | null;
  onClose: () => void;
}

export default function JournalEntrySlideOver({ entry, onClose }: JournalEntrySlideOverProps) {
  const t = useTranslations('gl.journalEntries');
  const tCommon = useTranslations('common');

  function fmt(v: string | number) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (!n || n === 0) return tCommon('na');
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(false);

  const sourceLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales_invoice: t('sourceSalesInvoice'),
      purchase_invoice: t('sourcePurchaseInvoice'),
      sales_credit_note: t('sourceSalesCreditNote'),
      manual: t('sourceManual'),
    };
    if (labels[type]) return labels[type];
    
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    if (!entry) {
      setLines([]);
      return;
    }

    setLoading(true);
    api.glControllerGetJournalEntry(entry.journalEntryId)
      .then((res) => {
        const detail = res.data as unknown as { lines?: JournalLine[] };
        setLines(detail.lines || []);
      })
      .catch((err) => reportError(err, 'JournalEntrySlideOver'))
      .finally(() => setLoading(false));
  }, [entry]);

  return (
    <SlideOver
      isOpen={!!entry}
      onClose={onClose}
      title={entry ? entry.entryNumber : t('title')}
      subtitle={entry ? `${formatLocalDate(entry.entryDate)} · ${sourceLabel(entry.sourceType)}` : undefined}
      width="max-w-3xl"
    >
      {entry && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex flex-col gap-5 text-sm">
              <div>
                <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('columns.memo')}</span>
                <span className="text-[var(--text-primary)]">{entry.memo || tCommon('na')}</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('sourceDocument')}</span>
                {entry.sourceId && (['sales_invoice', 'sales_credit_note', 'payment_entry', 'purchase_invoice', 'inventory_receipt'].includes(entry.sourceType)) ? (
                  <Link 
                    href={
                      entry.sourceType === 'payment_entry' 
                        ? routes.payments.detail(entry.sourceId) 
                        : entry.sourceType === 'sales_invoice' 
                          ? routes.salesInvoices.detail(entry.sourceId) 
                          : entry.sourceType === 'purchase_invoice'
                            ? routes.supplierInvoices.detail(entry.sourceId)
                            : entry.sourceType === 'inventory_receipt'
                              ? routes.receiving.detail(entry.sourceId)
                              : routes.salesCreditNotes.detail(entry.sourceId)
                    }
                    className="text-[var(--accent)] hover:underline"
                    onClick={onClose}
                  >
                    {entry.sourceNumber || sourceLabel(entry.sourceType)}
                  </Link>
                ) : (
                  <span className="text-[var(--text-primary)]">{entry.sourceNumber || sourceLabel(entry.sourceType)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner text-[var(--text-muted)]"></span>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-primary)] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{t('columns.glAccount')}</th>
                    <th className="px-5 py-3">{t('columns.party')}</th>
                    <th className="px-5 py-3 text-right">{t('columns.debit')}</th>
                    <th className="px-5 py-3 text-right">{t('columns.credit')}</th>
                    <th className="px-5 py-3">{t('columns.memo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {lines.map((l) => (
                    <tr key={l.journalLineId} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs text-[var(--text-muted)]">{l.accountCode}</div>
                        <div className="font-semibold text-[var(--text-primary)] mt-0.5">{l.accountName}</div>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {l.partyType && l.partyId ? (
                          <Link 
                            href={l.partyType === 'customer' ? routes.customers.detail(l.partyId) : routes.suppliers.detail(l.partyId)}
                            className="text-[var(--accent)] hover:underline"
                            onClick={onClose}
                          >
                            {l.partyName || (l.partyId ? `${l.partyType}: ${l.partyId.substring(0, 8)}...` : l.partyType)}
                          </Link>
                        ) : l.partyType ? (
                          <span className="text-[var(--text-muted)]">
                            {l.partyType}: {l.partyId?.substring(0, 8)}...
                          </span>
                        ) : tCommon('na')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-[var(--text-primary)]">
                        {fmt(l.debit)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-[var(--text-primary)]">
                        {fmt(l.credit)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)] text-xs">
                        {l.memo || tCommon('na')}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {lines.length > 0 && (
                    <tr className="bg-[var(--bg-secondary)] border-t-2 border-[var(--border)]">
                      <td colSpan={2} className="px-5 py-3 text-right font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
                        {t('total')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                        {fmt(lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0))}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[var(--text-primary)]">
                        {fmt(lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0))}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {!loading && lines.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">
                {t('noLines')}
              </div>
            )}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
