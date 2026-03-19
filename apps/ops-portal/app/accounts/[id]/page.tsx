'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  apiFetch,
  apiMutate,
  EntityHeader,
  ActivityTimeline,
  reportError,
} from '@/lib/api';

interface Account {
  accountId: string;
  accountNumber: string;
  name: string;
  emailAddress1: string | null;
  telephone1: string | null;
  fax: string | null;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  customerGroup: string | null;
  gstPosition: string | null;
  currencyCode: string;
  customerDiscount: string | null;
  stateCode: string;
  notes: string | null;
  source: 'abm' | 'app';
  events?: any[];
}

export default function AccountDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const t = useTranslations();
  const params = use(paramsPromise);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [dto, setDto] = useState<Partial<Account>>({});

  useEffect(() => {
    apiFetch<Account>(`/api/accounts/${params.id}`)
      .then((data) => {
        setAccount(data);
        setDto(data);
      })
      .catch((err) => reportError(err, 'AccountDetailPage'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateField = (field: keyof Account, value: any) => {
    if (account?.source === 'abm') return;
    setDto((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!isDirty || saving || account?.source === 'abm') return;
    setSaving(true);

    try {
      const updated = await apiMutate<Account>(
        `/api/accounts/${params.id}`,
        'PATCH',
        dto,
      );
      setAccount({ ...updated, source: 'app', events: account?.events });
      setDto({ ...updated, source: 'app', events: account?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh to get updated events
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archiveAccount = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${params.id}/archive`, 'POST');
      toast.success(t('toast.orderArchived'), { icon: '📦' });
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveAccount = async () => {
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${params.id}/unarchive`, 'POST');
      toast.success(t('toast.orderUnarchived'), { icon: '📦' });
      const refreshed = await apiFetch<Account>(`/api/accounts/${params.id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Shell><div className="p-8">{t('common.loading')}</div></Shell>;
  if (!account) return <Shell><div className="p-8">{t('common.noMatchingResults')}</div></Shell>;

  const isLegacy = account.source === 'abm';
  const isEditable = !isLegacy && account.stateCode !== 'archived';

  return (
    <Shell>
      <EntityHeader
        title={account.name}
        subtitle={`${account.accountNumber} • ${account.source === 'app' ? t('common.sources.app') : t('common.sources.abm')}`}
        onBack={() => router.push('/accounts')}
        isSaving={saving}
        isDirty={isDirty}
        onSave={handleSave}
        badges={
          <span className={`badge badge-${account.stateCode}`}>
            {t(`common.states.${account.stateCode}`)}
          </span>
        }
        actions={
          account.source === 'app' ? (
            account.stateCode === 'archived' ? (
              <button className="btn btn-secondary btn-sm" onClick={unarchiveAccount} disabled={saving}>📦 {t('salesOrders.buttons.unarchive')}</button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                onClick={archiveAccount}
                disabled={saving}
              >
                📦 {t('salesOrders.buttons.archive')}
              </button>
            )
          ) : null
        }
      />

      {account.stateCode === 'archived' && (
        <div
          className="mb-6 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309' }}
        >
          <span style={{ fontSize: '1.2rem' }}>📦</span>
          <div>
            <strong className="font-semibold text-amber-800">{t('salesOrders.archivedBannerTitle')}</strong> {t('salesOrders.archivedBannerBody')}
          </div>
        </div>
      )}

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="space-y-6 mb-8">
            {/* Basic Info Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('accounts.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.name')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('accounts.columns.accountNumber')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={account.accountNumber}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.customerGroup')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.customerGroup || ''}
                    onChange={(e) => updateField('customerGroup', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.gstPosition')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.gstPosition || ''}
                    onChange={(e) => updateField('gstPosition', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>

            {/* Primary Contact Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
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
                    value={dto.primaryContactName || ''}
                    onChange={(e) => updateField('primaryContactName', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactEmail')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.primaryContactEmail || ''}
                    onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactPhone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactPhone || ''}
                    onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>

            {/* Address & Contact Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('suppliers.contactAddress')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.email')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.emailAddress1 || ''}
                    onChange={(e) => updateField('emailAddress1', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.phone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.telephone1 || ''}
                    onChange={(e) => updateField('telephone1', e.target.value)}
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
                    value={dto.address1Line1 || ''}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.city')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1City || ''}
                    onChange={(e) => updateField('address1City', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.state')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1StateOrProvince || ''}
                    onChange={(e) => updateField('address1StateOrProvince', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.postalCode')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1PostalCode || ''}
                    onChange={(e) => updateField('address1PostalCode', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.country')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Country || ''}
                    onChange={(e) => updateField('address1Country', e.target.value)}
                    disabled={!isEditable || saving}
                  />
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('common.columns.notes')}
              </h3>
              <input
                type="text"
                className="input"
                value={dto.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t('common.placeholders.notes')}
                disabled={!isEditable || saving}
              />
            </div>

          {/* Record Details Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('common.columns.activityTimeline')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('accounts.columns.accountId')}
                </label>
                <input className="input" disabled value={account.accountId} style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.source')}
                </label>
                <input className="input" disabled value={account.source === 'abm' ? t('common.sources.abm') : t('common.sources.app')} />
              </div>
              {(account as any).createdOn && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.createdOn')}
                  </label>
                  <input className="input" disabled value={new Date((account as any).createdOn).toLocaleDateString()} />
                </div>
              )}
              {(account as any).createdBy && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.createdBy')}
                  </label>
                  <input className="input" disabled value={(account as any).createdBy} />
                </div>
              )}
            </div>
            {(account as any).modifiedOn && (
              <div className="mt-4" style={{ maxWidth: '50%' }}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.modifiedOn')}
                </label>
                <input className="input" disabled value={new Date((account as any).modifiedOn).toLocaleString()} />
              </div>
            )}
            {isLegacy && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                {t('common.legacyRecordImported')}
              </p>
            )}
          </div>

          {/* Pricing & Currency Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('accounts.pricingCurrency')}
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
                  disabled={!isEditable || saving}
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
                  value={dto.customerDiscount || '0'}
                  onChange={(e) => updateField('customerDiscount', e.target.value)}
                  disabled={!isEditable || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('common.columns.state')}
                </label>
                <div
                  className="flex items-center gap-3"
                  style={{ paddingTop: 6, cursor: !isEditable || saving ? 'not-allowed' : 'pointer' }}
                  onClick={() => {
                    if (!isEditable || saving) return;
                    updateField('stateCode', dto.stateCode === 'active' ? 'inactive' : 'active');
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: dto.stateCode === 'active' ? 'var(--accent)' : 'var(--border)',
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
                        left: dto.stateCode === 'active' ? 21 : 3,
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t(`common.states.${dto.stateCode}`)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <ActivityTimeline events={account.events || []} />

        </div>
      </div>
    </Shell>
  );
}
