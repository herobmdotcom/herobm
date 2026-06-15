'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import { getErrorMessage } from '@herobm/shared';

/** Local row type that flattens glAccountIds[0] → glAccountId for the inline table */
interface RuleRow extends api.ReconciliationRuleResponseDto {
  glAccountId: string;
}

export default function RulesEnginePage() {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle('Reconciliation Rules');

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const accs = await api.glControllerGetAccounts();
      setGlAccounts(accs.data || []);
      const r = await api.bankFeedsControllerGetRules();
      setRules((r.data || []).map((rule) => ({
        ...rule,
        glAccountId: rule.glAccountIds?.[0] || ''
      })));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (row: RuleRow, isNew: boolean) => {
    if (!row.conditionValue || !row.targetGlAccountId) {
      throw new Error('Condition Value and Target Account are required');
    }
    if (isNew) {
      await api.bankFeedsControllerCreateRule({
        glAccountIds: row.glAccountId ? [row.glAccountId] : [],
        conditionType: row.conditionType,
        conditionValue: row.conditionValue,
        targetGlAccountId: row.targetGlAccountId,
        priority: 10
      });
      toast.success(t('ruleCreated') || 'Rule created');
    }
    // Note: The API does not currently support updating rules, so we only handle creation.
    await loadData();
  };

  const handleDelete = async (row: RuleRow) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.bankFeedsControllerDeleteRule(row.ruleId);
      toast.success(t('ruleDeleted') || 'Rule deleted');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const bankAccs = glAccounts.filter(a => (a as api.GlAccountResponseDto & { isBankAccount?: boolean }).isBankAccount);

  const columns = useMemo(() => [
    {
      key: 'glAccountId',
      title: t('bankAccount'),
      type: 'select' as const,
      options: [
        { value: '', label: t('allBankAccounts') },
        ...bankAccs.map(a => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` }))
      ],
      render: (row: RuleRow) => {
        const bank = bankAccs.find(a => a.glAccountId === row.glAccountId);
        return <span>{bank ? bank.name : t('allAccounts')}</span>;
      }
    },
    {
      key: 'conditionType',
      title: t('condition'),
      type: 'select' as const,
      options: [
        { value: 'contains', label: t('descriptionContains') },
        { value: 'starts_with', label: t('descriptionStartsWith') },
        { value: 'exact_match', label: t('descriptionExactMatch') }
      ],
      render: (row: RuleRow) => (
        <span className="bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-0.5 rounded text-xs">
          {row.conditionType}
        </span>
      )
    },
    {
      key: 'conditionValue',
      title: t('conditionValue'),
      type: 'text' as const,
      validate: (v: string) => v ? null : 'Required'
    },
    {
      key: 'targetGlAccountId',
      title: t('targetGl'),
      type: 'select' as const,
      options: [
        { value: '', label: t('selectAccountPlaceholder') },
        ...glAccounts.map(a => ({ value: a.glAccountId, label: `${a.accountCode} - ${a.name}` }))
      ],
      validate: (v: string) => v ? null : 'Required',
      render: (row: RuleRow) => {
        const target = glAccounts.find(a => a.glAccountId === row.targetGlAccountId);
        return <span className="font-medium text-[var(--brand-blue)]">
          {target ? `${target.accountCode} - ${target.name}` : row.targetGlAccountId}
        </span>;
      }
    }
  ], [bankAccs, glAccounts, t]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] p-6 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('reconciliationRules')}</h1>
        </div>

        <div className="card">
          <InlineSettingsTable
            title={t('reconciliationRules')}
            data={rules}
            rowKey={(r: RuleRow) => r.ruleId}
            onSave={handleSave}
            onDelete={handleDelete}
            onAdd={() => ({ glAccountId: '', conditionType: 'contains', conditionValue: '', targetGlAccountId: '' }) as RuleRow}
            canEdit={() => false} // the API does not support updates for rules yet
            canDelete={() => true}
            addLabel={t('addRule')}
            emptyLabel={t('noRulesDefinedYet')}
            columns={columns}
          />
        </div>
      </div>
    </div>
  );
}
