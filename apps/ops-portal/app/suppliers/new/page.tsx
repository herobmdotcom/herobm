'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import { CURRENCIES } from '@/lib/currency';
import GroupSelect from '@/components/shared/GroupSelect';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from '@/components/shared/InheritedSelect';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useGroup, useInheritance } from '@/hooks/useInheritance';

export default function NewSupplierPage() {
  const { baseCurrency, organization, app } = useSettings();
  const t = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('new.documentTitle'));
  const router = useRouter();

  const defaultCountry = organization?.country || '';
  const defaultCurrency = getCurrencyForCountry(defaultCountry) || baseCurrency || 'EUR';

  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    vendorNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    address1Line1: '',
    address1City: '',
    address1Country: defaultCountry,
    currencyCode: defaultCurrency,
    supplierGroupId: '',
    notes: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
    businessNumber: '',
    isTaxRegistered: false,
    taxPositionId: '',
    tradingTermsId: '',
    earlyPaymentDiscount: '',
    earlyPaymentDiscountDays: '',
    creditLimit: '',
    isPurchasingBlocked: null as boolean | null,
    isPaymentBlocked: null as boolean | null,
  });

  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [supplierGroups, setSupplierGroups] = useState<api.SupplierGroupResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
    api.supplierGroupsControllerFindAll().then((res: unknown) => setSupplierGroups((res as { data: unknown[] }).data as unknown as api.SupplierGroupResponseDto[])).catch(console.error);
    api.tradingTermsControllerFindAll().then((res: unknown) => setTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[])).catch(console.error);
  }, []);
  const selectedGroup = useGroup(supplierGroups, dto.supplierGroupId);

  const earlyPaymentDiscountInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscount, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const earlyPaymentDiscountDaysInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscountDays, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const creditLimitInheritance = useInheritance([
    { value: selectedGroup?.creditLimit, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const taxPositionInheritance = useInheritance([
    { value: selectedGroup?.taxPositionId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTaxPositionId, sourceLabel: 'System Default' }
  ]);

  const tradingTermsInheritance = useInheritance([
    { value: selectedGroup?.tradingTermsId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTermsId, sourceLabel: 'System Default' }
  ]);

  const purchasingBlockInheritance = useInheritance([
    { value: selectedGroup?.isPurchasingBlocked === true ? 'true' : selectedGroup?.isPurchasingBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const paymentBlockInheritance = useInheritance([
    { value: selectedGroup?.isPaymentBlocked === true ? 'true' : selectedGroup?.isPaymentBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (!payload.purchaseTaxCategoryId) delete payload.purchaseTaxCategoryId;
      if (!payload.salesTaxCategoryId) delete payload.salesTaxCategoryId;
      if (!payload.productGroupId) delete payload.productGroupId;
      if (payload.earlyPaymentDiscountDays) {
        payload.earlyPaymentDiscountDays = Number(payload.earlyPaymentDiscountDays);
      } else {
        delete payload.earlyPaymentDiscountDays;
      }
      if (payload.isPurchasingBlocked === null) delete payload.isPurchasingBlocked;
      if (payload.isPaymentBlocked === null) delete payload.isPaymentBlocked;

      const res = await api.suppliersControllerCreate(payload as unknown as api.CreateSupplierDto);
      const supplier = res.data;
      toast.success(tCommon('toast.supplierCreated'));
      router.push(`/suppliers/${(supplier as { vendorId?: string; id?: string }).vendorId || (supplier as { vendorId?: string; id?: string }).id}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.vendorNumber.trim() !== '' && dto.name.trim() !== '' && dto.currencyCode !== '';
  
  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={t('buttons.createSupplier')}
            subtitle={t('management')}
            onBack={() => router.push('/suppliers')}
            isSaving={submitting}
            isDirty={isValid}
            onSave={handleSubmit}
            saveLabel={t('buttons.createSupplier')}
            showPrint={false}
          />
        }
      >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
        {/* General Info Card */}
        <div className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">info</span>
            {t('generalInfo')}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('columns.vendorNumber')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.vendorNumber}
                  onChange={(e) => updateField('vendorNumber', e.target.value)}
                  placeholder={t('placeholders.vendorNumber')}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('columns.name')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder={t('placeholders.name')}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('supplierGroup')}
                </label>
                <GroupSelect
                  type="supplier"
                  value={dto.supplierGroupId || null}
                  onChange={(val) => updateField('supplierGroupId', val || '')}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.country')} *
                </label>
                <select
                  className="input"
                  value={dto.address1Country}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('address1Country', val);
                    const newCurrency = getCurrencyForCountry(val);
                    if (newCurrency) {
                      updateField('currencyCode', newCurrency);
                    }
                  }}
                  disabled={submitting}
                >
                  <option value="">{tCommon('notConfigured')}</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('notesCardHeading')}
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={dto.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={tCommon('notesCardPlaceholder')}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financials Card */}
        <div className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">payments</span>
            FINANCIALS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ── Row 1 ── */}
            {/* 1. Currency */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.currency')} *
              </label>
              <select
                className="input"
                value={dto.currencyCode}
                onChange={(e) => updateField('currencyCode', e.target.value)}
                disabled={submitting}
              >
                <option value="" disabled>{t('fields.selectCurrency')}</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            {/* 3. Early Payment Discount */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('earlyPaymentDiscount')}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-8"
                    value={dto.earlyPaymentDiscount}
                    onChange={(val) => updateField('earlyPaymentDiscount', val)}
                    disabled={submitting}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    inheritedValue={earlyPaymentDiscountInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountInheritance.inheritedSourceLabel}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                {/* eslint-disable-next-line i18next/no-literal-string -- The word 'in' is not translatable here */}
                <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
                  in
                </span>
                <div className="relative w-32 shrink-0">
                  <InheritedNumberInput
                    className="input w-full pr-12"
                    value={dto.earlyPaymentDiscountDays}
                    onChange={(val) => updateField('earlyPaymentDiscountDays', val)}
                    disabled={submitting}
                    step="1"
                    min="0"
                    placeholder="10"
                    inheritedValue={earlyPaymentDiscountDaysInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountDaysInheritance.inheritedSourceLabel}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none text-sm">{tCommon('units.days')}</span>
                </div>
                {!!earlyPaymentDiscountInheritance.inheritedSourceLabel && !!earlyPaymentDiscountDaysInheritance.inheritedSourceLabel && (
                  <span className="text-xs italic text-[var(--primary)] ml-2 flex-shrink-0">
                    {tCommon('options.inheritValue', { 
                      label: `${earlyPaymentDiscountInheritance.inheritedValue}% in ${earlyPaymentDiscountDaysInheritance.inheritedValue} days`,
                      source: earlyPaymentDiscountInheritance.inheritedSourceLabel || ''
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* ── Row 2 ── */}
            {/* 4. Business Number */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.businessNumber')}
                <FrontendEnrichmentDecorator
                  field="supplier.business_number"
                  country={dto.address1Country || ''}
                  value={dto.businessNumber}
                  isSaving={submitting}
                  onEnrich={(data) => {
                    if (data.name && data.name !== dto.name) {
                      updateField('name', data.name);
                      toast.success(tCommon('enrichment.nameUpdated'));
                    }
                    if (data.isTaxRegistered !== undefined && data.isTaxRegistered !== dto.isTaxRegistered) {
                      updateField('isTaxRegistered', data.isTaxRegistered);
                      toast.success(tCommon('enrichment.taxUpdated'));
                    }
                  }}
                />
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.businessNumber}
                onChange={(e) => updateField('businessNumber', e.target.value)}
                disabled={submitting}
                placeholder="Enter business number..."
              />
            </div>

            {/* 5. Tax Registered */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.taxRegistered')}
              </label>
              <div
                className="flex items-center gap-3"
                style={{ paddingTop: 6, cursor: submitting ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (submitting) return;
                  updateField('isTaxRegistered', !dto.isTaxRegistered);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: dto.isTaxRegistered ? 'var(--accent)' : 'var(--border)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: dto.isTaxRegistered ? 21 : 3,
                      transition: 'left 0.2s ease',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {dto.isTaxRegistered ? tCommon('yes') : tCommon('no')}
                </span>
              </div>
            </div>

            {/* 6. Tax Position */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.taxPosition')}
              </label>
              <InheritedSelect
                className="input"
                value={dto.taxPositionId || ''}
                onChange={(val) => updateField('taxPositionId', val)}
                disabled={submitting}
                options={taxPositions.map((pos) => ({
                  value: pos.taxPositionId,
                  label: pos.title,
                }))}
                inheritedValue={taxPositionInheritance.inheritedValue}
                inheritedSourceLabel={taxPositionInheritance.inheritedSourceLabel}
              />
            </div>

            {/* 7. Trading Terms */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Trading Terms
              </label>
              <InheritedSelect
                className="input"
                value={dto.tradingTermsId || ''}
                onChange={(val) => updateField('tradingTermsId', val)}
                disabled={submitting}
                options={tradingTerms.map((term) => ({
                  value: term.id,
                  label: term.description,
                }))}
                inheritedValue={tradingTermsInheritance.inheritedValue}
                inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
              />
            </div>

            {/* 8. Credit Limit */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Credit Limit
              </label>
              <div className="flex items-center gap-3">
                <InheritedNumberInput
                  step="0.01"
                  className="input w-full max-w-xs"
                  value={dto.creditLimit || ""}
                  onChange={(val) => updateField("creditLimit", val)}
                  disabled={submitting}
                  placeholder="0.00"
                  inheritedValue={creditLimitInheritance.inheritedValue}
                  inheritedSourceLabel={creditLimitInheritance.inheritedSourceLabel}
                />
                {!!creditLimitInheritance.inheritedSourceLabel && (
                  <span className="text-xs italic text-[var(--primary)] ml-2 flex-shrink-0">
                    {tCommon('options.inheritValue', {
                      label: creditLimitInheritance.inheritedValue || '',
                      source: creditLimitInheritance.inheritedSourceLabel || ''
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* 9. Purchasing Blocked */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Purchasing Blocked
              </label>
              <InheritedSelect
                className="input"
                disabled={submitting}
                value={dto.isPurchasingBlocked === true ? 'true' : dto.isPurchasingBlocked === false ? 'false' : ''}
                onChange={(val) => {
                  const boolVal = val === 'true' ? true : val === 'false' ? false : null;
                  updateField("isPurchasingBlocked", boolVal);
                }}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' }
                ]}
                inheritedValue={purchasingBlockInheritance.inheritedValue}
                inheritedSourceLabel={purchasingBlockInheritance.inheritedSourceLabel}
              />
            </div>

            {/* 10. Payment Blocked */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Payment Blocked
              </label>
              <InheritedSelect
                className="input"
                disabled={submitting}
                value={dto.isPaymentBlocked === true ? 'true' : dto.isPaymentBlocked === false ? 'false' : ''}
                onChange={(val) => {
                  const boolVal = val === 'true' ? true : val === 'false' ? false : null;
                  updateField("isPaymentBlocked", boolVal);
                }}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' }
                ]}
                inheritedValue={paymentBlockInheritance.inheritedValue}
                inheritedSourceLabel={paymentBlockInheritance.inheritedSourceLabel}
              />
            </div>
          </div>
        </div>
      </div>
      </DetailsLayout>
    </>
  );

}
