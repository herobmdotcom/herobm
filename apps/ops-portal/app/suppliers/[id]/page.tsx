/* eslint-disable i18next/no-literal-string */
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  apiFetch,
  apiMutate,
  reportError,
} from '@/lib/api';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  emailAddress1: string | null;
  telephone1: string | null;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string | null;
  paymentTerms: string | null;
  currencyCode: string;
  stateCode: string;
  notes: string | null;
  source: 'abm' | 'app';
  createdBy?: string | null;
  createdOn?: string | null;
  modifiedOn?: string | null;
  events?: any[];
}

export default function SupplierDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const t = useTranslations();
  const params = use(paramsPromise);
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable field state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCurrency, setEditCurrency] = useState('EUR');

  const loadSupplier = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch<Supplier>(`/api/suppliers/${params.id}`);
      setSupplier(data);
      setEditName(data.name || '');
      setEditEmail(data.emailAddress1 || '');
      setEditPhone(data.telephone1 || '');
      setEditStreet(data.address1Line1 || '');
      setEditCity(data.address1City || '');
      setEditCountry(data.address1Country || '');
      setEditPaymentTerms(data.paymentTerms || '');
      setEditNotes(data.notes || '');
      setEditCurrency(data.currencyCode || 'EUR');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToLoadOrder'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplier();
  }, [params.id]);

  /** Save a single field on blur if it changed */
  const saveField = async (field: string, value: string, original: string | null) => {
    if (value === (original || '')) return;
    if (supplier?.source === 'abm') return;
    setSaving(true);
    setError('');
    try {
      await apiMutate(`/api/suppliers/${params.id}`, 'PATCH', { [field]: value || null });
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToUpdateOrder'));
    } finally {
      setSaving(false);
    }
  };

  /** Toggle state code (active/inactive) */
  const toggleState = async () => {
    if (!supplier || supplier.source === 'abm' || saving) return;
    const newState = supplier.stateCode === 'active' ? 'inactive' : 'active';
    setSaving(true);
    setError('');
    try {
      await apiMutate(`/api/suppliers/${params.id}`, 'PATCH', { stateCode: newState });
      await loadSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToChangeState'));
    } finally {
      setSaving(false);
    }
  };

  const archiveSupplier = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await apiMutate(`/api/suppliers/${params.id}/archive`, 'POST');
      toast.success(t('toast.orderArchived'), { icon: '📦' });
      await loadSupplier(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveSupplier = async () => {
    setSaving(true);
    try {
      await apiMutate(`/api/suppliers/${params.id}/unarchive`, 'POST');
      toast.success(t('toast.orderUnarchived'), { icon: '📦' });
      await loadSupplier(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
        </div>
      </Shell>
    );
  }

  if (!supplier) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || t('common.noMatchingResults')}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/suppliers')}>
            ← {t('sidebar.items.suppliers')}
          </button>
        </div>
      </Shell>
    );
  }

  const isLegacy = supplier.source === 'abm';
  const isEditable = !isLegacy && supplier.stateCode !== 'archived';

  return (
    <Shell>
      <DetailsLayout
        header={
          <EntityHeader
            title={supplier.name}
            subtitle={`${supplier.vendorNumber} · ${supplier.source === 'app' ? t('common.sources.app') : t('common.sources.abm')}`}
            onBack={() => router.push('/suppliers')}
            isSaving={saving}
            badges={<StateBadge state={supplier.stateCode as ValidState} />}
            actions={
              supplier.source === 'app' ? (
                supplier.stateCode === 'archived' ? (
                  <button className="btn btn-secondary btn-sm" onClick={unarchiveSupplier} disabled={saving}>📦 {t('salesOrders.buttons.unarchive')}</button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={archiveSupplier}
                    disabled={saving}
                  >
                    📦 {t('salesOrders.buttons.archive')}
                  </button>
                )
              ) : null
            }
          />
        }
      >
      <div className="flex flex-col gap-6">

      {supplier.stateCode === 'archived' && (
        <div
          className="px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
          <button className="ml-3 text-xs underline" onClick={() => setError('')}>{t('common.dismiss')}</button>
        </div>
      )}

        {/* Top row: General Info (left) + Financials (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Info Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('suppliers.generalInfo')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.name')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => saveField('name', editName, supplier.name)}
                  disabled={!isEditable || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('suppliers.columns.vendorNumber')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={supplier.vendorNumber}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Financials Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('suppliers.financials')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.currency')}
                  </label>
                  <select
                    className="input"
                    value={editCurrency}
                    onChange={(e) => {
                      setEditCurrency(e.target.value);
                      saveField('currencyCode', e.target.value, supplier.currencyCode);
                    }}
                    disabled={!isEditable || saving}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('suppliers.paymentTerms')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={editPaymentTerms}
                    onChange={(e) => setEditPaymentTerms(e.target.value)}
                    onBlur={() => saveField('paymentTerms', editPaymentTerms, supplier.paymentTerms)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.status')}
                </label>
                <div
                  className="flex items-center gap-3"
                  style={{ paddingTop: 6, cursor: !isEditable || saving ? 'not-allowed' : 'pointer' }}
                  onClick={toggleState}
                >
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: supplier.stateCode === 'active' ? 'var(--accent)' : 'var(--border)',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                      opacity: !isEditable || saving ? 0.5 : 1,
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
                        left: supplier.stateCode === 'active' ? 21 : 3,
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <StateName state={supplier.stateCode as ValidState} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Card — full width */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('common.notesCardHeading')}
          </h3>
          <textarea
            className="input w-full"
            style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            onBlur={() => saveField('notes', editNotes, supplier.notes)}
            placeholder={t('common.notesCardPlaceholder')}
            disabled={!isEditable || saving}
          />
        </div>

        {/* Contact & Location Card — full width */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('suppliers.contactLocation')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                onBlur={() => saveField('emailAddress1', editEmail, supplier.emailAddress1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Phone
              </label>
              <input
                type="text"
                className="input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                onBlur={() => saveField('telephone1', editPhone, supplier.telephone1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.columns.address')}
              </label>
              <input
                type="text"
                className="input"
                value={editStreet}
                onChange={(e) => setEditStreet(e.target.value)}
                onBlur={() => saveField('address1Line1', editStreet, supplier.address1Line1)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                City
              </label>
              <input
                type="text"
                className="input"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                onBlur={() => saveField('address1City', editCity, supplier.address1City)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Country
              </label>
              <input
                type="text"
                className="input"
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                onBlur={() => saveField('address1Country', editCountry, supplier.address1Country)}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>

        {/* Record Details Card — full width */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('suppliers.recordDetails')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Vendor ID
              </label>
              <input className="input" disabled value={supplier.vendorId} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('common.columns.source')}
              </label>
              <input className="input" disabled value={supplier.source === 'abm' ? t('common.sources.abm') : t('common.sources.app')} />
            </div>
            {supplier.createdOn && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Created
                </label>
                <input className="input" disabled value={new Date(supplier.createdOn).toLocaleDateString()} />
              </div>
            )}
            {supplier.createdBy && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Created By
                </label>
                <input className="input" disabled value={supplier.createdBy} />
              </div>
            )}
          </div>
          {supplier.modifiedOn && (
            <div className="mt-4" style={{ maxWidth: '50%' }}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Last Modified
              </label>
              <input className="input" disabled value={new Date(supplier.modifiedOn).toLocaleString()} />
            </div>
          )}
          {isLegacy && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {t('common.legacyRecordImported')}
            </p>
          )}
        </div>

        {/* Activity Timeline — full width */}
        <ActivityTimeline events={supplier.events || []} />
      </div>
      </DetailsLayout>
    </Shell>
  );
}
