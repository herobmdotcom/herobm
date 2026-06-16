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
import CustomerSelect from '@/components/shared/CustomerSelect';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';
import { useSettings } from '@/components/SettingsProvider';

export default function NewAccountPage() {
  useDocumentTitle('New Customer');
  const t = useTranslations();
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const { baseCurrency, organization } = useSettings();
  
  const defaultCountry = organization?.country || '';
  const defaultCurrency = getCurrencyForCountry(defaultCountry) || baseCurrency || 'EUR';

  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    customerNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    billingAddressCountry: defaultCountry,
    customerGroupId: '',
    taxPositionId: '',
    currencyCode: defaultCurrency,
    customerDiscount: '0',
    notes: '',
    parentCustomerId: '',
    businessNumber: '',
    isTaxRegistered: false,
  });
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const res = await api.accountsControllerCreate(dto);
      const customer = res.data;
      toast.success(t('toast.accountCreated'));
      router.push(`/customers/${customer.customerId}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.customerNumber.trim() !== '' && dto.name.trim() !== '';

  
  
  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={t('customers.buttons.createCustomer')}
            onBack={() => router.push('/customers')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/customers')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting ? t('common.saving') : t('customers.buttons.createCustomer')}
                </button>
              </>
            }
            showPrint={false}
          />
        }
      >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
            {/* General Info Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                <span className="material-symbols-outlined">info</span>
                {t('customers.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.columns.customerNumber')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.customerNumber}
                      onChange={(e) => updateField('customerNumber', e.target.value)}
                      placeholder="e.g. ACME-001"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.name')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.placeholders.customerGroup')}
                    </label>
                    <GroupSelect
                      type="customer"
                      value={dto.customerGroupId || null}
                      onChange={(val) => updateField('customerGroupId', val || '')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.fields.parentCustomer')}
                    </label>
                    <CustomerSelect
                      value={dto.parentCustomerId || null}
                      onChange={(val) => updateField('parentCustomerId', val?.customerId || '')}
                      disabled={submitting}
                      excludeId={null}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.country')} *
                    </label>
                    <select
                      className="input"
                      value={dto.billingAddressCountry}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateField('billingAddressCountry', val);
                        const newCurrency = getCurrencyForCountry(val);
                        if (newCurrency) {
                          updateField('currencyCode', newCurrency);
                        }
                      }}
                      disabled={submitting}
                    >
                      <option value="">{t('common.notConfigured')}</option>
                      {COUNTRIES.map((c: { code: string; name: string }) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.notesCardHeading')}
                    </label>
                    <input
                      type="text"
                      className="input w-full"
                      value={dto.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder={t('common.notesCardPlaceholder')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Currency Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">payments</span>
              FINANCIALS
            </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.currency')} *
                  </label>
                  <select
                    className="input"
                    value={dto.currencyCode}
                    onChange={(e) => updateField('currencyCode', e.target.value)}
                    disabled={submitting}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.columns.discountPct')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="input"
                    value={dto.customerDiscount || '0'}
                    onChange={(e) => updateField('customerDiscount', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.taxPosition')}
                  </label>
                  <select
                    className="input"
                    value={dto.taxPositionId || ''}
                    onChange={(e) => updateField('taxPositionId', e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">{t('common.options.none')}</option>
                    {taxPositions.map((pos) => (
                      <option key={pos.taxPositionId} value={pos.taxPositionId}>
                        {pos.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.fields.businessNumber')}
                    <FrontendEnrichmentDecorator
                      field="customer.business_number"
                      country={dto.billingAddressCountry || ''}
                      value={dto.businessNumber}
                      isSaving={submitting}
                      onEnrich={(data) => {
                        if (data.name && data.name !== dto.name) {
                          updateField('name', data.name);
                          toast.success(t('enrichment.nameUpdated'));
                        }
                        if (data.isTaxRegistered !== undefined && data.isTaxRegistered !== dto.isTaxRegistered) {
                          updateField('isTaxRegistered', data.isTaxRegistered);
                          toast.success(t('enrichment.taxUpdated'));
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
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.fields.taxRegistered')}
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
              </div>
            </div>
      </div>
      </DetailsLayout>
    </>
  );

}
