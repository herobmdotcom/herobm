/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */
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

export type FinancialDefaultsGroupData = {
  stateCode?: string | null;
  isOnCreditHold?: boolean | null;
  defaultArAccountId?: string | null;
  earlyPaymentDiscount?: number | string | null;
  earlyPaymentDiscountDays?: number | string | null;
  defaultApAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
  defaultExpenseAccountId?: string | null;
  defaultCostCenterId?: string | null;
  defaultActivityId?: string | null;
  taxPositionId?: string | null;
  purchaseTaxCategoryId?: string | null;
  salesTaxCategoryId?: string | null;
  [key: string]: unknown;
};

export interface FinancialDefaultsSlideOverProps<T extends FinancialDefaultsGroupData = FinancialDefaultsGroupData> {
  isOpen: boolean;
  onClose: () => void;
  groupType: GroupType;
  ownerLabel: string;
  data: T | null; // the current group row data
  onSave: (data: T) => Promise<void>;
  
  glAccountOptions: Option[];
  costCenterOptions: Option[];
  activityOptions: Option[];
  taxPositionOptions?: Option[];
  taxCategoryOptions?: Option[];
}

export default function FinancialDefaultsSlideOver<T extends FinancialDefaultsGroupData = FinancialDefaultsGroupData>({
  isOpen,
  onClose,
  groupType,
  ownerLabel,
  data,
  onSave,
  glAccountOptions,
  costCenterOptions,
  activityOptions,
  taxPositionOptions = [],
  taxCategoryOptions = []
}: FinancialDefaultsSlideOverProps<T>) {
  const tc = useTranslations('admin.common');
  const tGlobal = useTranslations('common');

  const [formData, setFormData] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && data) {
      setFormData({ ...data });
    }
  }, [isOpen, data]);

  const handleChange = (field: keyof FinancialDefaultsGroupData, value: string | boolean | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value } as Partial<T>));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(formData as T);
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
                 
                value={formData.stateCode || CUSTOMER_STATE.ACTIVE}
                onChange={(e) => handleChange('stateCode', e.target.value)}
                disabled={saving}
              >
                { }
                <option value={CUSTOMER_STATE.ACTIVE}>Active</option>
                { }
                <option value={CUSTOMER_STATE.INACTIVE}>Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                { }
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
                { }
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
                  { }
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
                  { }
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

        {/* Tax Categories (Product) */}
        {groupType === 'product' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sales Tax Category
              </label>
              <select
                className="input w-full"
                value={formData.salesTaxCategoryId || ''}
                onChange={(e) => handleChange('salesTaxCategoryId', e.target.value)}
                disabled={saving}
              >
                <option value="">-- {tGlobal('selectNone')} --</option>
                {taxCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Tax Category
              </label>
              <select
                className="input w-full"
                value={formData.purchaseTaxCategoryId || ''}
                onChange={(e) => handleChange('purchaseTaxCategoryId', e.target.value)}
                disabled={saving}
              >
                <option value="">-- {tGlobal('selectNone')} --</option>
                {taxCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </SlideOver>
  );
}
