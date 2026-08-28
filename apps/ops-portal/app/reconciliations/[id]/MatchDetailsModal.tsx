'use client';
import React, { useEffect, useState } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import { formatAmount, getErrorMessage } from '@herobm/shared';

export default function MatchDetailsModal({ 
  matchGroupId, 
  reconciliationId,
  glAccountId,
  isOpen, 
  onClose,
  onUnmatchSuccess
}: { 
  matchGroupId: string;
  reconciliationId: string;
  glAccountId: string;
  isOpen: boolean; 
  onClose: () => void;
  onUnmatchSuccess: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [bankLines, setBankLines] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [ledgerLines, setLedgerLines] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [matchMetadata, setMatchMetadata] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [unmatching, setUnmatching] = useState(false);
  const tCommon = useTranslations('common');
  const t = useTranslations('admin.reconciliations');

  useEffect(() => {
    if (isOpen && matchGroupId) {
      fetchData();
    }
  }, [isOpen, matchGroupId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bankRes, journalRes, metadataRes] = await Promise.all([
        api.bankStatementControllerGetLines({ glAccountId, isReconciled: undefined }),
        api.reconciliationControllerGetLines(reconciliationId),
        api.bankStatementControllerGetMatchGroup(matchGroupId).catch(() => ({ data: null }))
      ]);

      if (metadataRes.data) {
        setMatchMetadata(metadataRes.data);
        if (metadataRes.data.bankLines && metadataRes.data.ledgerLines) {
          setBankLines(metadataRes.data.bankLines);
          setLedgerLines(metadataRes.data.ledgerLines);
          return;
        }
      }

      const bLines = (bankRes.data || []).filter(l => l.matchGroupId === matchGroupId);
      const jLines = (journalRes.data || []).filter(l => l.matchGroupId === matchGroupId);

      setBankLines(bLines);
      setLedgerLines(jLines);
    } catch (e) {
      toast.error('Failed to load match details: ' + getErrorMessage(e));
      reportError(e, 'MatchDetailsLoad');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => formatAmount(Number(val), 'AUD');

  const handleUndo = async () => {
    try {
      setUnmatching(true);
      await api.bankStatementControllerUnmatch({ matchGroupId });
      toast.success(t('undoMatchSuccess'));
      onUnmatchSuccess();
      onClose();
    } catch (e) {
      toast.error('Failed to undo match: ' + getErrorMessage(e));
      reportError(e, 'Unmatch');
    } finally {
      setUnmatching(false);
    }
  };

  const getMatchIcon = (type: string) => {
    if (type === 'manual') return 'person';
    if (type === 'rule') return 'rule';
    return 'auto_awesome';
  };

  const footerActions = (
    <div className="flex justify-end gap-3 w-full">
      <Button
        type="button"
        variant="danger" className="font-semibold px-4 py-2 flex items-center gap-2"
        onClick={handleUndo}
        disabled={loading || unmatching || !matchGroupId}
      >
        {unmatching ? tCommon('saving') : t('undoMatch')}
      </Button>
    </div>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('matchDetailsTitle')}
      width="max-w-3xl"
      footer={footerActions}
    >
      <div className="flex flex-col h-full gap-6">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">{tCommon('loading')}</div>
        ) : (
          <div className="space-y-6 flex-1 overflow-auto">
            {matchMetadata && (
              <div className="card space-y-5">
                <div className="flex flex-col gap-5 text-sm">
                  <div>
                    <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('matchSource')}</span>
                    <span className="text-[#041627] font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">
                        {getMatchIcon(matchMetadata.matchType)}
                      </span>
                      {matchMetadata.matchType === 'manual' ? t('matchManual') : 
                       matchMetadata.matchType === 'rule' ? t('matchRule', { ruleName: matchMetadata.ruleName }) : t('matchAuto')}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('matchBy')}</span>
                    <span className="text-[#041627]">{matchMetadata.createdBy}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('date')}</span>
                    <span className="text-[#041627]">
                      {new Date(matchMetadata.createdOn).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('statementLines')}</h3>
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
                    {bankLines.map(line => (
                      <tr key={line.lineId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-[#041627]">{line.date}</td>
                        <td className="px-5 py-3 text-[#041627]">{line.description}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap font-mono font-medium text-[#041627]">{formatCurrency(line.amount)}</td>
                      </tr>
                    ))}
                    {bankLines.length === 0 && (
                      <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500 italic">{t('noBankLinesFound')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('ledgerLines')}</h3>
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
                    {ledgerLines.map(line => (
                      <tr key={line.journalLineId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-[#041627]">{line.entryDate}</td>
                        <td className="px-5 py-3 text-[#041627]">{line.memo || line.entryMemo}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap font-mono font-medium text-[#041627]">{formatCurrency(Number(line.debit) - Number(line.credit))}</td>
                      </tr>
                    ))}
                    {ledgerLines.length === 0 && (
                      <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500 italic">{t('noLedgerLinesFound')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
