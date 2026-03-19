'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiMutate, EntityHeader } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function NewAccountPage() {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    accountNumber: '',
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
    customerGroup: '',
    gstPosition: '',
    currencyCode: 'EUR',
    customerDiscount: '0',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const account = await apiMutate<any>('/api/accounts', 'POST', dto);
      toast.success(t('toast.accountCreated'));
      router.push(`/accounts/${account.accountId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.accountNumber.trim() !== '' && dto.name.trim() !== '';

  return (
    <Shell>
      <EntityHeader
        title={t('accounts.buttons.createAccount')}
        subtitle={t('accounts.customerManagement')}
        onBack={() => router.push('/accounts')}
        isSaving={submitting}
        isDirty={isValid}
        onSave={handleSubmit}
        saveLabel={t('accounts.buttons.createAccount')}
      />

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* General Information Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('accounts.generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('accounts.columns.accountNumber')} *
                </label>
                <input
                  id="accountNumber"
                  type="text"
                  className="input"
                  value={dto.accountNumber}
                  onChange={(e) => updateField('accountNumber', e.target.value)}
                  placeholder="e.g. ACME-001"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.name')} *
                </label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.customerGroup')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.customerGroup}
                    onChange={(e) => updateField('customerGroup', e.target.value)}
                    placeholder="e.g. Wholesale"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.gstPosition')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.gstPosition}
                    onChange={(e) => updateField('gstPosition', e.target.value)}
                    placeholder="e.g. Standard"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Currency & Discount Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('accounts.pricingCurrency')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
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
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('accounts.columns.discountPct')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="input"
                    value={dto.customerDiscount}
                    onChange={(e) => updateField('customerDiscount', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Contact Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('common.columns.contact')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Address Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('common.columns.address')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.columns.email')}
              </label>
              <input
                type="email"
                className="input"
                value={dto.emailAddress1}
                onChange={(e) => updateField('emailAddress1', e.target.value)}
                placeholder="accounts@acme.com"
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
            <div className="md:col-span-2">
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

        {/* Notes Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('common.columns.notes')}
          </h3>
          <textarea
            className="textarea h-32"
            value={dto.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Key relationship details, payment terms, etc."
            disabled={submitting}
          />
        </div>
      </div>
    </Shell>
  );
}
