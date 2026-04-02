'use client';

import { ResolvedRiskProfile } from '@/lib/supplier-risk';

interface Props {
  profile: ResolvedRiskProfile | null;
  stateCode: string; // The base entity state 'active' or 'inactive'
  mode?: 'header' | 'grid';
}

export default function SupplierStatusBadges({ profile, stateCode, mode = 'grid' }: Props) {
  if (!profile) {
    // Fallback to basic state badge if no risk profile available
    if (stateCode === 'inactive') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Inactive</span>
        </div>
      );
    }
    
    // In header mode, we skip "Active" entirely
    if (mode === 'header') return null;

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</span>
      </div>
    );
  }

  const badges = [];

  // 1. Inactive State trumps all as it means the entity is functionally archived
  if (stateCode === 'inactive') {
    badges.push(
        <div key="inactive" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Inactive</span>
        </div>
    );
  }

  // 2. Payment Blocked
  if (profile.isPaymentBlocked) {
    badges.push(
      <div key="payment-blocked" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200">
        <span className="material-symbols-outlined text-[14px] text-amber-600">block</span>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Payment Blocked</span>
      </div>
    );
  }

  // 3. Purchase Blocked
  if (profile.isPurchasingBlocked) {
    badges.push(
      <div key="purchase-blocked" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200">
        <span className="material-symbols-outlined text-[14px] text-red-600">block</span>
        <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Purchase Blocked</span>
      </div>
    );
  }

  // 4. Default "Active" badge if no blocks AND entity is active
  if (badges.length === 0 && stateCode === 'active' && mode === 'grid') {
    badges.push(
      <div key="active" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active</span>
      </div>
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {badges}
    </div>
  );
}
