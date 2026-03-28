'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { apiMutate } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import GroupSelect from '@/components/shared/GroupSelect';

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
    supplierGroupId: '',
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
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={t('suppliers.buttons.createSupplier')}
            subtitle={t('suppliers.management')}
            onBack={() => router.push('/suppliers')}
            isSaving={submitting}
            isDirty={isValid}
            onSave={handleSubmit}
            saveLabel={t('suppliers.buttons.createSupplier')}
          />
        }
      >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start mb-6">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-3">
            {/* General Info Card */}
            <div className="card">
              <h3 className="section-heading">
                <span className="material-symbols-outlined">info</span>
                {t('suppliers.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.vendorNumber')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.vendorNumber}
                      onChange={(e) => updateField('vendorNumber', e.target.value)}
                      placeholder={t('suppliers.placeholders.vendorNumber')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.name')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder={t('suppliers.placeholders.name')}
                      disabled={submitting}
                    />
                  </div>
                </div>
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
                      Supplier Group
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
                      {t('suppliers.columns.paymentTerms')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.paymentTerms}
                      onChange={(e) => updateField('paymentTerms', e.target.value)}
                      placeholder={t('suppliers.placeholders.paymentTerms')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card">
              <h3 className="section-heading">
                <span className="material-symbols-outlined">notes</span>
                {t('common.notesCardHeading')}
              </h3>
              <textarea
                className="input w-full"
                style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
                value={dto.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t('common.notesCardPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-3">
            {/* Contact Details Card */}
            <div className="card">
              <h3 className="section-heading">
                <span className="material-symbols-outlined">location_on</span>
                {t('common.columns.address')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
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
                      placeholder={t('suppliers.placeholders.email')}
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
                      placeholder={t('suppliers.placeholders.phone')}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    placeholder={t('suppliers.placeholders.address')}
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.city')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.address1City}
                      onChange={(e) => updateField('address1City', e.target.value)}
                      placeholder={t('suppliers.placeholders.city')}
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
                      placeholder={t('suppliers.placeholders.country')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DetailsLayout>
    </>
  );

}
