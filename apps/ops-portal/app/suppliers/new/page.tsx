'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiMutate, EntityHeader } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function NewSupplierPage() {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    vendorNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    address1Line1: '',
    address1City: '',
    address1Country: '',
    paymentTerms: 'NET30',
    currencyCode: 'EUR',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const supplier = await apiMutate<any>('/api/suppliers', 'POST', dto);
      toast.success(t('toast.supplierCreated'));
      router.push(`/suppliers/${supplier.vendorId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.vendorNumber.trim() !== '' && dto.name.trim() !== '';

  return (
    <Shell>
      <EntityHeader
        title={t('suppliers.buttons.createSupplier')}
        subtitle={t('suppliers.management')}
        onBack={() => router.push('/suppliers')}
        isSaving={submitting}
        isDirty={isValid}
        onSave={handleSubmit}
        saveLabel={t('suppliers.buttons.createSupplier')}
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
              {t('suppliers.generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('suppliers.columns.vendorNumber')} *
                </label>
                <input
                  id="vendorNumber"
                  type="text"
                  className="input"
                  value={dto.vendorNumber}
                  onChange={(e) => updateField('vendorNumber', e.target.value)}
                  placeholder="e.g. VEND-001"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('suppliers.columns.name')} *
                </label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. ACME Corp"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {t('suppliers.paymentCurrency')}
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
                    {t('suppliers.columns.paymentTerms')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.paymentTerms}
                    onChange={(e) => updateField('paymentTerms', e.target.value)}
                    placeholder="e.g. NET30"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Details Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {t('common.contactAddress')}
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
                placeholder="vendor@example.com"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.columns.telephone')}
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
          <input
            type="text"
            className="input"
            value={dto.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Key relationship details, preferred delivery methods, etc."
            disabled={submitting}
          />
        </div>
      </div>
    </Shell>
  );
}
