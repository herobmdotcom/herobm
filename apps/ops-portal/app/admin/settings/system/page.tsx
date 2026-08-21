'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import PageNav from '@/components/shared/PageNav';
import { useTranslations } from 'next-intl';
import { getErrorMessage, COUNTRIES } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import { OrderedSettingEditor } from '@/components/shared/OrderedSettingEditor';

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

  // ── Macros state ───────────────────────────────────────────────────────────
  const [macros, setMacros] = useState<Macro[]>([]);
  const [macroLoading, setMacroLoading] = useState(true);

  // ── App Settings state ─────────────────────────────────────────────────────
  const [appForm, setAppForm] = useState<Partial<api.AppConfigResponseDto>>({});
  const [appLoading, setAppLoading] = useState(true);
  const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);

  // ── Organization state ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  const [orgForm, setOrgForm] = useState<Partial<api.OrganizationResponseDto> & Record<string, any>>({});
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [isOrgDirty, setIsOrgDirty] = useState(false);

  // ── Organization data ──────────────────────────────────────────────────────

  const loadOrg = async () => {
    try {
      setOrgLoading(true);
      const res = await api.organizationControllerGet();
      const data = res.data;
      setOrgForm(data || {});
      setIsOrgDirty(false);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.company') }) + ': ' + getErrorMessage(err));
    } finally {
      setOrgLoading(false);
    }
  };

  const updateOrgField = (field: string, value: unknown) => {
    setOrgForm((prev: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
      const p = (prev as Record<string, any>) || {};
      if (p[field] === value) return p;
      setIsOrgDirty(true);
      return { ...p, [field]: value };
    });
  };

  const saveOrgField = async () => {
    if (orgSaving || !orgForm?.name) return;
    orgSave();
  };

  const orgSave = async () => {
    if (!orgForm?.name || !isOrgDirty) return;
    setIsOrgDirty(false);
    try {
      setOrgSaving(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
      const payload: Record<string, any> = { ...orgForm };
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });
      await api.organizationControllerUpdate(payload as unknown as api.UpdateOrganizationDto);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err), { id: 'org-save-error' });
    } finally {
      setOrgSaving(false);
    }
  };

  const loadAppConfig = async () => {
    try {
      setAppLoading(true);
      const [appDataRes, locsRes] = await Promise.all([
        api.appConfigControllerGet(),
        api.inventoryControllerFindAllLocations()
      ]);
      setAppForm(appDataRes.data);
      setLocations(locsRes.data || []);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: 'App Config' }) + ': ' + getErrorMessage(err));
    } finally {
      setAppLoading(false);
    }
  };

  const updateAppField = async (field: string, value: unknown) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
      setAppForm((prev: unknown) => ({ ...(prev as Record<string, any>), [field]: value }));
      await api.appConfigControllerUpdate({ [field]: value });
      toast.success(t('common.updated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── UOM data ───────────────────────────────────────────────────────────────

  const loadUom = async () => {
    try {
      setUomLoading(true);
      const res = await api.uomDictionaryControllerFindAll();
      setUoms(res.data);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.uom') }) + ': ' + getErrorMessage(err));
    } finally {
      setUomLoading(false);
    }
  };

  const uomColumns: InlineTableColumn<UomEntry>[] = useMemo(() => [
    { key: 'uomCode', title: tSettings('labels.code'), type: 'text', width: 120, placeholder: tSettings('placeholders.uomCode') },
    { key: 'description', title: tSettings('labels.description'), type: 'text', placeholder: tSettings('placeholders.uomDescription') }
  ], [tSettings]);

  const handleUomSave = async (payload: Partial<UomEntry>, isNew: boolean) => {
    if (!payload.uomCode || !payload.description) { throw new Error(tCommon('errors.typeAndDateRequired')); }
    const codeToSave = payload.uomCode.toUpperCase();
    if (isNew) {
      await api.uomDictionaryControllerCreate({ uomCode: codeToSave, description: payload.description });
      toast.success(tSettings('toasts.uomCreated'));
    } else {
      await api.uomDictionaryControllerUpdate(codeToSave, { description: payload.description });
      toast.success(tSettings('toasts.uomUpdated'));
    }
    loadUom();
  };

  const handleUomDelete = async (payload: Partial<UomEntry>) => {
    if (!payload.uomCode) return;
    if (!confirm(tSettings('confirmations.deleteUom', { code: payload.uomCode }))) return;
    await api.uomDictionaryControllerRemove(payload.uomCode);
    toast.success(tSettings('toasts.uomDeleted'));
    loadUom();
  };

  // ── Macros data ────────────────────────────────────────────────────────────

  const loadMacros = async () => {
    try {
      setMacroLoading(true);
      const mRes = await api.macrosControllerFindAll({ macroType: '' });
      setMacros(mRes.data as unknown as Macro[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.macros') }) + ': ' + getErrorMessage(err));
    } finally {
      setMacroLoading(false);
    }
  };

  const macroColumns: InlineTableColumn<Macro>[] = useMemo(() => [
    { key: 'name', title: tSettings('labels.name'), type: 'text', width: 200, placeholder: tSettings('labels.name') },
    { 
      key: 'macroType', 
      title: tSettings('labels.macroType'), 
      type: 'select', 
      options: [
        { value: 'general', label: tSettings('macroTypes.general') },
        { value: 'sales-order-quote', label: tSettings('macroTypes.salesOrderQuote') },
        { value: 'sales-order-confirmation', label: tSettings('macroTypes.salesOrderConfirmation') },
        { value: 'pro-forma-invoice', label: tSettings('macroTypes.proFormaInvoice') },
        { value: 'sales-invoice', label: tSettings('macroTypes.salesInvoice') },
        { value: 'picking-slip', label: tSettings('macroTypes.pickingSlip') },
        { value: 'shipping-docket', label: tSettings('macroTypes.shippingDocket') },
        { value: 'sales-return-credit', label: tSettings('macroTypes.salesReturnCredit') },
        { value: 'return-slip', label: tSettings('macroTypes.returnSlip') },
        { value: 'purchase-order', label: tSettings('macroTypes.purchaseOrder') }
      ],
      width: 200,
    },
    { 
      key: 'content', 
      title: tSettings('labels.content'), 
      type: 'textarea', 
      placeholder: tSettings('labels.content'),
      render: (row, isEditing) => isEditing ? undefined : <span className="text-sm whitespace-pre-wrap">{row.content}</span>
    }
  ], [tSettings]);

  const handleMacroSave = async (payload: Partial<Macro>, isNew: boolean) => {
    if (!payload.name || !payload.content) { throw new Error(tCommon('errors.typeAndDateRequired')); }
    const apiPayload = {
      name: payload.name,
      macroType: payload.macroType || 'general',
      content: payload.content,
    };
    if (isNew) {
      await api.macrosControllerCreate(apiPayload);
      toast.success(tSettings('toasts.macroCreated'));
    } else {
      if (!payload.macroId) return;
      await api.macrosControllerUpdate(payload.macroId, apiPayload);
      toast.success(tSettings('toasts.macroUpdated'));
    }
    loadMacros();
  };

  const handleMacroDelete = async (payload: Partial<Macro>) => {
    if (!payload.macroId) return;
    if (!confirm(tSettings('confirmations.deleteMacro'))) return;
    await api.macrosControllerRemove(payload.macroId);
    toast.success(tSettings('toasts.macroDeleted'));
    loadMacros();
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadOrg();
    loadAppConfig();
    loadUom();
    loadMacros();
  }, []);



  const navSections = useMemo(() => [
    { id: 'org-section', label: tSettings('sections.company'), show: true },
    { id: 'bank-section', label: tSettings('sections.bank'), show: true },
    { id: 'warehouse-settings-section', label: 'Warehouse Settings', show: true },
    { id: 'sales-analysis-codes-section', label: tSettings('sections.salesAnalysisCodes'), show: true },
    { id: 'uom-section', label: tSettings('sections.uom'), show: true },
    { id: 'macros-section', label: tSettings('sections.macros'), show: true },
  ], [tSettings]);

  const flushCache = async () => {
    try {
      await api.glControllerReloadSettings({});
      toast.success('Settings cache flushed successfully.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={tSettings('title') + ' - ' + tCommon('system')}
        subtitle={tSettings('subtitle')}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {/* ── Company Information ────────────────────────────────────────── */}
        <div id="org-section" className="card">
          <h3 className="section-heading mb-4">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
            <span className="material-symbols-outlined">business</span>
            {tSettings('sections.company')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tSettings('labels.country')}
                  </label>
                  <select
                    className="input"
                    value={orgForm.country || ''}
                    onChange={(e) => updateOrgField('country', e.target.value)}
                    onBlur={saveOrgField}
                  >
                    <option value="">{tSettings('placeholders.country')}</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bank Details ────────────────────────────────────────── */}
        <div id="bank-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              { }
              <span className="material-symbols-outlined">account_balance</span>
              {tSettings('sections.bank')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSettings('labels.customerNumber')}
                </label>
                <input
                  className="input"
                  value={orgForm.bankAccountNumber || ''}
                  onChange={(e) => updateOrgField('bankAccountNumber', e.target.value)}
                  onBlur={saveOrgField}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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

        {/* ── Warehouse Settings ────────────────────────────────────────── */}
        <div id="warehouse-settings-section" className="card">
          <h3 className="section-heading mb-4">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
            <span className="material-symbols-outlined">warehouse</span>
            Warehouse Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSettings('fulfillmentHeading')}
                </label>
                <select
                  className="input"
                  value={appForm?.defaultFulfillmentLocationId || ''}
                  onChange={(e) => updateAppField('defaultFulfillmentLocationId', e.target.value || null)}
                  disabled={appLoading}
                >
                  {!appForm?.defaultFulfillmentLocationId && <option value="">{tSettings('none')}</option>}
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sales Order Analysis Codes ───────────────────────────────────── */}
        <div id="sales-analysis-codes-section" className="card">
          <OrderedSettingEditor
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                <span className="material-symbols-outlined">analytics</span>
                {tSettings('sections.salesAnalysisCodes')}
              </h3>
            }
            columnTitle={tSettings('labels.analysisCode')}
            items={appForm?.salesAnalysisCodes || []}
            onChange={(newCodes) => updateAppField('salesAnalysisCodes', newCodes)}
          />
        </div>

        {/* ── UOM Dictionary ─────────────────────────────────────────────── */}
        <div id="uom-section" className="card">
          <InlineSettingsTable
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                <span className="material-symbols-outlined">straighten</span>
                {tSettings('sections.uom')}
              </h3>
            }
            columns={uomColumns}
            data={uoms}
          rowKey={(row: UomEntry) => row.uomCode}
            onSave={handleUomSave}
            onDelete={handleUomDelete}
            onAdd={() => ({ uomCode: '', description: '' })}
            addLabel={tSettings('actions.create')}
            emptyLabel={uomLoading ? null : tSettings('uom.empty')}
          />
        </div>

        {/* ── Macros ────────────────────────────────────────────────────────────── */}
        <div id="macros-section" className="card">
          <InlineSettingsTable
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                { }
                <span className="material-symbols-outlined">text_snippet</span>
                {tSettings('sections.macros')}
              </h3>
            }
            columns={macroColumns}
            data={macros}
          rowKey={(row: Macro) => row.macroId}
            onSave={handleMacroSave}
            onDelete={handleMacroDelete}
            onAdd={() => ({ name: '', macroType: 'general', content: '' } as Macro)}
            addLabel={tSettings('actions.create')}
            emptyLabel={macroLoading ? null : t('common.selectNone')}
          />
        </div>



        <div className="flex justify-end mt-8">
          <Button variant="secondary" onClick={flushCache}>
            Flush settings cache
          </Button>
        </div>
      </div>
    </div>
  );
}
