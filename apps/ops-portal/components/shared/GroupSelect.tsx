import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface GroupSelectProps {
  type: 'account' | 'supplier' | 'product';
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function GroupSelect({
  type,
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: GroupSelectProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('common');

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    apiFetch<any[]>(`/api/${type}-groups`)
      .then((data) => {
        if (active) setGroups(data);
      })
      .catch((err) => reportError(`Failed to fetch ${type} groups:`, err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type]);

  const idField = `${type}GroupId`;

  return (
    <select
      className={`input ${className || ''}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
    >
      <option value="">{loading ? t('loadingEllipsis') : placeholder || t('selectNone')}</option>
      {groups.map((g) => (
        <option key={g[idField]} value={g[idField]}>
          {g.groupCode} — {g.name}
        </option>
      ))}
    </select>
  );
}
