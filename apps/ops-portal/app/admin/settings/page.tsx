'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import { HOME_CURRENCY, getCurrency } from '@/lib/currency';
import { useTranslations } from 'next-intl';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

interface UomEntry {
  uomCode: string;
  description: string;
}

interface ExchangeRate {
  exchangeRateId: string;
  currencyCode: string;
  currencyName: string;
  buyRate: string;
  sellRate: string;
  effectiveDate: string;
  updatedOn: string;
}

const TAX_TYPES = (t: any) => [
  { value: 'tax_applies', label: t('admin.settings.taxTypes.tax_applies') },
  { value: 'zero_rated', label: t('admin.settings.taxTypes.zero_rated') },
  { value: 'exempt', label: t('admin.settings.taxTypes.exempt') },
  { value: 'not_relevant', label: t('admin.settings.taxTypes.not_relevant') },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const tSettings = useTranslations('admin.settings');
  useDocumentTitle(tSettings('title'));
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  // ── Tax state ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxEditingId, setTaxEditingId] = useState<string | null>(null);
  const [taxForm, setTaxForm] = useState<any>({});
  const [taxCreating, setTaxCreating] = useState(false);

  // ── UOM state ──────────────────────────────────────────────────────────────
  const [uoms, setUoms] = useState<UomEntry[]>([]);
  const [uomLoading, setUomLoading] = useState(true);
  const [uomEditingCode, setUomEditingCode] = useState<string | null>(null);
  const [uomForm, setUomForm] = useState<any>({});
  const [uomCreating, setUomCreating] = useState(false);

  // ── Exchange Rates state ───────────────────────────────────────────────────
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateEditingId, setRateEditingId] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<any>({});
  const [rateCreating, setRateCreating] = useState(false);

  // ── Organization state ─────────────────────────────────────────────────────
  const [orgForm, setOrgForm] = useState<any>({});
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [isOrgDirty, setIsOrgDirty] = useState(false);

  // ── GL Settings state ────────────────────────────────────────────────────────
  const [glSettings, setGlSettings] = useState<any>(null);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [glLoading, setGlLoading] = useState(true);

  // ── Organization data ──────────────────────────────────────────────────────

  const loadOrg = async () => {
    try {
      setOrgLoading(true);
      const data = await apiFetch<any>('/api/settings/organization');
      setOrgForm(data);
      setIsOrgDirty(false);
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.company') }) + ': ' + err.message);
    } finally {
      setOrgLoading(false);
    }
  };

  // Auto-save effect for organization
  useEffect(() => {
    if (!isOrgDirty || orgSaving || !orgForm.name) return;

    const handler = setTimeout(() => {
      orgSave();
    }, 2000); // 2s debounce for platform settings

    return () => clearTimeout(handler);
  }, [orgForm, isOrgDirty, orgSaving]);

  const updateOrgField = (field: string, value: any) => {
    setOrgForm((prev: any) => {
      if (prev[field] === value) return prev;
      setIsOrgDirty(true);
      return { ...prev, [field]: value };
    });
  };

  const orgSave = async () => {
    if (!orgForm.name || !isOrgDirty) return;
    
    // Clear dirty flag immediately to prevent retry loops on validation failure
    setIsOrgDirty(false);
    
    try {
      setOrgSaving(true);
      
      // Clean up payload: normalize empty strings to null for optional fields (email, website, etc)
      const payload = { ...orgForm };
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });

      await apiMutate('/api/settings/organization', 'PATCH', payload);
    } catch (err: any) {
      toast.error(err.message, { id: 'org-save-error' }); // Use fixed ID to prevent "stream" of toasts
    } finally {
      setOrgSaving(false);
    }
  };

  const areaMap: Record<string, string> = {
    org: tSettings('sections.company'),
    gl: tSettings('sections.gl'),
    tax: tSettings('sections.tax'),
    uom: tSettings('sections.uom'),
    rates: tSettings('sections.rates'),
  };

  // ── GL Settings data ───────────────────────────────────────────────────────
  
  const loadGl = async () => {
    try {
      setGlLoading(true);
      const [settingsRes, accountsRes] = await Promise.all([
        apiFetch<any>('/api/gl/settings'),
        apiFetch<any[]>('/api/gl/accounts')
      ]);
      setGlSettings(settingsRes || {});
      setGlAccounts(accountsRes || []);
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.gl }) + ': ' + err.message);
    } finally {
      setGlLoading(false);
    }
  };

  // ── Tax data ───────────────────────────────────────────────────────────────

  const loadTax = async () => {
    try {
      setTaxLoading(true);
      const data = await apiFetch<TaxCategory[]>('/api/tax-categories');
      setCategories(data.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.tax }) + ': ' + err.message);
    } finally {
      setTaxLoading(false);
    }
  };

  const taxEdit = (cat: TaxCategory) => { setTaxEditingId(cat.taxCategoryId); setTaxForm({ ...cat }); setTaxCreating(false); };
  const taxCreate = () => { setTaxCreating(true); setTaxEditingId(null); setTaxForm({ code: '', title: '', type: 'tax_applies', rate: '0', isDefault: false }); };
  const taxCancel = () => { setTaxEditingId(null); setTaxCreating(false); };

  const taxSave = async () => {
    try {
      const payload = { ...taxForm };
      if (taxEditingId) {
        await apiMutate(`/api/tax-categories/${taxEditingId}`, 'PATCH', payload);
        toast.success(tSettings('toasts.taxUpdated'));
      } else {
        await apiMutate('/api/tax-categories', 'POST', payload);
        toast.success(tSettings('toasts.taxCreated'));
      }
      taxCancel(); loadTax();
    } catch (err: any) { toast.error(err.message); }
  };

  const taxDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteTax'))) return;
    try { await apiMutate(`/api/tax-categories/${id}`, 'DELETE'); toast.success(tSettings('toasts.taxDeleted')); loadTax(); }
    catch (err: any) { toast.error(err.message); }
  };

  // ── UOM data ───────────────────────────────────────────────────────────────

  const loadUom = async () => {
    try {
      setUomLoading(true);
      const data = await apiFetch<UomEntry[]>('/api/settings/uom-dictionary');
      setUoms(data);
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.uom') }) + ': ' + err.message);
    } finally {
      setUomLoading(false);
    }
  };

  const uomEdit = (u: UomEntry) => { setUomEditingCode(u.uomCode); setUomForm({ ...u }); setUomCreating(false); };
  const uomCreate = () => { setUomCreating(true); setUomEditingCode(null); setUomForm({ uomCode: '', description: '' }); };
  const uomCancel = () => { setUomEditingCode(null); setUomCreating(false); };

  const uomSave = async () => {
    if (!uomForm.uomCode || !uomForm.description) { toast.error(tCommon('errors.typeAndDateRequired')); return; }
    try {
    if (uomEditingCode) {
        await apiMutate(`/api/settings/uom-dictionary/${uomEditingCode}`, 'PATCH', { description: uomForm.description });
        toast.success(tSettings('toasts.uomUpdated'));
      } else {
        await apiMutate('/api/settings/uom-dictionary', 'POST', { uomCode: uomForm.uomCode, description: uomForm.description });
        toast.success(tSettings('toasts.uomCreated'));
      }
      uomCancel(); loadUom();
    } catch (err: any) { toast.error(err.message); }
  };

  const uomDelete = async (code: string) => {
    if (!confirm(tSettings('confirmations.deleteUom', { code }))) return;
    try { await apiMutate(`/api/settings/uom-dictionary/${code}`, 'DELETE'); toast.success(tSettings('toasts.uomDeleted')); loadUom(); }
    catch (err: any) { toast.error(err.message); }
  };

  // ── Exchange Rates data ────────────────────────────────────────────────────

  const loadRates = async () => {
    try {
      setRateLoading(true);
      const data = await apiFetch<ExchangeRate[]>('/api/settings/exchange-rates');
      setRates(data);
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.rates') }) + ': ' + err.message);
    } finally {
      setRateLoading(false);
    }
  };

  const rateEdit = (r: ExchangeRate) => { setRateEditingId(r.exchangeRateId); setRateForm({ ...r }); setRateCreating(false); };
  const rateCreate = () => { setRateCreating(true); setRateEditingId(null); setRateForm({ currencyCode: '', currencyName: '', buyRate: '1.0', sellRate: '1.0', effectiveDate: new Date().toISOString().split('T')[0] }); };
  const rateCancel = () => { setRateEditingId(null); setRateCreating(false); };

  const rateSave = async () => {
    if (!rateForm.currencyCode || !rateForm.currencyName || !rateForm.buyRate || !rateForm.sellRate) {
      toast.error(tCommon('errors.typeAndDateRequired')); return;
    }
    try {
      const payload = {
        currencyCode: rateForm.currencyCode.toUpperCase(),
        currencyName: rateForm.currencyName,
        buyRate: rateForm.buyRate,
        sellRate: rateForm.sellRate,
        effectiveDate: rateForm.effectiveDate
      };
      if (rateEditingId) {
        await apiMutate(`/api/settings/exchange-rates/${rateEditingId}`, 'PATCH', payload);
        toast.success(tSettings('toasts.rateUpdated'));
      } else {
        await apiMutate('/api/settings/exchange-rates', 'POST', payload);
        toast.success(tSettings('toasts.rateCreated'));
      }
      rateCancel(); loadRates();
    } catch (err: any) { toast.error(err.message); }
  };

  const rateDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteRate'))) return;
    try { await apiMutate(`/api/settings/exchange-rates/${id}`, 'DELETE'); toast.success(tSettings('toasts.rateDeleted')); loadRates(); }
    catch (err: any) { toast.error(err.message); }
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadOrg();
    loadTax();
    loadUom();
    loadRates();
    loadGl();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const typeLabel = (type: string) => TAX_TYPES(useTranslations()).find(t => t.value === type)?.label ?? type;

  const renderGlAccountLabel = (glAccountId?: string) => {
    if (!glAccountId) return <span className="text-muted italic">{tCommon('notConfigured')}</span>;
    const acct = glAccounts.find(a => a.glAccountId === glAccountId);
    if (!acct) return <span className="text-muted italic text-xs font-mono">{glAccountId}</span>;
    return (
      <span className="font-medium text-sm flex items-center gap-2">
        <span className="badge badge-secondary font-mono !py-0 !px-1.5">{acct.accountCode}</span>
        {acct.name}
      </span>
    );
  };

  // ── Row Renderers ─────────────────────────────────────────────────────────

  const renderTaxRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit
          ? <input className="input" value={taxForm.code} onChange={e => setTaxForm({ ...taxForm, code: e.target.value })} placeholder={tSettings('labels.code')} />
          : <span className="font-mono text-xs">{data.code}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={taxForm.title} onChange={e => setTaxForm({ ...taxForm, title: e.target.value })} placeholder={tSettings('labels.title')} />
          : <span className="font-medium">{data.title}</span>}
      </td>
      <td>
        {isEdit ? (
          <select className="input" value={taxForm.type} onChange={e => setTaxForm({ ...taxForm, type: e.target.value })}>
            {TAX_TYPES(useTranslations()).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        ) : typeLabel(data.type)}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={taxForm.rate} onChange={e => setTaxForm({ ...taxForm, rate: e.target.value })} type="number" step="0.01" style={{ width: 80 }} />
          : <>{data.rate}%</>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {isEdit ? (
          <input type="checkbox" checked={taxForm.isDefault === true || taxForm.isDefault === 'true'} onChange={e => setTaxForm({ ...taxForm, isDefault: e.target.checked })} />
        ) : data.isDefault ? (
          // eslint-disable-next-line i18next/no-literal-string
          <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--primary)' }}>check_circle</span>
        ) : null}
      </td>
      <td style={{ textAlign: 'right' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={taxCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={taxSave}>{tSettings('actions.save')}</button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={() => taxEdit(data)}>{tSettings('actions.edit')}</button>
            {!data.isDefault && (
              <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => taxDelete(data.taxCategoryId)}>{tSettings('actions.delete')}</button>
            )}
          </div>
        )}
      </td>
    </tr>
  );

  const renderUomRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit && uomCreating
          ? <input className="input" value={uomForm.uomCode} onChange={e => setUomForm({ ...uomForm, uomCode: e.target.value.toUpperCase() })} placeholder={tSettings('placeholders.uomCode')} style={{ width: 100 }} />
          : <span className="font-mono text-xs">{data.uomCode}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={uomForm.description} onChange={e => setUomForm({ ...uomForm, description: e.target.value })} placeholder={tSettings('placeholders.uomDescription')} />
          : <span className="font-medium">{data.description}</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={uomCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={uomSave}>{tSettings('actions.save')}</button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={() => uomEdit(data)}>{tSettings('actions.edit')}</button>
            <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => uomDelete(data.uomCode)}>{tSettings('actions.delete')}</button>
          </div>
        )}
      </td>
    </tr>
  );

  const renderRateRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit && rateCreating
          ? <input className="input" value={rateForm.currencyCode} onChange={e => setRateForm({ ...rateForm, currencyCode: e.target.value.toUpperCase() })} placeholder={tSettings('placeholders.currencyCode')} style={{ width: 80 }} />
          : <span className="font-mono text-xs">{data.currencyCode}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={rateForm.currencyName} onChange={e => setRateForm({ ...rateForm, currencyName: e.target.value })} placeholder={tSettings('placeholders.currencyName')} />
          : <span className="font-medium">{data.currencyName}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" type="number" step="0.0001" value={rateForm.buyRate} onChange={e => setRateForm({ ...rateForm, buyRate: e.target.value })} style={{ width: 100 }} />
          : <span>{data.buyRate}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" type="number" step="0.0001" value={rateForm.sellRate} onChange={e => setRateForm({ ...rateForm, sellRate: e.target.value })} style={{ width: 100 }} />
          : <span>{data.sellRate}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" type="date" value={rateForm.effectiveDate?.split('T')[0]} onChange={e => setRateForm({ ...rateForm, effectiveDate: e.target.value })} />
          : <span className="text-xs">{new Date(data.effectiveDate).toLocaleDateString()}</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={rateCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={rateSave}>{tSettings('actions.save')}</button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={() => rateEdit(data)}>{tSettings('actions.edit')}</button>
            <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => rateDelete(data.exchangeRateId)}>{tSettings('actions.delete')}</button>
          </div>
        )}
      </td>
    </tr>
  );

  // ── Nav Configuration ─────────────────────────────────────────────────────

  const navSections = useMemo(() => [
    { id: 'org-section', label: tSettings('sections.company'), show: true },
    { id: 'bank-section', label: tSettings('sections.bank'), show: true },
    { id: 'gl-section', label: tSettings('sections.gl'), show: true },
    { id: 'tax-section', label: tSettings('sections.tax'), show: true },
    { id: 'rates-section', label: tSettings('sections.rates'), show: true },
    { id: 'uom-section', label: tSettings('sections.uom'), show: true },
  ], [tSettings]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={tSettings('title')}
          subtitle={tSettings('subtitle')}
          onBack={() => router.push('/')}
          actions={
            <div className="flex items-center gap-2">
              <PageNav sections={navSections} />
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Company Information ────────────────────────────────────────── */}
        <div id="org-section" className="card">
            <h3 className="section-heading mb-4">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">business</span>
              {tSettings('sections.company')}
            </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.companyName')}
                </label>
                <input
                  className="input"
                  value={orgForm.name || ''}
                  onChange={(e) => updateOrgField('name', e.target.value)}
                  placeholder={tSettings('placeholders.companyName')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.email')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.email || ''}
                    onChange={(e) => updateOrgField('email', e.target.value)}
                    placeholder={tSettings('placeholders.email')}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.phone')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.phone || ''}
                    onChange={(e) => updateOrgField('phone', e.target.value)}
                    placeholder={tSettings('placeholders.phone')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.website')}
                </label>
                <input
                  className="input"
                  value={orgForm.website || ''}
                  onChange={(e) => updateOrgField('website', e.target.value)}
                  placeholder={tSettings('placeholders.website')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.companyNumber')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.companyNumber || ''}
                    onChange={(e) => updateOrgField('companyNumber', e.target.value)}
                    placeholder={tSettings('placeholders.companyNumber')}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.taxNumber')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.taxNumber || ''}
                    onChange={(e) => updateOrgField('taxNumber', e.target.value)}
                    placeholder={tSettings('placeholders.taxNumber')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.logoUrl')}
                </label>
                <input
                  className="input"
                  value={orgForm.logoUrl || ''}
                  onChange={(e) => updateOrgField('logoUrl', e.target.value)}
                  placeholder={tSettings('placeholders.logoUrl')}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.address1')}
                </label>
                <input
                  className="input"
                  value={orgForm.addressLine1 || ''}
                  onChange={(e) => updateOrgField('addressLine1', e.target.value)}
                  placeholder={tSettings('placeholders.address1')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.address2')}
                </label>
                <input
                  className="input"
                  value={orgForm.addressLine2 || ''}
                  onChange={(e) => updateOrgField('addressLine2', e.target.value)}
                  placeholder={tSettings('placeholders.address2')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.city')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.city || ''}
                    onChange={(e) => updateOrgField('city', e.target.value)}
                    placeholder={tSettings('placeholders.city')}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.state')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.state || ''}
                    onChange={(e) => updateOrgField('state', e.target.value)}
                    placeholder={tSettings('placeholders.state')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.postCode')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.postCode || ''}
                    onChange={(e) => updateOrgField('postCode', e.target.value)}
                    placeholder={tSettings('placeholders.postCode')}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.country')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.country || ''}
                    onChange={(e) => updateOrgField('country', e.target.value)}
                    placeholder={tSettings('placeholders.country')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bank Details ────────────────────────────────────────── */}
        <div id="bank-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">account_balance</span>
              {tSettings('sections.bank')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.bankName')}
                </label>
                <input
                  className="input"
                  value={orgForm.bankName || ''}
                  onChange={(e) => updateOrgField('bankName', e.target.value)}
                  placeholder={tSettings('placeholders.bankName')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.accountName')}
                </label>
                <input
                  className="input"
                  value={orgForm.bankAccountName || ''}
                  onChange={(e) => updateOrgField('bankAccountName', e.target.value)}
                  placeholder={tSettings('placeholders.accountName')}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tSettings('labels.accountNumber')}
                </label>
                <input
                  className="input"
                  value={orgForm.bankAccountNumber || ''}
                  onChange={(e) => updateOrgField('bankAccountNumber', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.iban')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.bankIban || ''}
                    onChange={(e) => updateOrgField('bankIban', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.swiftBic')}
                  </label>
                  <input
                    className="input"
                    value={orgForm.bankSwiftBic || ''}
                    onChange={(e) => updateOrgField('bankSwiftBic', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* ── General Ledger ────────────────────────────────────────── */}
        <div id="gl-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {tSettings('sections.gl')}
            </h3>
            <span className="badge badge-secondary">Read-Only</span>
          </div>

          {glLoading ? (
            <div className="text-sm text-muted animate-pulse">{tSettings('gl.loading')}</div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultAr')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultArAccountId)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultRevenue')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultRevenueAccountId)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultAp')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultApAccountId)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultTax')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultTaxAccountId)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultCogs')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultCogsAccountId)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultExpense')}
                  </label>
                  <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                    {renderGlAccountLabel(glSettings?.defaultExpenseAccountId)}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.revenueRouting')}
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {glSettings?.revenueRoutingPrecedence === 'customer_first'
                      ? tSettings('gl.customerFirst')
                      : tSettings('gl.productFirst')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.expenseRouting')}
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {glSettings?.expenseRoutingPrecedence === 'supplier_first'
                      ? tSettings('gl.supplierFirst')
                      : tSettings('gl.productFirst')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ── Tax Categories ─────────────────────────────────────────────── */}
        <div id="tax-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">payments</span>
              {tSettings('sections.tax')}
            </h3>
            <button className="btn btn-primary btn-sm" onClick={taxCreate}>+ {tSettings('actions.create')}</button>
          </div>
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 100 }}>{tSettings('labels.code')}</th>
                <th>{tSettings('labels.title')}</th>
                <th style={{ width: 140 }}>{tSettings('labels.type')}</th>
                <th style={{ width: 80 }}>{tSettings('labels.rate')}</th>
                <th style={{ width: 80, textAlign: 'center' }}>{tSettings('labels.isDefault')}</th>
                <th style={{ width: 150, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {taxCreating && renderTaxRow(true, taxForm, 'new-tax')}
              {!taxLoading && categories.length === 0 && !taxCreating && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('tax.empty')}</td></tr>
              )}
              {categories.map(cat =>
                taxEditingId === cat.taxCategoryId
                  ? renderTaxRow(true, cat, cat.taxCategoryId)
                  : renderTaxRow(false, cat, cat.taxCategoryId)
              )}
            </tbody>
          </table>
        </div>

        {/* ── Exchange Rates ─────────────────────────────────────────────── */}
        <div id="rates-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">currency_exchange</span>
              {tSettings('sections.rates')}
            </h3>
            <button className="btn btn-primary btn-sm" onClick={rateCreate}>+ {tSettings('actions.create')}</button>
          </div>
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 100 }}>{tSettings('labels.currencyCode')}</th>
                <th>{tSettings('labels.currencyName')}</th>
                <th style={{ width: 110 }}>{tSettings('labels.buyRate')}</th>
                <th style={{ width: 110 }}>{tSettings('labels.sellRate')}</th>
                <th style={{ width: 130 }}>{tSettings('labels.effectiveDate')}</th>
                <th style={{ width: 150, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* --- Anchor Row: Base System Currency --- */}
              <tr style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.03)', fontWeight: 500 }}>
                <td>
                  <div className="flex items-center gap-2">
                    {HOME_CURRENCY.code}
                  </div>
                </td>
                <td>{HOME_CURRENCY.name}</td>
                <td>1.0000</td>
                <td>1.0000</td>
                <td><span className="text-xs italic text-muted">System Base</span></td>
                <td style={{ textAlign: 'right' }}>
                  <span className="text-xs text-muted italic">Fixed</span>
                </td>
              </tr>

              {rateCreating && renderRateRow(true, rateForm, 'new-rate')}
              {!rateLoading && rates.length === 0 && !rateCreating && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('rates.empty')}</td></tr>
              )}
              {rates.map(r =>
                rateEditingId === r.exchangeRateId
                  ? renderRateRow(true, r, r.exchangeRateId)
                  : renderRateRow(false, r, r.exchangeRateId)
              )}
            </tbody>
          </table>
        </div>

        {/* ── UOM Dictionary ─────────────────────────────────────────────── */}
        <div id="uom-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">straighten</span>
              {tSettings('sections.uom')}
            </h3>
            <button className="btn btn-primary btn-sm" onClick={uomCreate}>+ {tSettings('actions.create')}</button>
          </div>
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 120 }}>{tSettings('labels.code')}</th>
                <th>{tSettings('labels.description')}</th>
                <th style={{ width: 150, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {uomCreating && renderUomRow(true, uomForm, 'new-uom')}
              {!uomLoading && uoms.length === 0 && !uomCreating && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('uom.empty')}</td></tr>
              )}
              {uoms.map(u =>
                uomEditingCode === u.uomCode
                  ? renderUomRow(true, u, u.uomCode)
                  : renderUomRow(false, u, u.uomCode)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DetailsLayout>
  );
}
