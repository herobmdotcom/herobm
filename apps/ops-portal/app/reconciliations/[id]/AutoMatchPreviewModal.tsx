'use client';
import React, { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { formatLocalDate } from '@/lib/date';
import InlineAlert from '@/components/shared/InlineAlert';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import { formatAmount, getErrorMessage } from '@herobm/shared';

export default function AutoMatchPreviewModal({
  isOpen,
  onClose,
  previewData,
  glAccountId,
  reconciliationId,
  onConfirmSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  previewData: api.AutoMatchResponseDto | null;
  glAccountId: string;
  reconciliationId: string;
  onConfirmSuccess: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [ledgerLines, setLedgerLines] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [accounts, setAccounts] = useState<Record<string, any>[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [ignoredLineIds, setIgnoredLineIds] = useState<string[]>([]);
  const tCommon = useTranslations('common');
  const t = useTranslations('admin.reconciliations');

  const formatCurrency = (val: number | string) => formatAmount(Number(val), 'AUD');
  const formatDate = (dateStr: string) => formatLocalDate(dateStr, undefined, '');

  useEffect(() => {
    if (isOpen && previewData) {
      setIgnoredLineIds([]);
      setLoadingExtras(true);
      Promise.all([
        api.reconciliationControllerGetLines(reconciliationId),
        api.glControllerGetAccounts()
      ]).then(([resL, resA]) => {
        setLedgerLines(resL.data);
        setAccounts(resA.data);
        setLoadingExtras(false);
      }).catch(e => {
        reportError(e, 'AutoMatchPreviewLoadExtras');
        setLoadingExtras(false);
      });
    }
  }, [isOpen, previewData, reconciliationId]);

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      const res = await api.bankStatementControllerAutoMatch({
        glAccountId,
        reconciliationId,
        dryRun: false,
        ignoredStatementLineIds: ignoredLineIds.length > 0 ? ignoredLineIds : undefined
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const data = res.data as any;
      if (data.autoMatchedCount > 0 || data.smartMatchedCount > 0) {
        const msgs = [];
        if (data.autoMatchedCount > 0) msgs.push(`${data.autoMatchedCount} rules`);
        if (data.smartMatchedCount > 0) msgs.push(`${data.smartMatchedCount} smart matches`);
        toast.success(`Auto-matched: ${msgs.join(', ')}`);
        onConfirmSuccess();
      } else {
        toast('No matches were made.', { icon: 'ℹ️' });
      }
      onClose();
    } catch (e) {
      toast.error('Failed to confirm auto-match: ' + getErrorMessage(e));
      reportError(e, 'AutoMatchConfirm');
    } finally {
      setConfirming(false);
    }
  };

  const getTargetAccountName = (id: string) => {
    const acc = accounts.find(a => a.glAccountId === id);
    return acc ? acc.name : 'Unknown Account';
  };

  const handleToggleIgnore = (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    setIgnoredLineIds(prev => {
      const allIncluded = idArray.every(id => prev.includes(id));
      if (allIncluded) {
        return prev.filter(id => !idArray.includes(id)); // un-ignore
      } else {
        return [...prev, ...idArray.filter(id => !prev.includes(id))]; // ignore
      }
    });
  };

  const ignoredRuleMatches = previewData ? (previewData.proposedRuleMatches || []).filter(m => ignoredLineIds.includes(m.bankLineId)).length : 0;
  const ignoredSmartMatches = previewData ? (previewData.smartMatches || []).filter(m => m.bankLineIds.some((id: string) => ignoredLineIds.includes(id))).length : 0;
  const effectiveAutoMatchedCount = previewData ? Math.max(0, previewData.autoMatchedCount - ignoredRuleMatches) : 0;
  const effectiveSmartMatchedCount = previewData ? Math.max(0, previewData.smartMatchedCount - ignoredSmartMatches) : 0;
  const effectiveUnmatchedCount = previewData ? previewData.unmatchedCount + ignoredRuleMatches + ignoredSmartMatches : 0;

  const footerActions = (
    <div className="flex justify-end gap-3 w-full">
      <Button
        type="button"
        variant="secondary" className="font-semibold px-4 py-2"
        onClick={onClose}
        disabled={confirming}
      >
        {tCommon('cancel')}
      </Button>
      <Button
        type="button"
        variant="primary" className="font-semibold px-4 py-2 flex items-center gap-2"
        onClick={handleConfirm}
        disabled={confirming || !previewData || (effectiveAutoMatchedCount === 0 && effectiveSmartMatchedCount === 0)}
      >
        {confirming ? tCommon('saving') : t('confirmAutoMatch')}
      </Button>
    </div>
  );

  const renderStatementTable = (lines: { date: string, description: string, amount: number }[]) => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('statementLines')}</h3>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">{t('date')}</th>
              <th className="px-5 py-3">{t('description')}</th>
              <th className="px-5 py-3 text-right">{t('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[#041627]">{formatDate(line.date)}</td>
                <td className="px-5 py-3 text-[#041627]">{line.description}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-mono font-medium text-[#041627]">{formatCurrency(line.amount)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
               
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500 italic">No lines</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const renderLedgerTable = (lines: any[]) => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('ledgerLines')}</h3>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">{t('date')}</th>
              <th className="px-5 py-3">{t('memo')}</th>
              <th className="px-5 py-3 text-right">{t('amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-[#041627]">{line.entryDate || line.date ? formatDate(line.entryDate || line.date) : ''}</td>
                <td className="px-5 py-3 text-[#041627]">{line.memo || line.entryMemo}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-mono font-medium text-[#041627]">
                  {formatCurrency(line.debit !== undefined ? Number(line.debit) - Number(line.credit) : line.amount)}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500 italic">{t('noLedgerLinesFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!previewData) return null;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Auto Match"
      width="max-w-5xl"
      footer={footerActions}
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="mb-2">
          <InlineAlert
            type="info"
            message={
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Preview Results</h3>
                <p className="text-blue-800 text-sm">
                  The following actions will be taken when you confirm:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
                  <li><strong>{effectiveAutoMatchedCount}</strong> lines will be matched using rules.</li>
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
                  <li><strong>{effectiveSmartMatchedCount}</strong> lines will be matched using smart matches.</li>
                  {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
                  <li><strong>{effectiveUnmatchedCount}</strong> lines will remain unmatched.</li>
                </ul>
              </div>
            }
          />
        </div>

        {loadingExtras ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">{tCommon('loading')}</div>
        ) : (
          <>
            {previewData.proposedRuleMatches && previewData.proposedRuleMatches.length > 0 && (
              <div className="flex flex-col gap-4">
                { }
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2">Proposed Rule Matches</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                {previewData.proposedRuleMatches.map((m: any, i: number) => {
                  const isIgnored = ignoredLineIds.includes(m.bankLineId);
                  return (
                    <div key={i} className={`card p-5 space-y-6 border rounded-xl relative transition-all ${isIgnored ? 'opacity-50 grayscale bg-gray-100 border-gray-200' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm font-medium text-gray-700">{t('applyMatch')}</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!isIgnored}
                            onChange={() => handleToggleIgnore(m.bankLineId)}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {renderStatementTable([{ date: m.date, description: m.description, amount: m.amount }])}
                        {renderLedgerTable([{ 
                          date: m.date, 
                          memo: `To be created (Account: ${getTargetAccountName(m.targetGlAccountId)})`, 
                          amount: m.amount 
                        }])}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {previewData.smartMatches && previewData.smartMatches.length > 0 && (
              <div className="flex flex-col gap-4 mt-4">
                { }
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2">Proposed Smart Matches</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                {previewData.smartMatches.map((m: any, i: number) => {
                  const matchedLedgerLines = ledgerLines.filter(l => m.journalLineIds.includes(l.journalLineId));
                  const isIgnored = m.bankLineIds.some((id: string) => ignoredLineIds.includes(id));
                  return (
                    <div key={i} className={`card p-5 space-y-6 border rounded-xl relative transition-all ${isIgnored ? 'opacity-50 grayscale bg-gray-100 border-gray-200' : 'bg-gray-50/50 border-gray-200'}`}>
                      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm font-medium text-gray-700">{t('applyMatch')}</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!isIgnored}
                            onChange={() => handleToggleIgnore(m.bankLineIds)}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {renderStatementTable([{ date: m.date, description: m.description, amount: m.amount }])}
                        {renderLedgerTable(matchedLedgerLines)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </SlideOver>
  );
}
