'use client';

import { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';

interface GLAccount {
  glAccountId: string;
  accountCode: string;
  name: string;
  currencyCode: string;
  isGroup: boolean;
  isActive: boolean;
}

interface GLAccountSelectProps {
  value: string | null;
  onChange: (value: string | null, account?: GLAccount) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  /** If false, group accounts are filtered out. Default: false */
  allowGroups?: boolean;
  bankAccountOnly?: boolean;
}

export default function GLAccountSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  allowGroups = false,
  bankAccountOnly = false,
}: GLAccountSelectProps) {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('common');

  useEffect(() => {
    let active = true;
    setLoading(true);

    api.glControllerGetAccounts(bankAccountOnly ? { isBankAccount: 'true' } as Parameters<typeof api.glControllerGetAccounts>[0] : {} as Parameters<typeof api.glControllerGetAccounts>[0])
      .then((res) => {
        if (active) setAccounts(res.data as unknown as GLAccount[]);
      })
      .catch((err) => reportError(err, 'GLAccountSelect'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bankAccountOnly]);

  return (
    <select
      className={`input ${className || ''}`}
      value={value || ''}
      onChange={(e) => {
        const val = e.target.value || null;
        const account = accounts.find((a) => a.glAccountId === val);
        onChange(val, account);
      }}
      disabled={disabled || loading}
      required={required}
    >
      <option value="" disabled={required}>
        {loading ? t('loadingEllipsis') : placeholder || t('selectNone')}
      </option>
      {accounts
        .filter((acc) => (allowGroups || !acc.isGroup) && acc.isActive)
        .map((acc) => (
          <option key={acc.glAccountId} value={acc.glAccountId}>
            {acc.accountCode} — {acc.name}
          </option>
        ))}
    </select>
  );
}
