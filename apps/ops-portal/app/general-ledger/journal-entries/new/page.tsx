'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface GlAccount {
  accountCode: string;
  name: string;
  isGroup: boolean;
  isActive: boolean;
  accountType: string;
}

interface Party {
  id: string;
  name: string;
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
  useDocumentTitle('New Journal Entry');
  const t = useTranslations('gl.journalEntries');
  const tGeneral = useTranslations('gl');
  const router = useRouter();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<JournalLineForm[]>([
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', debit: '', credit: '', memo: '' },
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', debit: '', credit: '', memo: '' },
  ]);

  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch all required data for the dropdowns
    apiFetch<GlAccount[]>('/api/gl/accounts?format=flat')
      .then((res) => setAccounts(res.filter(a => !a.isGroup && a.isActive)))
      .catch((err) => reportError(err, 'NewJournalEntryPage - accounts'));

    apiFetch<{ data: any[] }>('/api/accounts?limit=1000') // Customers
      .then((res) => setCustomers(res.data.map(c => ({ id: c.accountId, name: c.name }))))
      .catch((err) => reportError(err, 'NewJournalEntryPage - customers'));

    apiFetch<{ data: any[] }>('/api/suppliers?limit=1000') // Suppliers
      .then((res) => setSuppliers(res.data.map(s => ({ id: s.vendorId, name: s.name }))))
      .catch((err) => reportError(err, 'NewJournalEntryPage - suppliers'));
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
      partyType: line.partyType === 'none' ? null : line.partyType,
      partyId: line.partyId || null,
      debit: parseFloat(line.debit) || 0,
      credit: parseFloat(line.credit) || 0,
      memo: line.memo || undefined,
    }));

    try {
      await apiFetch('/api/gl/journal-entries', {
        method: 'POST',
        body: JSON.stringify({
          entryDate: date,
          memo: memo || undefined,
          lines: payloadLines,
        }),
      });
      router.push('/general-ledger/journal-entries');
    } catch (err) {
      reportError(err, 'NewJournalEntryPage');
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col p-4 lg:p-6 overflow-auto">
        <div className="max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white border shadow-sm hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h2 className="text-[1.3rem] font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
              {t('newEntry', { defaultValue: 'New Manual Journal Entry' })}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('columns.date')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('columns.memo')}
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Reason for journal entry..."
                  className="w-full text-sm px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Lines Table */}
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('lines')}
            </h3>
            
            <div className="overflow-x-auto rounded border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.account')}</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Party Type</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Party</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.memo')}</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.debit')}</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('columns.credit')}</th>
                    <th className="w-10 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} style={{ borderBottom: index < lines.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="p-2 align-top w-64">
                        <select
                          value={line.accountCode}
                          onChange={(e) => updateLine(line.id, 'accountCode', e.target.value)}
                          className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="">Select Account...</option>
                          {accounts.map(a => (
                            <option key={a.accountCode} value={a.accountCode}>
                              {a.accountCode} - {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 align-top w-32">
                        <select
                          value={line.partyType}
                          onChange={(e) => updateLine(line.id, 'partyType', e.target.value)}
                          className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="none">None</option>
                          <option value="customer">Customer</option>
                          <option value="supplier">Supplier</option>
                        </select>
                      </td>
                      <td className="p-2 align-top w-48">
                        <select
                          value={line.partyId}
                          onChange={(e) => updateLine(line.id, 'partyId', e.target.value)}
                          disabled={line.partyType === 'none'}
                          className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none disabled:opacity-50 disabled:bg-gray-100"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="">{line.partyType === 'none' ? '—' : 'Select Party...'}</option>
                          {line.partyType === 'customer' && customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                          {line.partyType === 'supplier' && suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          value={line.memo}
                          onChange={(e) => updateLine(line.id, 'memo', e.target.value)}
                          placeholder="Line description"
                          className="w-full text-sm px-2 py-1.5 rounded border focus:outline-none"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </td>
                      <td className="p-2 align-top w-28">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                          className="w-full text-sm px-2 py-1.5 rounded border text-right font-mono focus:outline-none"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </td>
                      <td className="p-2 align-top w-28">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                          className="w-full text-sm px-2 py-1.5 rounded border text-right font-mono focus:outline-none"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </td>
                      <td className="p-2 align-top text-center">
                        <button
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t bg-gray-50 flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={addLine}
                  className="px-3 py-1 text-xs font-semibold rounded border bg-white hover:bg-gray-100 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span> Add Line
                </button>

                <div className="flex items-center gap-6 pr-12">
                  <div className="text-sm font-semibold text-gray-500">
                    Totals:
                  </div>
                  <div className="text-right w-24">
                    <span className="font-mono font-bold text-[#041627]">{totalDebit.toFixed(2)}</span>
                  </div>
                  <div className="text-right w-24">
                    <span className="font-mono font-bold text-[#041627]">{totalCredit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Balancer Warning */}
            <div className="mt-4 flex justify-end">
              {!isBalanced && totalDebit > 0 && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-md border border-red-200">
                  ⚠️ Entry is unbalanced by {Math.abs(totalDebit - totalCredit).toFixed(2)}
                </div>
              )}
            </div>

          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.back()}
              className="px-5 py-2 rounded-lg font-bold text-sm bg-white border shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition-all disabled:opacity-50"
              style={{ background: canSubmit ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              Post Journal Entry
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
