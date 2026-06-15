'use client';

import React, { useEffect, useState } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface LedgerEntrySlideOverProps {
  entryId: string | null;
  onClose: () => void;
}

interface EntryDetails {
  entryId: string;
  entryNumber: string;
  sourceType: string;
  entryDate: string;
  memo: string | null;
  createdBy: string | null;
  relatedDocument: { number: string; link?: string } | null;
  relatedParty: { name: string; number: string; link?: string } | null;
  lines: Array<{
    ledgerId: string;
    productNumber: string;
    productName: string;
    change: string;
    locationName: string;
    binCode: string;
  }>;
}

export default function LedgerEntrySlideOver({ entryId, onClose }: LedgerEntrySlideOverProps) {
  const t = useTranslations('inventory.ledger');
  const tCommon = useTranslations('common');
  
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<EntryDetails | null>(null);

  useEffect(() => {
    if (!entryId) {
      setDetails(null);
      return;
    }

    setLoading(true);
    api.inventoryControllerGetEntryDetails(entryId)
      .then(res => setDetails(res.data as unknown as EntryDetails))
      .catch((err) => reportError(err, 'LedgerEntrySlideOver'))
      .finally(() => setLoading(false));
  }, [entryId]);

  return (
    <SlideOver
      isOpen={!!entryId}
      onClose={onClose}
      title={details ? `${details.sourceType}: ${details.entryNumber}` : t('title')}
      subtitle={details ? `${new Date(details.entryDate).toLocaleString()} · ${details.createdBy || t('system')}` : undefined}
      width="max-w-2xl"
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span className="loading loading-spinner text-gray-400"></span>
        </div>
      ) : details ? (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex flex-col gap-5 text-sm">
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('sourceType')}</span>
                <span className="text-[#041627]">{details.sourceType}</span>
              </div>
              {details.relatedDocument && (
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('sourceDocument')}</span>
                  {details.relatedDocument.link ? (
                    <Link href={details.relatedDocument.link} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                      {details.relatedDocument.number}
                    </Link>
                  ) : (
                    <span className="text-[#041627] font-semibold">{details.relatedDocument.number}</span>
                  )}
                </div>
              )}
              {details.relatedParty && (
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('relatedParty')}</span>
                  <div className="text-[#041627]">
                    {details.relatedParty.link ? (
                      <Link href={details.relatedParty.link} className="text-[var(--accent)] hover:underline" onClick={onClose}>
                        {details.relatedParty.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{details.relatedParty.name}</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('operationMemo')}</span>
                <span className="text-[#041627]">{details.memo || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{t('columns.product')}</th>
                  <th className="px-5 py-3">{t('columns.locationBin')}</th>
                  <th className="px-5 py-3 text-right">{t('columns.qtyChange')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {details.lines.map((l) => {
                  const val = parseFloat(l.change || '0');
                  const isPositive = val > 0;
                  const isNegative = val < 0;
                  
                  return (
                    <tr key={l.ledgerId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 align-top">
                        <div className="font-bold text-[#041627]">{l.productNumber}</div>
                        <div className="text-gray-500 text-xs mt-0.5 max-w-[280px] break-words leading-tight">{l.productName}</div>
                      </td>
                      <td className="px-5 py-3 align-top whitespace-nowrap">
                        <div className="font-semibold text-gray-700">{l.locationName}</div>
                        <div className="font-mono text-xs text-gray-500 mt-0.5">{l.binCode}</div>
                      </td>
                      <td className={`px-5 py-3 align-top text-right font-mono font-bold ${isPositive ? 'text-[#006b5c]' : isNegative ? 'text-[#b45309]' : 'text-gray-600'}`}>
                        {isPositive ? `+${val.toLocaleString()}` : val.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {details.lines.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">
                {t('noLines')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-gray-500">
          {t('loadFailed')}
        </div>
      )}
    </SlideOver>
  );
}
