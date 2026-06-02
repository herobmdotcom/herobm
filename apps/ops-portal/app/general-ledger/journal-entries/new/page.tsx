'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import CustomerSelect from '@/components/shared/CustomerSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

interface GlAccount {
  accountCode: string;
  name: string;
  isGroup: boolean;
  isActive: boolean;
  accountType: string;
}



interface JournalLineForm {
  id: string;
  accountCode: string;
  partyType: 'none' | 'customer' | 'supplier';
  partyId: string;
  debit: string;
  credit: string;
  memo: string;
}

// Generate a random ID for React keys
const uid = () => Math.random().toString(36).substring(2, 9);

export default function NewJournalEntryPage() {
  const t = useTranslations('gl.journalEntries');
  useDocumentTitle(t('newManualEntry'));
  const tGeneral = useTranslations('gl');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<JournalLineForm[]>([
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', debit: '', credit: '', memo: '' },
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', debit: '', credit: '', memo: '' },
  ]);

  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch all required data for the dropdowns
    api.glControllerGetAccounts({ format: 'flat' })
      .then(res => {
        const payload = res.data;
        setAccounts(payload.filter(a => !a.isGroup && a.isActive));
      })
      .catch((err) => reportError(err, 'NewJournalEntryPage - accounts'));
  }, []);

  const totalDebit = useMemo(() => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  }, [lines]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const isFilled = lines.length >= 2 && lines.every(l => l.accountCode) && totalDebit > 0;
  const canSubmit = isBalanced && isFilled && !submitting;

  const updateLine = (id: string, field: keyof JournalLineForm, value: string) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      // Reset partyId if type changes
      if (field === 'partyType' && value === 'none') updated.partyId = '';
      if (field === 'partyType' && value !== l.partyType) updated.partyId = '';

      // Auto-clear opposite amount
      if (field === 'debit' && value) updated.credit = '';
      if (field === 'credit' && value) updated.debit = '';

      return updated;
    }));
  };

  const addLine = () => {
    setLines([...lines, { id: uid(), accountCode: '', partyType: 'none', partyId: '', debit: '', credit: '', memo: '' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter(l => l.id !== id));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const payloadLines = lines.map(line => ({
      accountCode: line.accountCode,
      partyType: line.partyType === 'none' ? undefined : (line.partyType as any),
      partyId: line.partyId || undefined,
      debit: parseFloat(line.debit) || 0,
      credit: parseFloat(line.credit) || 0,
      memo: line.memo || undefined,
    }));

    try {
      await api.glControllerCreateManualJournalEntry({
        entryDate: date,
        memo: memo || undefined,
        lines: payloadLines,
      });
      router.push('/general-ledger/journal-entries');
    } catch (err) {
      reportError(err, 'NewJournalEntryPage');
      setSubmitting(false);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('newManualEntry')}
          onBack={() => router.push('/general-ledger/journal-entries')}
          actions={
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push('/general-ledger/journal-entries')}
                disabled={submitting}
              >
                {tCommon('cancel')}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? tCommon('saving') : t('postEntry')}
              </button>
            </>
          }
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.date')} *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.memo')}
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={t('placeholders.memo')}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <h3 className="section-heading !mb-0 shrink-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">list</span>
              {t('lines')}
            </h3>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={addLine}>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined text-[16px]">add</span> {t('addLine')}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th>{t('columns.glAccount')}</th>
                  <th>{t('columns.partyType')}</th>
                  <th>{t('columns.party')}</th>
                  <th>{t('columns.memo')}</th>
                  <th style={{ width: 120, textAlign: 'right' }}>{t('columns.debit')}</th>
                  <th style={{ width: 120, textAlign: 'right' }}>{t('columns.credit')}</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <select
                        value={line.accountCode}
                        onChange={(e) => updateLine(line.id, 'accountCode', e.target.value)}
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                      >
                        <option value="">{t('placeholders.selectAccount')}</option>
                        {accounts.map(a => (
                          <option key={a.accountCode} value={a.accountCode}>
                            {a.accountCode} - {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={line.partyType}
                        onChange={(e) => updateLine(line.id, 'partyType', e.target.value)}
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                      >
                        <option value="none">{t('partyTypes.none')}</option>
                        <option value="customer">{t('partyTypes.customer')}</option>
                        <option value="supplier">{t('partyTypes.supplier')}</option>
                      </select>
                    </td>
                    <td>
                      {line.partyType === 'none' && (
                        <div className="input text-gray-400 bg-gray-50 flex items-center" style={{ width: '100%', height: '32px', fontSize: 13 }}>
                          —
                        </div>
                      )}
                      {line.partyType === 'customer' && (
                        <CustomerSelect
                          value={line.partyId}
                          onChange={(acc) => updateLine(line.id, 'partyId', acc ? acc.customerId : '')}
                          placeholder={t('placeholders.selectParty')}
                        />
                      )}
                      {line.partyType === 'supplier' && (
                        <SupplierSelect
                          value={line.partyId}
                          onChange={(sup) => updateLine(line.id, 'partyId', sup ? sup.vendorId : '')}
                          placeholder={t('placeholders.selectParty')}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.memo}
                        onChange={(e) => updateLine(line.id, 'memo', e.target.value)}
                        placeholder={t('placeholders.lineMemo')}
                        className="input"
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                        className="input"
                        style={{ width: '100%', textAlign: 'right', fontSize: 13 }}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                        className="input"
                        style={{ width: '100%', textAlign: 'right', fontSize: 13 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 2}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex justify-end mt-4">
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col w-full md:w-80">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 pb-2 mb-2">
                  <span className="text-sm font-semibold text-slate-500">{t('totals')}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm font-medium text-slate-500">{t('columns.debit')}</span>
                  <span className="text-sm font-semibold">{totalDebit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm font-medium text-slate-500">{t('columns.credit')}</span>
                  <span className="text-sm font-semibold">{totalCredit.toFixed(2)}</span>
                </div>
                {!isBalanced && totalDebit > 0 && (
                  <div className="mt-2 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-md border border-red-200">
                    {t('unbalancedWarning', { amount: Math.abs(totalDebit - totalCredit).toFixed(2) })}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
