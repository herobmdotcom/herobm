'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { apiMutate } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import { CURRENCIES, HOME_CURRENCY } from '@/lib/currency';
import GroupSelect from '@/components/shared/GroupSelect';

export default function NewSupplierPage() {
  const t = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('new.documentTitle'));
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
    currencyCode: '',
    supplierGroupId: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const supplier = await apiMutate<any>('/api/suppliers', 'POST', dto);
      toast.success(tCommon('toast.supplierCreated'));
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
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">info</span>
                {t('generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {tCommon('columns.currency')}
                    </label>
                    <select
                      className="input"
                      value={dto.currencyCode}
                      onChange={(e) => updateField('currencyCode', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="" disabled>Select Currency</option>
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
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

            {/* Notes Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">notes</span>
                {tCommon('notesCardHeading')}
              </h3>
              <textarea
                className="input w-full"
                style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
                value={dto.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={tCommon('notesCardPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-3">
            {/* Contact Details Card */}
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">location_on</span>
                {tCommon('columns.address')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {tCommon('columns.country')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.address1Country}
                      onChange={(e) => updateField('address1Country', e.target.value)}
                      placeholder={t('placeholders.country')}
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
