import { useState, useEffect } from 'react';
import * as api from '@modbm/sdk';
import { reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface GroupSelectProps {
  type: 'customer' | 'supplier' | 'product';
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

interface GroupItem {
  groupCode: string;
  name: string;
  [key: string]: unknown;
}

export default function GroupSelect({
  type,
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: GroupSelectProps) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('common');

  useEffect(() => {
    let active = true;
    setLoading(true);
    
    const fetchMap: Record<string, any> = {
      customer: api.accountGroupsControllerFindAll,
      product: api.productGroupsControllerFindAll,
      supplier: api.supplierGroupsControllerFindAll,
    };

    fetchMap[type]().then((data: any) => {
        if (active) setGroups(data.data);
      })
      .catch((err: any) => reportError(`Failed to fetch ${type} groups:`, err))
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
        <option key={String(g[idField])} value={String(g[idField])}>
          {g.groupCode} — {g.name}
        </option>
      ))}
    </select>
  );
}
