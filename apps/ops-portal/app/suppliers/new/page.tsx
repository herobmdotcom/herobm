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
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';

export default function NewSupplierPage() {
  const { baseCurrency, organization } = useSettings();
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
    paymentTerms: 'NET30',
    currencyCode: defaultCurrency,
    supplierGroupId: '',
    notes: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
    businessNumber: '',
    isTaxRegistered: false,
    taxPositionId: '',
  });

  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const res = await api.suppliersControllerCreate(dto as api.CreateSupplierDto);
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
            
            {/* Empty slots to match the layout of the details page */}
            <div className="hidden md:block"></div>
            <div className="hidden md:block"></div>

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
              <select
                className="input"
                value={dto.taxPositionId || ''}
                onChange={(e) => updateField('taxPositionId', e.target.value)}
                disabled={submitting}
              >
                <option value="">{tCommon('options.none')}</option>
                {taxPositions.map((pos) => (
                  <option key={pos.taxPositionId} value={pos.taxPositionId}>
                    {pos.title}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Row 3 ── */}
            {/* 7. Payment Terms */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.paymentTerms')}
              </label>
              <input
                type="text"
                className="input"
                value={dto.paymentTerms}
                onChange={(e) => updateField('paymentTerms', e.target.value)}
                placeholder={t('placeholders.paymentTerms')}
                disabled={submitting}
              />
            </div>
          </div>
        </div>
      </div>
      </DetailsLayout>
    </>
  );

}
