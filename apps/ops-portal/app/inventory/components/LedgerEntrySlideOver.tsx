'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, reportError } from '@/lib/api';
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
  const tCommon = useTranslations('common');
  
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<EntryDetails | null>(null);

  useEffect(() => {
    if (!entryId) {
      setDetails(null);
      return;
    }

    setLoading(true);
    apiFetch<EntryDetails>(`/api/inventory/entries/${entryId}`)
      .then(setDetails)
      .catch((err) => reportError(err, 'LedgerEntrySlideOver'))
      .finally(() => setLoading(false));
  }, [entryId]);

  return (
    <SlideOver
      isOpen={!!entryId}
      onClose={onClose}
      title={details ? `${details.sourceType}: ${details.entryNumber}` : 'Entry Details'}
      subtitle={details ? `${new Date(details.entryDate).toLocaleString()} · ${details.createdBy || 'System'}` : undefined}
      width="max-w-2xl"
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="loading loading-spinner text-gray-400"></span>
        </div>
      ) : details ? (
        <div className="space-y-6">
          <div className="bg-[#f8f9fa] rounded-lg p-4 border border-gray-200">
            <div className={`grid gap-4 text-sm ${details.relatedParty ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Source Type</span>
                <span className="text-[#041627]">{details.sourceType}</span>
              </div>
              {details.relatedDocument && (
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Source Document</span>
                  {details.relatedDocument.link ? (
                    <Link href={details.relatedDocument.link} className="text-[#0ea5e9] hover:underline font-semibold" onClick={onClose}>
                      {details.relatedDocument.number}
                    </Link>
                  ) : (
                    <span className="text-[#041627] font-semibold">{details.relatedDocument.number}</span>
                  )}
                </div>
              )}
              {details.relatedParty && (
                <div className="md:col-span-2">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Related Party</span>
                  <div className="text-[#041627]">
                    {details.relatedParty.link ? (
                      <Link href={details.relatedParty.link} className="text-[#0ea5e9] hover:underline font-semibold" onClick={onClose}>
                        {details.relatedParty.name}
                      </Link>
                    ) : (
                      <span className="font-semibold">{details.relatedParty.name}</span>
                    )}
                    <span className={`ml-2 text-xs font-mono px-1.5 py-0.5 rounded border ${details.relatedParty.link ? 'text-[#0ea5e9] bg-[#e0f2fe] border-[#bae6fd]' : 'text-gray-500 bg-gray-100'}`}>
                      {details.relatedParty.number}
                    </span>
                  </div>
                </div>
              )}
              <div className={details.relatedParty ? 'col-span-2 md:col-span-4 mt-2' : 'col-span-2'}>
                <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Operation Memo</span>
                <span className="text-[#041627]">{details.memo || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Location & Bin</th>
                  <th className="px-5 py-3 text-right">Qty Change</th>
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
                No ledger lines found for this entry.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-gray-500">
          Failed to load entry details.
        </div>
      )}
    </SlideOver>
  );
}
