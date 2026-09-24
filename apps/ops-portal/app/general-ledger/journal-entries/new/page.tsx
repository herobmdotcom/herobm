'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import CustomerSelect from '@/components/shared/CustomerSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import { useSettings } from '@/components/SettingsProvider';
import { formatAmount } from '@/lib/currency';

interface GlAccount {
  accountCode: string;
  name: string;
  isGroup: boolean;
  isActive: boolean;
  accountType: string;
}



interface ProjectOption {
  projectId: string;
  projectNumber: string;
  name: string;
  tasks?: { projectTaskId: string; taskCode: string; name?: string; taskName?: string }[];
}

interface JournalLineForm {
  id: string;
  accountCode: string;
  partyType: 'none' | 'customer' | 'supplier';
  partyId: string;
  costCenterId: string;
  activityId: string;
  projectId: string;
  projectTaskId: string;
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
  const { baseCurrency } = useSettings();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<api.CreateJournalEntryDtoSourceType>('manual');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<JournalLineForm[]>([
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', costCenterId: '', activityId: '', projectId: '', projectTaskId: '', debit: '', credit: '', memo: '' },
    { id: uid(), accountCode: '', partyType: 'none', partyId: '', costCenterId: '', activityId: '', projectId: '', projectTaskId: '', debit: '', credit: '', memo: '' },
  ]);

  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [costCenters, setCostCenters] = useState<{ costCenterId: string; code: string; name: string }[]>([]);
  const [activities, setActivities] = useState<{ activityId: string; code: string; name: string }[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch all required data for the dropdowns
    api.glControllerGetAccounts({ format: 'flat' })
      .then(res => {
        const payload = res.data;
        setAccounts(payload.filter(a => !a.isGroup && a.isActive));
      })
      .catch((err) => reportError(err, 'NewJournalEntryPage - accounts'));

    api.costCentersControllerFindAll()
      .then(res => {
        const cData = res.data as unknown as { costCenterId: string; code: string; name: string; isActive?: boolean }[];
        setCostCenters(cData.filter(c => c.isActive));
      })
      .catch((err) => reportError(err, 'NewJournalEntryPage - costCenters'));

    api.activitiesControllerFindAll()
      .then(res => {
        const aData = res.data as unknown as { activityId: string; code: string; name: string; isActive?: boolean }[];
        setActivities(aData.filter(a => a.isActive));
      })
      .catch((err) => reportError(err, 'NewJournalEntryPage - activities'));

    api.projectsControllerFindAll({ limit: 200 })
      .then(res => {
        const responseData = res.data as unknown as { data?: ProjectOption[] } | ProjectOption[];
        const raw = Array.isArray(responseData) ? responseData : (responseData?.data || []);
        setProjects(raw);
      })
      .catch((err) => reportError(err, 'NewJournalEntryPage - projects'));
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

      // Reset projectTaskId if project changes
      if (field === 'projectId') updated.projectTaskId = '';

      // Auto-clear opposite amount
      if (field === 'debit' && value) updated.credit = '';
      if (field === 'credit' && value) updated.debit = '';

      return updated;
    }));
  };

  const addLine = () => {
    setLines([...lines, { id: uid(), accountCode: '', partyType: 'none', partyId: '', costCenterId: '', activityId: '', projectId: '', projectTaskId: '', debit: '', credit: '', memo: '' }]);
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
      partyType: line.partyType === 'none' ? undefined : (line.partyType as 'customer' | 'supplier'),
      partyId: line.partyId || undefined,
      costCenterId: line.costCenterId || undefined,
      activityId: line.activityId || undefined,
      projectId: line.projectId || undefined,
      projectTaskId: line.projectTaskId || undefined,
      debit: parseFloat(line.debit) || 0,
      credit: parseFloat(line.credit) || 0,
      memo: line.memo || undefined,
    }));

    try {
      await api.glControllerCreateManualJournalEntry({
        entryDate: date,
        memo: memo || undefined,
        sourceType,
        lines: payloadLines as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Required to map partial form state to SDK expected properties */,
      });
      router.push('/general-ledger/journal-entries');
    } catch (err) {
      toast.error(getErrorMessage(err));
      reportError(err, 'NewJournalEntryPage');
      setSubmitting(false);
    }
  };

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('newManualEntry')}
          actions={
            <>
              <Button
                variant="secondary" size="sm"
                onClick={() => router.push('/general-ledger/journal-entries')}
                disabled={submitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                variant="primary" size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? tCommon('saving') : t('postEntry')}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('entryType')} *
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as api.CreateJournalEntryDtoSourceType)}
                className="input w-full"
              >
                <option value="manual">{t('sourceTypes.manual')}</option>
                <option value="opening_balance">{t('sourceTypes.opening_balance')}</option>
                <option value="adjustment">{t('sourceTypes.adjustment')}</option>
                <option value="payroll">{t('sourceTypes.payroll')}</option>
                <option value="tax_settlement">{t('sourceTypes.tax_settlement')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">list</span>
              {t('lines')}
            </h3>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addLine}>
                {t('addLine')}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-2.5 px-2 w-8 text-center">#</th>
                  <th className="py-2.5 px-2 w-[28%]">{t('columns.glAccount')} *</th>
                  <th className="py-2.5 px-2">{t('columns.memo')}</th>
                  <th className="py-2.5 px-2 w-36 text-right">{t('columns.debit')}</th>
                  <th className="py-2.5 px-2 w-36 text-right">{t('columns.credit')}</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              {lines.map((line, idx) => (
                <tbody key={line.id} className="group border-b border-slate-200 dark:border-slate-800">
                  {/* Row 1: Core Financials */}
                  <tr className="bg-[var(--bg-card)]">
                    <td className="py-2.5 px-2 text-center text-sm font-mono text-[var(--text-muted)] align-middle">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        value={line.accountCode}
                        onChange={(e) => updateLine(line.id, 'accountCode', e.target.value)}
                        className="input w-full text-sm font-medium h-9"
                      >
                        <option value="">{t('placeholders.selectAccount')}</option>
                        {accounts.map((a) => (
                          <option key={a.accountCode} value={a.accountCode}>
                            {a.accountCode} - {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="text"
                        value={line.memo}
                        onChange={(e) => updateLine(line.id, 'memo', e.target.value)}
                        placeholder={t('placeholders.lineMemo')}
                        className="input w-full text-sm h-9"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                        placeholder="0.00"
                        className="input w-full text-right text-sm font-mono font-medium h-9"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                        placeholder="0.00"
                        className="input w-full text-right text-sm font-mono font-medium h-9"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-center align-middle">
                      <Button
                        variant="ghost"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 2}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Delete Line"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </Button>
                    </td>
                  </tr>

                  {/* Row 2: Dimension Lines (3 lines x 2 columns) */}
                  <tr className="bg-[var(--bg-card)]">
                    <td className="py-1 px-2"></td>
                    <td colSpan={4} className="py-1 px-2 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 max-w-4xl">
                        {/* Line 1: Party Type & Party */}
                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {t('columns.partyType')}:
                          </span>
                          <select
                            value={line.partyType}
                            onChange={(e) => updateLine(line.id, 'partyType', e.target.value)}
                            className="input h-9 text-sm flex-1 px-3"
                          >
                            <option value="none">{t('partyTypes.none')}</option>
                            <option value="customer">{t('partyTypes.customer')}</option>
                            <option value="supplier">{t('partyTypes.supplier')}</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {t('columns.party')}:
                          </span>
                          <div className="flex-1">
                            {line.partyType === 'customer' ? (
                              <CustomerSelect
                                value={line.partyId}
                                onChange={(acc) => updateLine(line.id, 'partyId', acc ? acc.customerId : '')}
                                placeholder={t('placeholders.selectParty')}
                                className="!h-9 !text-sm w-full"
                              />
                            ) : line.partyType === 'supplier' ? (
                              <SupplierSelect
                                value={line.partyId}
                                onChange={(sup) => updateLine(line.id, 'partyId', sup ? sup.vendorId : '')}
                                placeholder={t('placeholders.selectParty')}
                                className="!h-9 !text-sm w-full"
                              />
                            ) : (
                              <input
                                type="text"
                                disabled
                                placeholder={t('placeholders.selectParty')}
                                className="input h-9 text-sm w-full opacity-50 cursor-not-allowed"
                              />
                            )}
                          </div>
                        </div>

                        {/* Line 2: Project & Task */}
                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {t('columns.project')}:
                          </span>
                          <select
                            value={line.projectId}
                            onChange={(e) => updateLine(line.id, 'projectId', e.target.value)}
                            className="input h-9 text-sm flex-1 px-3"
                          >
                            <option value="">—</option>
                            {projects.map((p) => (
                              <option key={p.projectId} value={p.projectId}>
                                {p.projectNumber} - {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {t('columns.task')}:
                          </span>
                          <select
                            value={line.projectTaskId}
                            onChange={(e) => updateLine(line.id, 'projectTaskId', e.target.value)}
                            disabled={!line.projectId}
                            className="input h-9 text-sm flex-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">—</option>
                            {line.projectId &&
                              projects
                                .find((p) => p.projectId === line.projectId)
                                ?.tasks?.map((task) => (
                                  <option key={task.projectTaskId} value={task.projectTaskId}>
                                    {task.taskCode} - {task.name || task.taskName || ''}
                                  </option>
                                ))}
                          </select>
                        </div>

                        {/* Line 3: Cost Center & Activity */}
                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {tCommon('costCenter')}:
                          </span>
                          <select
                            value={line.costCenterId}
                            onChange={(e) => updateLine(line.id, 'costCenterId', e.target.value)}
                            className="input h-9 text-sm flex-1 px-3"
                          >
                            <option value="">—</option>
                            {costCenters.map((cc) => (
                              <option key={cc.costCenterId} value={cc.costCenterId}>
                                {cc.code} - {cc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {tCommon('activity')}:
                          </span>
                          <select
                            value={line.activityId}
                            onChange={(e) => updateLine(line.id, 'activityId', e.target.value)}
                            className="input h-9 text-sm flex-1 px-3"
                          >
                            <option value="">—</option>
                            {activities.map((act) => (
                              <option key={act.activityId} value={act.activityId}>
                                {act.code} - {act.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="py-1 px-2"></td>
                  </tr>
                </tbody>
              ))}
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-[var(--bg-card)]">
                  <td colSpan={3} className="py-3 px-2 text-right text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {t('totals')}
                  </td>
                  <td className="py-3 px-2 text-right text-sm font-bold font-mono">
                    <div className="pr-3">{formatAmount(totalDebit, baseCurrency)}</div>
                  </td>
                  <td className="py-3 px-2 text-right text-sm font-bold font-mono">
                    <div className="pr-3">{formatAmount(totalCredit, baseCurrency)}</div>
                  </td>
                  <td className="py-3 px-2"></td>
                </tr>
                {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
                  <tr className="border-t border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20">
                    <td colSpan={6} className="py-2.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        {t('unbalancedWarning', {
                          amount: formatAmount(Math.abs(totalDebit - totalCredit), baseCurrency),
                        })}
                      </span>
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
