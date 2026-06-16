import React from 'react';
import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

interface PaymentStateBadgeProps {
  state: ValidState;
  paymentType: string;
  totalAmount: number | string;
  unallocatedAmount: number | string;
}

export function PaymentStateBadge({ state, paymentType, totalAmount, unallocatedAmount }: PaymentStateBadgeProps) {
  const t = useTranslations('common.states');

  const s = String(state).toLowerCase();
  
  // Only DRAFT payments (that are not direct) get the allocation badge
  // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon).
  const isDraft = s === 'draft';
  const isDirect = paymentType?.startsWith('direct_');
  
  if (!isDraft || isDirect) {
    return <StateBadge state={state} />;
  }

  const total = parseFloat(String(totalAmount)) || 0;
  const unalloc = parseFloat(String(unallocatedAmount)) || 0;

  let allocVariant = 'neutral';
  let allocKey = 'unallocated';

  if (unalloc === 0 && total > 0) {
    allocVariant = 'success';
    allocKey = 'fully_allocated';
  } else if (unalloc > 0 && unalloc < total) {
    allocVariant = 'warning';
    allocKey = 'partially_allocated';
  } else {
    allocVariant = 'neutral';
    allocKey = 'unallocated';
  }

  // Fallback to English if translations are missing
  const textMap: Record<string, string> = {
    unallocated: 'Unallocated',
    partially_allocated: 'Partially Allocated',
    fully_allocated: 'Fully Allocated'
  };

  const allocText = t.has(allocKey as Parameters<typeof t>[0]) ? t(allocKey as Parameters<typeof t>[0]) : textMap[allocKey];

  return (
    <div className="flex items-center gap-1.5 inline-flex">
      <StateBadge state={state} />
      <span className={`badge badge-${allocVariant} badge-sm`}>{allocText}</span>
    </div>
  );
}
