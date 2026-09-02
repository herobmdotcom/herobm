import React from 'react';
import { useTranslations } from 'next-intl';
import { ValidState } from '@/types/states';

interface StateBadgeProps {
  state: ValidState;
}

export default function StateBadge({ state }: StateBadgeProps) {
  const t = useTranslations('common.states');

  const s = String(state).toLowerCase();
  
  if (!s || !t.has(s as Parameters<typeof t.has>[0])) {
    return <span className={`badge badge-legacy`}>{String(state || 'unknown')}</span>;
  }

  // Perfectly type-safe because 'state' is guaranteed by TS to be a known literal
  return <span className={`badge badge-${s}`}>{t(s as Parameters<typeof t>[0])}</span>;
}

export function StateName({ state }: StateBadgeProps) {
  const t = useTranslations('common.states');
  const s = String(state).toLowerCase();
  if (!s || !t.has(s as Parameters<typeof t.has>[0])) return <span>{String(state || 'unknown')}</span>;
  return <span>{t(s as Parameters<typeof t>[0])}</span>;
}
