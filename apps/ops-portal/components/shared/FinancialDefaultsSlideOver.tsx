/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */
'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from './SlideOver';
import { Button } from './Button';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from './InheritedSelect';

export type GroupType = 'customer' | 'supplier' | 'product';

interface Option {
  value: string;
  label: string;
}

export type FinancialDefaultsGroupData = {
  stateCode?: string | null;
  isOnCreditHold?: boolean | null;
  creditLimit?: string | null;
  defaultArAccountId?: string | null;
  earlyPaymentDiscount?: number | string | null;
  earlyPaymentDiscountDays?: number | string | null;
  defaultApAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
  defaultExpenseAccountId?: string | null;
  defaultCostCenterId?: string | null;
  defaultActivityId?: string | null;
  purchaseTaxCategoryId?: string | null;
  salesTaxCategoryId?: string | null;
  tradingTermsId?: string | null;
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
  tradingTermsOptions?: Option[];
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
  taxCategoryOptions = [],
  tradingTermsOptions = []
}: FinancialDefaultsSlideOverProps<T>) {
  const tc = useTranslations('admin.common');
  const tCommon = useTranslations('common');
  const tSuppliers = useTranslations('suppliers');
  const tCustomers = useTranslations('customers');

  const [formData, setFormData] = useState<T>({ ...data } as T);
  const [saving, setSaving] = useState(false);
  const { app, gl } = useSettings();

  const inheritedTaxPositionId = groupType === 'customer' ? app?.defaultCustomerTaxPositionId : app?.defaultSupplierTaxPositionId;
  const inheritedTradingTermsId = groupType === 'customer' ? app?.defaultCustomerTermsId : app?.defaultSupplierTermsId;

  useEffect(() => {
    if (isOpen && data) {
      setFormData({ ...data } as T);
    }
  }, [isOpen, data]);

  const handleChange = (field: keyof FinancialDefaultsGroupData, value: string | boolean | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value } as T));
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col">
        {/* OPERATIONAL SECTION */}
        <h3 className="mb-4 text-[var(--text-muted)] uppercase tracking-wider text-sm font-semibold">Operational</h3>
        
        <div className="flex flex-col gap-4 mb-6">


          {/* Credit Hold (Customer) */}
          {groupType === 'customer' && (
            <div className="flex items-center justify-between mt-2">
              <label className="block text-sm font-medium text-gray-700">
                Credit Hold
              </label>
              <div
                className={`flex items-center gap-3 ${saving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (saving) return;
                  handleChange('isOnCreditHold', !formData.isOnCreditHold);
                }}
              >
                <div
                  className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${saving ? 'opacity-50' : ''} ${!formData.isOnCreditHold ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-[left] duration-200 ${!formData.isOnCreditHold ? 'left-[21px]' : 'left-[3px]'}`}
                  />
                </div>
                <span className={`text-sm font-semibold ${!formData.isOnCreditHold ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {!formData.isOnCreditHold ? tSuppliers('compliance.noBlock') : tSuppliers('compliance.blocked')}
                </span>
              </div>
            </div>
          )}

          {/* Credit Limit (Customer) */}
          {groupType === 'customer' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tCustomers('fields.creditLimit')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input text-sm w-full"
                value={formData.creditLimit ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange('creditLimit', val === '' ? null : val);
                }}
                disabled={saving}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Purchasing Block & Payment Block (Supplier) */}
          {groupType === 'supplier' && (
            <>
              <div className="flex items-center justify-between mt-2">
                <label className="block text-sm font-medium text-gray-700">
                  Purchasing Block
                </label>
                <div
                  className={`flex items-center gap-3 ${saving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => {
                    if (saving) return;
                    handleChange('isPurchasingBlocked', !formData.isPurchasingBlocked);
                  }}
                >
                  <div
                    className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${saving ? 'opacity-50' : ''} ${!formData.isPurchasingBlocked ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-[left] duration-200 ${!formData.isPurchasingBlocked ? 'left-[21px]' : 'left-[3px]'}`}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${!formData.isPurchasingBlocked ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {!formData.isPurchasingBlocked ? tSuppliers('compliance.noBlock') : tSuppliers('compliance.blocked')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payment Block
                </label>
                <div
                  className={`flex items-center gap-3 ${saving ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => {
                    if (saving) return;
                    handleChange('isPaymentBlocked', !formData.isPaymentBlocked);
                  }}
                >
                  <div
                    className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${saving ? 'opacity-50' : ''} ${!formData.isPaymentBlocked ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-[3px] transition-[left] duration-200 ${!formData.isPaymentBlocked ? 'left-[21px]' : 'left-[3px]'}`}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${!formData.isPaymentBlocked ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {!formData.isPaymentBlocked ? tSuppliers('compliance.noBlock') : tSuppliers('compliance.blocked')}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Tax Position (Customer & Supplier) */}
          {(groupType === 'customer' || groupType === 'supplier') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                {tCommon('columns.taxPosition')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.taxPositionId as string) || ''}
                onChange={(val) => handleChange('taxPositionId', val)}
                disabled={saving}
                options={taxPositionOptions || []}
                inheritedValue={inheritedTaxPositionId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          {/* Trading Terms (Customer & Supplier) */}
          {(groupType === 'customer' || groupType === 'supplier') && tradingTermsOptions && tradingTermsOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                {tCommon('tradingTerms')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.tradingTermsId as string) || ''}
                onChange={(val) => handleChange('tradingTermsId', val)}
                disabled={saving}
                options={tradingTermsOptions || []}
                inheritedValue={inheritedTradingTermsId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          {/* Early Payment Discount */}
          {(groupType === 'supplier' || groupType === 'customer') && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <span className="text-sm font-medium text-[var(--text-muted)]">
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none text-sm">days</span>
                </div>
              </div>
            </div>
          )}

          {/* Tax Categories (Product) */}
          {groupType === 'product' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                  Sales Tax Category
                </label>
                <select
                  className="input w-full"
                  value={(formData.salesTaxCategoryId as string) || ''}
                  onChange={(e) => handleChange('salesTaxCategoryId', e.target.value)}
                  disabled={saving}
                >
                  <option value="">-- {tCommon('selectNone')} --</option>
                  {taxCategoryOptions?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                  Purchase Tax Category
                </label>
                <select
                  className="input w-full"
                  value={(formData.purchaseTaxCategoryId as string) || ''}
                  onChange={(e) => handleChange('purchaseTaxCategoryId', e.target.value)}
                  disabled={saving}
                >
                  <option value="">-- {tCommon('selectNone')} --</option>
                  {taxCategoryOptions?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* GENERAL LEDGER SECTION */}
        <h3 className="mb-4 mt-6 text-[var(--text-muted)] uppercase tracking-wider text-sm font-semibold">General Ledger</h3>
        <div className="flex flex-col gap-4">
          {groupType === 'customer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc('defArAccount')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.defaultArAccountId as string) || ''}
                onChange={(val) => handleChange('defaultArAccountId', val)}
                disabled={saving}
                options={glAccountOptions}
                inheritedValue={gl?.defaultArAccountId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          {groupType === 'supplier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc('defApAccount')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.defaultApAccountId as string) || ''}
                onChange={(val) => handleChange('defaultApAccountId', val)}
                disabled={saving}
                options={glAccountOptions}
                inheritedValue={gl?.defaultApAccountId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          {(groupType === 'customer' || groupType === 'product') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc('defRevAccount')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.defaultRevenueAccountId as string) || ''}
                onChange={(val) => handleChange('defaultRevenueAccountId', val)}
                disabled={saving}
                options={glAccountOptions}
                inheritedValue={gl?.defaultRevenueAccountId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          {(groupType === 'supplier' || groupType === 'product') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc('defExpenseAccount')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={(formData.defaultExpenseAccountId as string) || ''}
                onChange={(val) => handleChange('defaultExpenseAccountId', val)}
                disabled={saving}
                options={glAccountOptions}
                inheritedValue={gl?.defaultExpenseAccountId}
                inheritedSourceLabel="System Default"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc('defCostCenter')}
            </label>
            <InheritedSelect
              className="input w-full"
              value={(formData.defaultCostCenterId as string) || ''}
              onChange={(val) => handleChange('defaultCostCenterId', val)}
              disabled={saving}
              options={costCenterOptions}
              inheritedValue={gl?.defaultCostCenterId}
              inheritedSourceLabel="System Default"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc('defActivity')}
            </label>
            <InheritedSelect
              className="input w-full"
              value={(formData.defaultActivityId as string) || ''}
              onChange={(val) => handleChange('defaultActivityId', val)}
              disabled={saving}
              options={activityOptions}
              inheritedValue={gl?.defaultActivityId}
              inheritedSourceLabel="System Default"
            />
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
