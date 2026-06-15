/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';

import React, { useState, useEffect } from 'react';
import SlideOver from './SlideOver';
import { useTranslations } from 'next-intl';
import { CUSTOMER_STATE } from '@herobm/shared';

export type GroupType = 'customer' | 'supplier' | 'product';

interface Option {
  value: string;
  label: string;
}

export interface FinancialDefaultsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  groupType: GroupType;
  ownerLabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; // the current group row data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: any) => Promise<void>;
  
  glAccountOptions: Option[];
  costCenterOptions: Option[];
  activityOptions: Option[];
  taxPositionOptions?: Option[];
}

export default function FinancialDefaultsSlideOver({
  isOpen,
  onClose,
  groupType,
  ownerLabel,
  data,
  onSave,
  glAccountOptions,
  costCenterOptions,
  activityOptions,
  taxPositionOptions = []
}: FinancialDefaultsSlideOverProps) {
  const tc = useTranslations('admin.common');
  const tGlobal = useTranslations('common');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && data) {
      setFormData({ ...data });
    }
  }, [isOpen, data]);

  const handleChange = (field: string, value: string | boolean | number | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !data) return null;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={tc('financialDefaults')}
      subtitle={ownerLabel}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {tc('cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '...' : tc('save')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Customer specific fields */}
        {groupType === 'customer' && (
          <div>
            <div className="flex items-center justify-between mb-4 mt-2">
              <label className="block text-sm font-medium text-gray-700">
                {tGlobal('columns.state')}
              </label>
              <select
                className="input"
                style={{ width: 'auto' }}
                // eslint-disable-next-line no-restricted-syntax
                value={formData.stateCode || CUSTOMER_STATE.ACTIVE}
                onChange={(e) => handleChange('stateCode', e.target.value)}
                disabled={saving}
              >
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <option value={CUSTOMER_STATE.ACTIVE}>Active</option>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <option value={CUSTOMER_STATE.INACTIVE}>Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                Credit Hold
              </label>
              <div
                className="flex items-center gap-3"
                style={{ cursor: saving ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (saving) return;
                  handleChange('isOnCreditHold', !formData.isOnCreditHold);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: formData.isOnCreditHold
                      ? "var(--danger)"
                      : "var(--border)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: 3,
                      left: formData.isOnCreditHold ? 21 : 3,
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
              {tc('defArAccount')}
            </label>
            <select
              className="input w-full"
              value={formData.defaultArAccountId || ''}
              onChange={(e) => handleChange('defaultArAccountId', e.target.value)}
              disabled={saving}
            >
              <option value="">-- {tGlobal('selectNone')} --</option>
              {glAccountOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Supplier specific fields */}
        {groupType === 'supplier' && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                Early Payment Discount
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full pr-8"
                    value={formData.earlyPaymentDiscount || ''}
                    onChange={(e) => handleChange('earlyPaymentDiscount', e.target.value === '' ? null : Number(e.target.value))}
                    disabled={saving}
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  in
                </span>
                <div className="relative w-32">
                  <input
                    type="number"
                    step="1"
                    className="input w-full pr-12"
                    value={formData.earlyPaymentDiscountDays || ''}
                    onChange={(e) => handleChange('earlyPaymentDiscountDays', e.target.value === '' ? null : Number(e.target.value))}
                    disabled={saving}
                    placeholder="10"
                  />
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none text-sm">days</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc('defApAccount')}
              </label>
              <select
                className="input w-full"
                value={formData.defaultApAccountId || ''}
                onChange={(e) => handleChange('defaultApAccountId', e.target.value)}
                disabled={saving}
              >
                <option value="">-- {tGlobal('selectNone')} --</option>
                {glAccountOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Common Revenue Field (Customer & Product) */}
        {(groupType === 'customer' || groupType === 'product') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc('defRevAccount')}
            </label>
            <select
              className="input w-full"
              value={formData.defaultRevenueAccountId || ''}
              onChange={(e) => handleChange('defaultRevenueAccountId', e.target.value)}
              disabled={saving}
            >
              <option value="">-- {tGlobal('selectNone')} --</option>
              {glAccountOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Common Expense Field (Supplier & Product) */}
        {(groupType === 'supplier' || groupType === 'product') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc('defExpenseAccount')}
            </label>
            <select
              className="input w-full"
              value={formData.defaultExpenseAccountId || ''}
              onChange={(e) => handleChange('defaultExpenseAccountId', e.target.value)}
              disabled={saving}
            >
              <option value="">-- {tGlobal('selectNone')} --</option>
              {glAccountOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Shared Base Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tc('defCostCenter')}
          </label>
          <select
            className="input w-full"
            value={formData.defaultCostCenterId || ''}
            onChange={(e) => handleChange('defaultCostCenterId', e.target.value)}
            disabled={saving}
          >
            <option value="">-- {tGlobal('selectNone')} --</option>
            {costCenterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tc('defActivity')}
          </label>
          <select
            className="input w-full"
            value={formData.defaultActivityId || ''}
            onChange={(e) => handleChange('defaultActivityId', e.target.value)}
            disabled={saving}
          >
            <option value="">-- {tGlobal('selectNone')} --</option>
            {activityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tax Position (Customer & Supplier) */}
        {(groupType === 'customer' || groupType === 'supplier') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tGlobal('columns.taxPosition')}
            </label>
            <select
              className="input w-full"
              value={formData.taxPositionId || ''}
              onChange={(e) => handleChange('taxPositionId', e.target.value)}
              disabled={saving}
            >
              <option value="">-- {tGlobal('selectNone')} --</option>
              {taxPositionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
