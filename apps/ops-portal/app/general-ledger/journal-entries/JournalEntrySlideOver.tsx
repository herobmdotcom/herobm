'use client';

import React, { useEffect, useState } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export interface JournalEntry {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
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
    return labels[type] || type;
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
      subtitle={entry ? `${new Date(entry.entryDate).toLocaleDateString()} · ${sourceLabel(entry.sourceType)}` : undefined}
      width="max-w-3xl"
    >
      {entry && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex flex-col gap-5 text-sm">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('columns.memo')}</span>
                <span className="text-[#041627]">{entry.memo || tCommon('na')}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('sourceDocument')}</span>
                {entry.sourceId && (entry.sourceType === 'sales_invoice' || entry.sourceType === 'sales_credit_note') ? (
                  <Link 
                    href={`/sales-orders/${entry.sourceId}${entry.sourceType === 'sales_invoice' ? '#invoices-section' : ''}`} 
                    className="text-[var(--accent)] hover:underline"
                    onClick={onClose}
                  >
                    {sourceLabel(entry.sourceType)}
                  </Link>
                ) : (
                  <span className="text-[#041627]">{sourceLabel(entry.sourceType)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner text-gray-400"></span>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">{t('columns.glAccount')}</th>
                    <th className="px-5 py-3">{t('columns.party')}</th>
                    <th className="px-5 py-3 text-right">{t('columns.debit')}</th>
                    <th className="px-5 py-3 text-right">{t('columns.credit')}</th>
                    <th className="px-5 py-3">{t('columns.memo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l) => (
                    <tr key={l.journalLineId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs text-gray-500">{l.accountCode}</div>
                        <div className="font-semibold text-[#041627] mt-0.5">{l.accountName}</div>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {l.partyType && l.partyId ? (
                          <Link 
                            href={`/${l.partyType === 'customer' ? 'accounts' : 'suppliers'}/${l.partyId}`}
                            className="text-[var(--accent)] hover:underline"
                            onClick={onClose}
                          >
                            {l.partyName || (l.partyId ? `${l.partyType}: ${l.partyId.substring(0, 8)}...` : l.partyType)}
                          </Link>
                        ) : l.partyType ? (
                          <span className="text-gray-600">
                            {l.partyType}: {l.partyId?.substring(0, 8)}...
                          </span>
                        ) : tCommon('na')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-[#041627]">
                        {fmt(l.debit)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-[#041627]">
                        {fmt(l.credit)}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {l.memo || tCommon('na')}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {lines.length > 0 && (
                    <tr className="bg-[#f8f9fa] border-t-2 border-gray-200">
                      <td colSpan={2} className="px-5 py-3 text-right font-bold text-[#041627] text-xs uppercase tracking-wider">
                        {t('total')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[#041627]">
                        {fmt(lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0))}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-[#041627]">
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
