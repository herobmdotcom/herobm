'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
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
      toast.success('Account updated');
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

  if (loading) return <Shell><div className="p-8">Loading account...</div></Shell>;
  if (!account) return <Shell><div className="p-8">Account not found</div></Shell>;

  const isLegacy = account.source === 'abm';

  return (
    <Shell>
      <EntityHeader
        title={account.name}
        subtitle={`${account.accountNumber} • ${account.source === 'app' ? 'Application Managed' : 'Legacy ABM'}`}
        onBack={() => router.push('/accounts')}
        isSaving={saving}
        isDirty={isDirty}
        onSave={handleSave}
        badges={
          <span className={`badge badge-${account.stateCode}`}>
            {account.stateCode}
          </span>
        }
      />

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="space-y-6 mb-8">
            {/* Basic Info Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Account Number
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
                    Customer Group
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.customerGroup || ''}
                    onChange={(e) => updateField('customerGroup', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    GST Position
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.gstPosition || ''}
                    onChange={(e) => updateField('gstPosition', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
              </div>
            </div>

            {/* Primary Contact Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Primary Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactName || ''}
                    onChange={(e) => updateField('primaryContactName', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.primaryContactEmail || ''}
                    onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactPhone || ''}
                    onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
              </div>
            </div>

            {/* Address & Contact Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Contact & Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.emailAddress1 || ''}
                    onChange={(e) => updateField('emailAddress1', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.telephone1 || ''}
                    onChange={(e) => updateField('telephone1', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Street
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1 || ''}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    City
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1City || ''}
                    onChange={(e) => updateField('address1City', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    State / Province
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1StateOrProvince || ''}
                    onChange={(e) => updateField('address1StateOrProvince', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Postal Code
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1PostalCode || ''}
                    onChange={(e) => updateField('address1PostalCode', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Country
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Country || ''}
                    onChange={(e) => updateField('address1Country', e.target.value)}
                    disabled={isLegacy || saving}
                  />
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Internal Notes
              </h3>
              <input
                type="text"
                className="input"
                value={dto.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Internal notes"
                disabled={isLegacy || saving}
              />
            </div>

          {/* Record Details Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Record Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Account ID
                </label>
                <input className="input" disabled value={account.accountId} style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Source
                </label>
                <input className="input" disabled value={account.source === 'abm' ? 'Legacy ABM' : 'Application'} />
              </div>
              {(account as any).createdOn && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created
                  </label>
                  <input className="input" disabled value={new Date((account as any).createdOn).toLocaleDateString()} />
                </div>
              )}
              {(account as any).createdBy && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Created By
                  </label>
                  <input className="input" disabled value={(account as any).createdBy} />
                </div>
              )}
            </div>
            {(account as any).modifiedOn && (
              <div className="mt-4" style={{ maxWidth: '50%' }}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Last Modified
                </label>
                <input className="input" disabled value={new Date((account as any).modifiedOn).toLocaleString()} />
              </div>
            )}
            {isLegacy && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                This is a read-only legacy record imported from ABM. Changes must be made in the source system.
              </p>
            )}
          </div>

          {/* Pricing & Currency Card */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pricing & Currency
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Currency
                </label>
                <select
                  className="input"
                  value={dto.currencyCode}
                  onChange={(e) => updateField('currencyCode', e.target.value)}
                  disabled={isLegacy || saving}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Customer Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="input"
                  value={dto.customerDiscount || '0'}
                  onChange={(e) => updateField('customerDiscount', e.target.value)}
                  disabled={isLegacy || saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Status
                </label>
                <div
                  className="flex items-center gap-3"
                  style={{ paddingTop: 6, cursor: isLegacy || saving ? 'not-allowed' : 'pointer' }}
                  onClick={() => {
                    if (isLegacy || saving) return;
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
                      opacity: isLegacy || saving ? 0.5 : 1,
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
                    {dto.stateCode === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Activity Timeline
            </h3>
            <ActivityTimeline events={account.events || []} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
