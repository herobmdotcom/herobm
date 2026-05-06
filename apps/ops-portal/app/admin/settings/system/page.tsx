'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import { useTranslations } from 'next-intl';

// ── Types ────────────────────────────────────────────────────────────────────

interface UomEntry {
  uomCode: string;
  description: string;
}

interface Macro {
  macroId: string;
  name: string;
  macroType: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  useDocumentTitle(tSettings('title'));
  const tCommon = useTranslations('admin.common');
  const t = useTranslations();
  const router = useRouter();

  // ── UOM state ──────────────────────────────────────────────────────────────
  const [uoms, setUoms] = useState<UomEntry[]>([]);
  const [uomLoading, setUomLoading] = useState(true);
  const [uomEditingCode, setUomEditingCode] = useState<string | null>(null);
  const [uomForm, setUomForm] = useState<any>({});
  const [uomCreating, setUomCreating] = useState(false);

  // ── Macros state ───────────────────────────────────────────────────────────
  const [macros, setMacros] = useState<Macro[]>([]);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macroEditingId, setMacroEditingId] = useState<string | null>(null);
  const [macroForm, setMacroForm] = useState<any>({});
  const [macroCreating, setMacroCreating] = useState(false);

  // ── Organization state ─────────────────────────────────────────────────────
  const [orgForm, setOrgForm] = useState<any>({});
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [isOrgDirty, setIsOrgDirty] = useState(false);

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

  const updateOrgField = (field: string, value: any) => {
    setOrgForm((prev: any) => {
      if (prev[field] === value) return prev;
      setIsOrgDirty(true);
      return { ...prev, [field]: value };
    });
  };

  const saveOrgField = async () => {
    if (orgSaving || !orgForm.name) return;
    orgSave();
  };

  const orgSave = async () => {
    if (!orgForm.name || !isOrgDirty) return;
    setIsOrgDirty(false);
    try {
      setOrgSaving(true);
      const payload = { ...orgForm };
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });
      await apiMutate('/api/settings/organization', 'PATCH', payload);
    } catch (err: any) {
      toast.error(err.message, { id: 'org-save-error' });
    } finally {
      setOrgSaving(false);
    }
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

  // ── Macros data ────────────────────────────────────────────────────────────

  const loadMacros = async () => {
    try {
      setMacroLoading(true);
      const data = await apiFetch<Macro[]>('/api/macros');
      setMacros(data);
    } catch (err: any) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.macros') }) + ': ' + err.message);
    } finally {
      setMacroLoading(false);
    }
  };

  const macroEdit = (m: Macro) => { setMacroEditingId(m.macroId); setMacroForm({ ...m }); setMacroCreating(false); };
  const macroCreate = () => { setMacroCreating(true); setMacroEditingId(null); setMacroForm({ name: '', macroType: 'text_template', content: '' }); };
  const macroCancel = () => { setMacroEditingId(null); setMacroCreating(false); };

  const macroSave = async () => {
    if (!macroForm.name || !macroForm.content) {
      toast.error(tCommon('errors.typeAndDateRequired')); return;
    }
    try {
      const payload = {
        name: macroForm.name,
        macroType: macroForm.macroType || 'text_template',
        content: macroForm.content,
      };
      if (macroEditingId) {
        await apiMutate(`/api/macros/${macroEditingId}`, 'PATCH', payload);
        toast.success(tSettings('toasts.macroUpdated'));
      } else {
        await apiMutate('/api/macros', 'POST', payload);
        toast.success(tSettings('toasts.macroCreated'));
      }
      macroCancel(); loadMacros();
    } catch (err: any) { toast.error(err.message); }
  };

  const macroDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteMacro'))) return;
    try { await apiMutate(`/api/macros/${id}`, 'DELETE'); toast.success(tSettings('toasts.macroDeleted')); loadMacros(); }
    catch (err: any) { toast.error(err.message); }
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadOrg();
    loadUom();
    loadMacros();
  }, []);

  // ── Row Renderers ─────────────────────────────────────────────────────────

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

  const renderMacroRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit
          ? <input className="input" value={macroForm.name} onChange={e => setMacroForm({ ...macroForm, name: e.target.value })} placeholder={tSettings('labels.name')} style={{ width: 150 }} />
          : <span className="font-medium">{data.name}</span>}
      </td>
      <td>
        {isEdit
          ? <textarea className="input" rows={3} value={macroForm.content} onChange={e => setMacroForm({ ...macroForm, content: e.target.value })} placeholder={tSettings('labels.content')} style={{ width: '100%', resize: 'vertical' }} />
          : <span className="text-sm whitespace-pre-wrap">{data.content}</span>}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={macroCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={macroSave}>{tSettings('actions.save')}</button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={() => macroEdit(data)}>{tSettings('actions.edit')}</button>
            <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => macroDelete(data.macroId)}>{tSettings('actions.delete')}</button>
          </div>
        )}
      </td>
    </tr>
  );

  const navSections = useMemo(() => [
    { id: 'org-section', label: tSettings('sections.company'), show: true },
    { id: 'bank-section', label: tSettings('sections.bank'), show: true },
    { id: 'uom-section', label: tSettings('sections.uom'), show: true },
    { id: 'macros-section', label: tSettings('sections.macros'), show: true },
  ], [tSettings]);

  const flushCache = async () => {
    try {
      await apiMutate('/api/gl/settings/reload', 'POST');
      // eslint-disable-next-line i18next/no-literal-string
      toast.success('Settings cache flushed successfully.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={tSettings('title') + ' - ' + tCommon('system')}
          subtitle={tSettings('subtitle')}
          onBack={() => router.push('/')}
          actions={
            <div className="flex items-center gap-2">
              <PageNav sections={navSections} />
            </div>
          }
          showPrint={false}
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
                  onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                  onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
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
                    onBlur={saveOrgField}
                  />
                </div>
              </div>
            </div>
          </div>
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

        {/* ── Macros ────────────────────────────────────────────────────────────── */}
        <div id="macros-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">text_snippet</span>
              {tSettings('sections.macros')}
            </h3>
            <button className="btn btn-primary btn-sm" onClick={macroCreate}>+ {tSettings('actions.create')}</button>
          </div>

          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 200 }}>{tSettings('labels.name')}</th>
                <th>{tSettings('labels.content')}</th>
                <th style={{ width: 120, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {macroCreating && renderMacroRow(true, macroForm, 'new-macro')}
              {!macroLoading && macros.length === 0 && !macroCreating && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{t('common.selectNone')}</td></tr>
              )}
              {macros.map(m =>
                macroEditingId === m.macroId
                  ? renderMacroRow(true, m, m.macroId)
                  : renderMacroRow(false, m, m.macroId)
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-8">
          <button className="btn btn-secondary" onClick={flushCache}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined mr-2">sync</span>
            Flush settings cache
          </button>
        </div>
      </div>
    </DetailsLayout>
  );
}
