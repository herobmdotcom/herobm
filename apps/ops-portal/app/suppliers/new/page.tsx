'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as api from '@modbm/sdk';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import { CURRENCIES } from '@/lib/currency';
import GroupSelect from '@/components/shared/GroupSelect';
import { useSettings } from '@/components/SettingsProvider';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@modbm/shared';

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
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const res = await api.suppliersControllerCreate(dto as api.CreateSupplierDto);
      const supplier = res.data;
      toast.success(tCommon('toast.supplierCreated'));
      router.push(`/suppliers/${supplier.id}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
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
            {/* eslint-disable-next-line i18next/no-literal-string */}
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
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">payments</span>
            Financials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.businessNumber')}
                <FrontendEnrichmentDecorator
                  field="supplier.business_number"
                  country={dto.address1Country || ''}
                  value={dto.businessNumber}
                  isSaving={submitting}
                  onEnrich={(data) => {
                    if (data.name) updateField('name', data.name);
                    if (data.isTaxRegistered !== undefined) updateField('isTaxRegistered', data.isTaxRegistered);
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
              <label className="block text-xs font-medium mb-1.5 opacity-0" style={{ color: 'var(--text-muted)' }}>
                {t('fields.taxRegistered')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <div className="switch" title={dto.isTaxRegistered ? t('fields.taxRegistered') : tCommon('na')}>
                  <input
                    type="checkbox"
                    checked={dto.isTaxRegistered}
                    onChange={(e) => updateField('isTaxRegistered', e.target.checked)}
                    disabled={submitting}
                  />
                </div>
                <span className="text-sm font-medium">{t('fields.taxRegistered')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Contact Details Card */}
        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">location_on</span>
            {tCommon('columns.address')}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.email')}
                </label>
                <input
                  type="email"
                  className="input"
                  value={dto.emailAddress1}
                  onChange={(e) => updateField('emailAddress1', e.target.value)}
                  placeholder={t('placeholders.email')}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.telephone')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.telephone1}
                  onChange={(e) => updateField('telephone1', e.target.value)}
                  placeholder={t('placeholders.phone')}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.address')}
              </label>
              <input
                type="text"
                className="input"
                value={dto.address1Line1}
                onChange={(e) => updateField('address1Line1', e.target.value)}
                placeholder={t('placeholders.address')}
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.city')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.address1City}
                  onChange={(e) => updateField('address1City', e.target.value)}
                  placeholder={t('placeholders.city')}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details Card */}
        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">account_balance</span>
            Bank Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.bankAccountName')}
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.bankAccountName}
                onChange={(e) => updateField('bankAccountName', e.target.value)}
                placeholder="e.g. John Doe Pty Ltd"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                BSB
              </label>
              <input
                type="text"
                className="input"
                value={dto.bankBsb}
                onChange={(e) => updateField('bankBsb', e.target.value)}
                placeholder="e.g. 062-000"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('fields.accountNumber')}
              </label>
              <input
                type="text"
                className="input"
                value={dto.bankAccountNumber}
                onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                placeholder="e.g. 12345678"
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
