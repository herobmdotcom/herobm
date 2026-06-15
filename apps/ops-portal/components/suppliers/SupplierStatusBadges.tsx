'use client';

import { ResolvedRiskProfile } from '@/lib/supplier-risk';

interface Props {
  profile: ResolvedRiskProfile | null;
  stateCode: string; // The base entity state 'active' or 'inactive'
  mode?: 'header' | 'grid';
}

import { useTranslations } from 'next-intl';
import { SUPPLIER_STATE } from '@herobm/shared';

export default function SupplierStatusBadges({ profile, stateCode, mode = 'grid' }: Props) {
  const tSupplier = useTranslations('suppliers');
  if (!profile) {
    // Fallback to basic state badge if no risk profile available
    if (stateCode === SUPPLIER_STATE.INACTIVE) {
      return (
        <span className="badge badge-sm badge-inactive">{tSupplier('statusBadges.inactive')}</span>
      );
    }
    
    // In header mode, we skip "Active" entirely
    if (mode === 'header') return null;

    return (
      <span className="badge badge-sm badge-active">{tSupplier('statusBadges.active')}</span>
    );
  }

  const badges = [];

  // 1. Inactive State trumps all as it means the entity is functionally archived
  if (stateCode === SUPPLIER_STATE.INACTIVE) {
    badges.push(
      <span key="inactive" className="badge badge-sm badge-inactive">{tSupplier('statusBadges.inactive')}</span>
    );
  }

  // 2. Payment Blocked
  if (profile.isPaymentBlocked) {
    badges.push(
      <span key="payment-blocked" className="badge badge-sm badge-warning flex items-center gap-1">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-[14px]">block</span>
        {tSupplier('statusBadges.paymentBlocked')}
      </span>
    );
  }

  // 3. Purchase Blocked
  if (profile.isPurchasingBlocked) {
    badges.push(
      <span key="purchase-blocked" className="badge badge-sm badge-danger flex items-center gap-1">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-[14px]">block</span>
        {tSupplier('statusBadges.purchaseBlocked')}
      </span>
    );
  }

  // 4. Default "Active" badge if no blocks AND entity is active
  if (badges.length === 0 && stateCode === SUPPLIER_STATE.ACTIVE && mode === 'grid') {
    badges.push(
      <span key="active" className="badge badge-sm badge-active">{tSupplier('statusBadges.active')}</span>
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badges}
    </div>
  );
}
