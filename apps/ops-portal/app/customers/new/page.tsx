'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { apiMutate, apiFetch } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import { CURRENCIES } from '@/lib/currency';
import GroupSelect from '@/components/shared/GroupSelect';
import CustomerSelect from '@/components/shared/CustomerSelect';

export default function NewAccountPage() {
  useDocumentTitle('New Customer');
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    customerNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    address1Line1: '',
    address1Line2: '',
    address1City: '',
    address1StateOrProvince: '',
    address1PostalCode: '',
    address1Country: '',
    customerGroupId: '',
    taxCategoryId: '',
    currencyCode: 'EUR',
    customerDiscount: '0',
    notes: '',
    parentCustomerId: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
  });
  const [taxCategories, settaxCategories] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<any[]>('/api/tax-categories').then(settaxCategories).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const customer = await apiMutate<any>('/api/customers', 'POST', dto);
      toast.success(t('toast.accountCreated'));
      router.push(`/customers/${customer.customerId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
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
                  {submitting ? t('common.saving') : `+ ${t('customers.buttons.createCustomer')}`}
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">info</span>
                {t('customers.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                      {t('common.columns.taxPosition')}
                    </label>
                    <select
                      className="input"
                      value={dto.taxCategoryId || ''}
                      onChange={(e) => updateField('taxCategoryId', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">{t('common.options.none')}</option>
                      {taxCategories.map((cat) => (
                        <option key={cat.taxCategoryId} value={cat.taxCategoryId}>
                          {cat.title} ({cat.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Parent Customer
                    </label>
                    <CustomerSelect
                      value={dto.parentCustomerId || null}
                      onChange={(val) => updateField('parentCustomerId', val?.customerId || '')}
                      disabled={submitting}
                      excludeId={null}
                    />
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">payments</span>
                {t('customers.pricingCurrency')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.currency')}
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
              </div>
            </div>

            {/* Address Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">location_on</span>
                {t('customers.company')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.email')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.emailAddress1}
                    onChange={(e) => updateField('emailAddress1', e.target.value)}
                    placeholder="customers@acme.com"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.phone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.telephone1}
                    onChange={(e) => updateField('telephone1', e.target.value)}
                    placeholder="+1 234 567 890"
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    placeholder="123 Main St"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.city')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1City}
                    onChange={(e) => updateField('address1City', e.target.value)}
                    placeholder="City"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.state')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1StateOrProvince}
                    onChange={(e) => updateField('address1StateOrProvince', e.target.value)}
                    placeholder="State"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.postalCode')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1PostalCode}
                    onChange={(e) => updateField('address1PostalCode', e.target.value)}
                    placeholder="12345"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.country')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Country}
                    onChange={(e) => updateField('address1Country', e.target.value)}
                    placeholder="Country"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Primary Contact Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">person</span>
                {t('common.columns.contact')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactName}
                    onChange={(e) => updateField('primaryContactName', e.target.value)}
                    placeholder="John Smith"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactEmail')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.primaryContactEmail}
                    onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                    placeholder="john@acme.com"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactPhone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactPhone}
                    onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                    placeholder="+1 234 567 890"
                    disabled={submitting}
                  />
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
                    Bank Account Name
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
                    Account Number
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
