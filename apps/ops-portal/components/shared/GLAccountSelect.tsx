'use client';

import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
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
}

export default function GLAccountSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  allowGroups = false,
}: GLAccountSelectProps) {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('common');

  useEffect(() => {
    let active = true;
    setLoading(true);

    apiFetch<GLAccount[]>('/api/gl/accounts')
      .then((data) => {
        if (active) setAccounts(data);
      })
      .catch((err) => reportError(err, 'GLAccountSelect'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
