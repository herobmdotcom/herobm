'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo, Fragment } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import CsvImportButton from '@/components/shared/CsvImportButton';
import SlideOver from '@/components/shared/SlideOver';
import { SchemaBuilder } from '@/components/SchemaBuilder';
import { DynamicForm } from '@/components/DynamicForm';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import ImportCoaModal from './ImportCoaModal';
import ImportTaxModal from './ImportTaxModal';

import { getCurrency } from '@/lib/currency';
import { CURRENCIES, GL_ACCOUNT_TYPE } from '@modbm/shared';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
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

interface CostCenter {
  costCenterId: string;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

interface Activity {
  activityId: string;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

const TAX_TYPES = (t: any) => [
  { value: 'tax_applies', label: t('admin.settings.taxTypes.tax_applies') },
  { value: 'zero_rated', label: t('admin.settings.taxTypes.zero_rated') },
  { value: 'exempt', label: t('admin.settings.taxTypes.exempt') },
  { value: 'not_relevant', label: t('admin.settings.taxTypes.not_relevant') },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function FinancialSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');
  const t = useTranslations();
  useDocumentTitle(tSettings('title'));
  const taxTypes = useMemo(() => TAX_TYPES(t), [t]);
  const router = useRouter();

  // ── Tax state ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxEditingId, setTaxEditingId] = useState<string | null>(null);
  const [taxForm, setTaxForm] = useState<Partial<api.TaxCategoryResponseDto>>({});
  const [taxCreating, setTaxCreating] = useState(false);
  const [importTaxModalOpen, setImportTaxModalOpen] = useState(false);

  // ── Exchange Rates state ───────────────────────────────────────────────────
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateEditingId, setRateEditingId] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<Partial<api.ExchangeRateResponseDto>>({});
  const [rateCreating, setRateCreating] = useState(false);

  // ── Cost Centers state ─────────────────────────────────────────────────────
  const [ccs, setCcs] = useState<CostCenter[]>([]);
  const [ccLoading, setCcLoading] = useState(true);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [ccForm, setCcForm] = useState<Partial<api.CostCenterResponseDto>>({});
  const [ccCreating, setCcCreating] = useState(false);

  // ── Activities state ───────────────────────────────────────────────────────
  const [activitiesData, setActivitiesData] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityEditingId, setActivityEditingId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<Partial<api.ActivityResponseDto>>({});
  const [activityCreating, setActivityCreating] = useState(false);

  // ── GL Settings state ────────────────────────────────────────────────────────
  const [glSettings, setGlSettings] = useState<any | null>(null);

  const ratesWithBase = useMemo(() => {
    if (!glSettings?.baseCurrency) return rates;
    const baseRow = {
      isSystemBase: true,
      currencyCode: glSettings.baseCurrency,
      currencyName: getCurrency(glSettings.baseCurrency).name || glSettings.baseCurrency,
      effectiveDate: new Date().toISOString(),
      buyRate: 1.0,
      sellRate: 1.0
    };
    return [baseRow, ...rates];
  }, [glSettings, rates]);

  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [glLoading, setGlLoading] = useState(true);
  // modbm-allow-record-any
  const [schemaObj, setSchemaObj] = useState<Record<string, any>>({ type: 'object', properties: {} });
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ── CoA state ──────────────────────────────────────────────────────────────
  // modbm-allow-record-any
  const [coaForm, setCoaForm] = useState<Record<string, any>>({});
  const [coaCreating, setCoaCreating] = useState(false);
  const [coaEditingId, setCoaEditingId] = useState<string | null>(null);
  const [importCoaModalOpen, setImportCoaModalOpen] = useState(false);

  const coaTree = useMemo(() => {
    const map = new Map<string | null, any[]>();
    for (const acct of glAccounts) {
      const parentId = acct.parentAccountId || null;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(acct);
    }
    const build = (parentId: string | null, depth: number = 0): any[] => {
      const children = map.get(parentId) || [];
      const result: any[] = [];
      for (const acct of children) {
        result.push({ ...acct, depth });
        if (acct.isGroup) {
          result.push(...build(acct.glAccountId, depth + 1));
        }
      }
      return result;
    };
    return build(null);
  }, [glAccounts]);

  const areaMap: Record<string, string> = {
    gl: tSettings('sections.gl'),
    tax: tSettings('sections.tax'),
    rates: tSettings('sections.rates'),
    cc: tSettings('sections.costCenters'),
    activity: tSettings('sections.activities'),
  };

  // ── GL Settings data ───────────────────────────────────────────────────────
  
  const loadGl = async () => {
    try {
      setGlLoading(true);
      const [settingsRes, accountsRes] = await Promise.all([
        api.glControllerGetSettings(),
        api.glControllerGetAccounts({} as Record<string, never>)
      ]);
      setGlSettings(settingsRes.data);
      setGlAccounts(accountsRes.data);
      // modbm-allow-record-any
      setSchemaObj((settingsRes.data as unknown as { accountMetadataSchema?: Record<string, any> }).accountMetadataSchema || { type: 'object', properties: {} });
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.gl }) + ': ' + getErrorMessage(err));
    } finally {
      setGlLoading(false);
    }
  };

  const updateGlSetting = async (field: string, value: unknown) => {
    try {
      const payload = { [field]: value };
      const res = await api.glControllerUpdateSettings(payload);
      const updated = res.data;
      setGlSettings(Object.assign({}, glSettings || {}, updated));
      toast.success('Settings updated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const saveSchema = async () => {
    try {
      await updateGlSetting('accountMetadataSchema', schemaObj);
      // Update local settings so the UI updates immediately after save
      setGlSettings({ ...glSettings, accountMetadataSchema: schemaObj });
      setSchemaEditorOpen(false);
    } catch (err) {
      toast.error('Failed to save schema');
    }
  };

  const openSchemaEditor = () => {
    setSchemaObj(glSettings?.accountMetadataSchema || { type: 'object', properties: {} });
    setSchemaEditorOpen(true);
  };

  const coaEdit = (acct: unknown) => { setCoaEditingId((acct as { glAccountId: string }).glAccountId); setCoaForm({ ...(acct as object) }); setCoaCreating(false); };
  const coaCreate = (parentId?: string, parentAccountType?: string, isGroupDefault: boolean = false) => { setCoaCreating(true); setCoaEditingId(null); setCoaForm({ accountCode: '', name: '', accountType: parentAccountType || GL_ACCOUNT_TYPE.EXPENSE, parentAccountId: parentId || null, isGroup: isGroupDefault, isBankAccount: false, currencyCode: 'AUD', isActive: true }); };
  const coaCancel = () => { setCoaEditingId(null); setCoaCreating(false); };

  const coaSave = async () => {
    if (!coaForm.accountCode || !coaForm.name || !coaForm.accountType) { toast.error(tCommon('errors.typeAndDateRequired') || 'Required fields missing'); return; }
    try {
      const payload: any = { ...coaForm };
      if (coaEditingId) {
        await api.glControllerUpdateAccount(coaEditingId, payload);
        toast.success('Saved');
      } else {
        await api.glControllerCreateAccount(payload);
        toast.success('Saved');
      }
      coaCancel(); loadGl();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  // ── Tax data ───────────────────────────────────────────────────────────────

  const loadTax = async () => {
    try {
      setTaxLoading(true);
      const res = await api.taxCategoriesControllerFindAll();
      setCategories((res.data as TaxCategory[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.tax }) + ': ' + getErrorMessage(err));
    } finally {
      setTaxLoading(false);
    }
  };

  const taxEdit = (cat: TaxCategory) => { setTaxEditingId(cat.taxCategoryId); setTaxForm({ ...cat }); setTaxCreating(false); };
  const taxCreate = () => { setTaxCreating(true); setTaxEditingId(null); setTaxForm({ code: '', title: '', type: 'tax_applies', rate: '0', isDefault: false }); };
  const taxCancel = () => { setTaxEditingId(null); setTaxCreating(false); };

  const taxSave = async () => {
    try {
      const payload: any = { ...taxForm };
      if (taxEditingId) {
        await api.taxCategoriesControllerUpdate(taxEditingId, payload);
        toast.success(tSettings('toasts.taxUpdated'));
      } else {
        await api.taxCategoriesControllerCreate(payload);
        toast.success(tSettings('toasts.taxCreated'));
      }
      taxCancel(); loadTax();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const taxDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteTax'))) return;
    try { await api.taxCategoriesControllerRemove(id); toast.success(tSettings('toasts.taxDeleted')); loadTax(); }
    catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  // ── Exchange Rates data ────────────────────────────────────────────────────

  const loadRates = async () => {
    try {
      setRateLoading(true);
      const res = await api.exchangeRatesControllerFindAll();
      setRates(res.data as unknown as ExchangeRate[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.rates }) + ': ' + getErrorMessage(err));
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
        await api.exchangeRatesControllerUpdate(rateEditingId, payload);
        toast.success(tSettings('toasts.rateUpdated'));
      } else {
        await api.exchangeRatesControllerCreate(payload);
        toast.success(tSettings('toasts.rateCreated'));
      }
      rateCancel(); loadRates();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const rateDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteRate'))) return;
    try { await api.exchangeRatesControllerRemove(id); toast.success(tSettings('toasts.rateDeleted')); loadRates(); }
    catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  // ── Cost Centers data ─────────────────────────────────────────────────────

  const loadCcs = async () => {
    try {
      setCcLoading(true);
      const res = await api.costCentersControllerFindAll();
      setCcs(res.data as unknown as CostCenter[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.cc }) + ': ' + getErrorMessage(err));
    } finally {
      setCcLoading(false);
    }
  };

  const ccEdit = (cc: CostCenter) => { setCcEditingId(cc.costCenterId); setCcForm({ ...cc }); setCcCreating(false); };
  const ccCreate = () => { setCcCreating(true); setCcEditingId(null); setCcForm({ code: '', name: '', isActive: true }); };
  const ccCancel = () => { setCcEditingId(null); setCcCreating(false); };

  const ccSave = async () => {
    if (!ccForm.code || !ccForm.name) { toast.error(tCommon('errors.typeAndDateRequired')); return; }
    try {
      const payload = { 
        code: ccForm.code.toUpperCase(), 
        name: ccForm.name,
        isActive: ccForm.isActive ?? true 
      };
      if (ccEditingId) {
        await api.costCentersControllerUpdate(ccEditingId, payload);
        toast.success(tSettings('toasts.ccUpdated'));
      } else {
        await api.costCentersControllerCreate(payload);
        toast.success(tSettings('toasts.ccCreated'));
      }
      ccCancel(); loadCcs();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const ccDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteCc'))) return;
    try { 
      await api.costCentersControllerDelete(id); 
      toast.success(tSettings('toasts.ccDeleted')); 
      loadCcs(); 
    }
    catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const handleImportCc = async (data: any[]) => {
    setIsImporting(true);
    try {
      const res = await api.costCentersControllerImport(data);
      const responseData = res.data;
      toast.success(tSettings('toasts.importSuccess', { count: responseData.count }));
      loadCcs();
    } catch (err: unknown) {
      toast.error(tSettings('toasts.importFailed', { message: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  // ── Activities data ───────────────────────────────────────────────────────

  const loadActivities = async () => {
    try {
      setActivityLoading(true);
      const res = await api.activitiesControllerFindAll();
      setActivitiesData(res.data as unknown as Activity[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: areaMap.activity }) + ': ' + getErrorMessage(err));
    } finally {
      setActivityLoading(false);
    }
  };

  const activityEdit = (a: Activity) => { setActivityEditingId(a.activityId); setActivityForm({ ...a }); setActivityCreating(false); };
  const activityCreate = () => { setActivityCreating(true); setActivityEditingId(null); setActivityForm({ code: '', name: '', isActive: true }); };
  const activityCancel = () => { setActivityEditingId(null); setActivityCreating(false); };

  const activitySave = async () => {
    if (!activityForm.code || !activityForm.name) { toast.error(tCommon('errors.typeAndDateRequired')); return; }
    try {
      const payload = { 
        code: activityForm.code.toUpperCase(), 
        name: activityForm.name,
        isActive: activityForm.isActive ?? true 
      };
      if (activityEditingId) {
        await api.activitiesControllerUpdate(activityEditingId, payload);
        toast.success(tSettings('toasts.activityUpdated'));
      } else {
        await api.activitiesControllerCreate(payload);
        toast.success(tSettings('toasts.activityCreated'));
      }
      activityCancel(); loadActivities();
    } catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const activityDelete = async (id: string) => {
    if (!confirm(tSettings('confirmations.deleteActivity'))) return;
    try { 
      await api.activitiesControllerDelete(id); 
      toast.success(tSettings('toasts.activityDeleted')); 
      loadActivities(); 
    }
    catch (err: unknown) { toast.error(getErrorMessage(err)); }
  };

  const handleImportActivity = async (data: any[]) => {
    setIsImporting(true);
    try {
      const res = await api.activitiesControllerImport(data);
      const responseData = res.data;
      toast.success(tSettings('toasts.importSuccess', { count: responseData.count }));
      loadActivities();
    } catch (err: unknown) {
      toast.error(tSettings('toasts.importFailed', { message: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadTax();
    loadRates();
    loadGl();
    loadCcs();
    loadActivities();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const typeLabel = (type: string) => taxTypes.find(t => t.value === type)?.label ?? type;

  const renderGlAccountLabel = (glAccountId?: string) => {
    if (!glAccountId) return <span className="text-muted italic">{tCommon('notConfigured')}</span>;
    const acct = glAccounts.find(a => a.glAccountId === glAccountId);
    if (!acct) return <span className="text-muted italic text-xs font-mono">{glAccountId}</span>;
    return (
      <span className="font-medium text-sm flex items-center gap-2">
        <span className="badge badge-sm badge-secondary font-mono">{acct.accountCode}</span>
        {acct.name}
      </span>
    );
  };

  // ── Row Renderers ─────────────────────────────────────────────────────────

  const renderGlAccountSelect = (field: string, value?: string) => {
    return (
      <select 
        className="input" 
        value={value || ''} 
        onChange={(e) => updateGlSetting(field, e.target.value || null)}
      >
        <option value="">{tCommon('notConfigured')}</option>
        {glAccounts.filter(a => !a.isGroup).map(a => (
          <option key={a.glAccountId} value={a.glAccountId}>
            {a.accountCode} - {a.name}
          </option>
        ))}
      </select>
    );
  };

  const renderCoaRow = (isEdit: boolean, data: any, key: string) => (
    <Fragment key={key}>
      <tr style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
        <td style={{ paddingLeft: `${(data.depth || 0) * 20 + 8}px` }}>
          {isEdit && coaCreating
            ? <input className="input" value={coaForm.accountCode} onChange={e => setCoaForm({ ...coaForm, accountCode: e.target.value })} placeholder="Code" style={{ width: 100 }} />
            : <span className={`font-mono text-xs ${data.isGroup ? 'font-bold' : ''}`}>{data.accountCode}</span>}
        </td>
        <td>
          {isEdit
            ? <input className="input" value={coaForm.name} onChange={e => setCoaForm({ ...coaForm, name: e.target.value })} placeholder="Name" />
            : <span className={`${data.isGroup ? 'font-bold' : 'font-medium'} flex items-center gap-2`}>
                {data.isGroup ? (
                  <>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[16px]">folder</span>
                    { }
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[16px] text-muted">receipt_long</span>
                    { }
                  </>
                )}
                {data.name}
              </span>}
        </td>
        <td>
          {isEdit && coaCreating ? (
            <select className="input" disabled={!!coaForm.parentAccountId} value={coaForm.accountType} onChange={e => setCoaForm({ ...coaForm, accountType: e.target.value })}>
              {Object.values(GL_ACCOUNT_TYPE).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          ) : data.accountType}
        </td>
        <td style={{ textAlign: 'center' }}>
          {isEdit && coaCreating ? (
            <input type="checkbox" checked={coaForm.isGroup} onChange={e => setCoaForm({ ...coaForm, isGroup: e.target.checked })} />
          ) : data.isGroup ? (
            <>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>
              { }
            </>
          ) : null}
        </td>
        <td style={{ textAlign: 'center' }}>
          {isEdit ? (
            <input type="checkbox" checked={coaForm.isBankAccount} onChange={e => setCoaForm({ ...coaForm, isBankAccount: e.target.checked })} />
          ) : data.isBankAccount ? (
            <>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>
              { }
            </>
          ) : null}
        </td>
        <td style={{ textAlign: 'center' }}>
          {isEdit ? (
            <select 
              className="select" 
              value={coaForm.currencyCode || ''} 
              onChange={e => setCoaForm({ ...coaForm, currencyCode: e.target.value })}
              style={{ width: 90 }}
            >
              <option value="">-</option>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-xs text-muted">{data.currencyCode}</span>
          )}
        </td>
        <td style={{ textAlign: 'center' }}>
          {isEdit ? (
            <label className="switch" title={coaForm.isActive ? tSettings('labels.active') : tSettings('labels.inactive')}>
              <input type="checkbox" checked={coaForm.isActive} onChange={e => setCoaForm({ ...coaForm, isActive: e.target.checked })} />
              <span className="switch-slider"></span>
            </label>
          ) : (
            <span style={{ color: data.isActive ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', fontWeight: 'bold', fontSize: '0.75rem' }}>
              {data.isActive ? tSettings('labels.active').toUpperCase() : tSettings('labels.inactive').toUpperCase()}
            </span>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>
          {isEdit ? (
            <div className="flex justify-end gap-2 flex-nowrap whitespace-nowrap">
              <button className="btn btn-secondary btn-xs" onClick={coaCancel}>{tSettings('actions.cancel')}</button>
              <button className="btn btn-primary btn-xs" onClick={coaSave}>{tSettings('actions.save')}</button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 flex-nowrap whitespace-nowrap">
              {data.isGroup && <button className="btn btn-secondary btn-xs" onClick={() => coaCreate(data.glAccountId, data.accountType)}>{tSettings('actions.addChild')}</button>}
              <button className="btn btn-secondary btn-xs" onClick={() => coaEdit(data)}>{tSettings('actions.edit')}</button>
              {data.isSystem && <span className="text-xs text-muted italic px-2">{tCommon('system')}</span>}
            </div>
          )}
        </td>
      </tr>
      {isEdit && glSettings?.accountMetadataSchema?.type === 'object' && (
        <tr style={{ background: 'var(--bg-secondary)' }}>
          <td colSpan={6} style={{ padding: '16px 24px', borderTop: 'none' }}>
            <div className="card bg-[var(--bg-primary)] p-4 shadow-sm border border-[var(--border)]">
              <DynamicForm 
                schema={glSettings.accountMetadataSchema} 
                data={coaForm.metadata || {}} 
                onChange={(data) => setCoaForm({...coaForm, metadata: data})} 
              />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );

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
            {taxTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          <input type="checkbox" checked={taxForm.isDefault === true} onChange={e => setTaxForm({ ...taxForm, isDefault: e.target.checked })} />
        ) : data.isDefault ? (
          <>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--primary)' }}>check_circle</span>
            { }
          </>
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

  const renderCcRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit && ccCreating
          ? <input className="input" value={ccForm.code} onChange={e => setCcForm({ ...ccForm, code: e.target.value.toUpperCase() })} placeholder={tSettings('placeholders.ccCode')} style={{ width: 100 }} />
          : <span className="font-mono text-xs">{data.code}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={ccForm.name} onChange={e => setCcForm({ ...ccForm, name: e.target.value })} placeholder={tSettings('placeholders.ccName')} />
          : <span className="font-medium">{data.name}</span>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {isEdit ? (
          <label className="switch" title={ccForm.isActive ? tSettings('labels.active') : tSettings('labels.inactive')}>
            <input type="checkbox" checked={ccForm.isActive} onChange={e => setCcForm({...ccForm, isActive: e.target.checked})} />
            <span className="switch-slider"></span>
          </label>
        ) : (
          <span style={{ color: data.isActive ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', fontWeight: 'bold', fontSize: '0.75rem' }}>
            {data.isActive ? tSettings('labels.active').toUpperCase() : tSettings('labels.inactive').toUpperCase()}
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={ccCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={ccSave}>{tSettings('actions.save')}</button>
          </div>

        ) : (
          <div className="flex justify-end gap-2">
            {!data.isSystem && (
              <>
                <button className="btn btn-secondary btn-xs" onClick={() => ccEdit(data)}>{tSettings('actions.edit')}</button>
                <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => ccDelete(data.costCenterId)}>{tSettings('actions.delete')}</button>
              </>
            )}
            {data.isSystem && <span className="text-xs text-muted italic px-2">{tCommon('system')}</span>}
          </div>
        )}
      </td>
    </tr>
  );

  const renderActivityRow = (isEdit: boolean, data: any, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      <td>
        {isEdit && activityCreating
          ? <input className="input" value={activityForm.code} onChange={e => setActivityForm({ ...activityForm, code: e.target.value.toUpperCase() })} placeholder={tSettings('placeholders.activityCode')} style={{ width: 100 }} />
          : <span className="font-mono text-xs">{data.code}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })} placeholder={tSettings('placeholders.activityName')} />
          : <span className="font-medium">{data.name}</span>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {isEdit ? (
          <label className="switch" title={activityForm.isActive ? tSettings('labels.active') : tSettings('labels.inactive')}>
            <input type="checkbox" checked={activityForm.isActive} onChange={e => setActivityForm({...activityForm, isActive: e.target.checked})} />
            <span className="switch-slider"></span>
          </label>
        ) : (
          <span style={{ color: data.isActive ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', fontWeight: 'bold', fontSize: '0.75rem' }}>
            {data.isActive ? tSettings('labels.active').toUpperCase() : tSettings('labels.inactive').toUpperCase()}
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={activityCancel}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary btn-xs" onClick={activitySave}>{tSettings('actions.save')}</button>
          </div>

        ) : (
          <div className="flex justify-end gap-2">
            {!data.isSystem && (
              <>
                <button className="btn btn-secondary btn-xs" onClick={() => activityEdit(data)}>{tSettings('actions.edit')}</button>
                <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => activityDelete(data.activityId)}>{tSettings('actions.delete')}</button>
              </>
            )}
            {data.isSystem && <span className="text-xs text-muted italic px-2">{tCommon('system')}</span>}
          </div>
        )}
      </td>
    </tr>
  );

  const navSections = useMemo(() => [
    { id: 'gl-section', label: tSettings('sections.gl'), show: true },
    { id: 'tax-section', label: tSettings('sections.tax'), show: true },
    { id: 'rates-section', label: tSettings('sections.rates'), show: true },
    { id: 'cc-section', label: tSettings('sections.costCenters'), show: true },
    { id: 'activity-section', label: tSettings('sections.activities'), show: true },
  ], [tSettings]);

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={tSettings('title') + ' - ' + tCommon('financial')}
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
        {/* ── General Ledger ────────────────────────────────────────── */}
        <div id="gl-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">account_balance_wallet</span>
              {tSettings('sections.gl')}
            </h3>
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
                  {renderGlAccountSelect('defaultArAccountId', glSettings?.defaultArAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultRevenue')}
                  </label>
                  {renderGlAccountSelect('defaultRevenueAccountId', glSettings?.defaultRevenueAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultAp')}
                  </label>
                  {renderGlAccountSelect('defaultApAccountId', glSettings?.defaultApAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultTax')}
                  </label>
                  {renderGlAccountSelect('defaultTaxAccountId', glSettings?.defaultTaxAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultCogs')}
                  </label>
                  {renderGlAccountSelect('defaultCogsAccountId', glSettings?.defaultCogsAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultExpense')}
                  </label>
                  {renderGlAccountSelect('defaultExpenseAccountId', glSettings?.defaultExpenseAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultInventory')}
                  </label>
                  {renderGlAccountSelect('defaultInventoryAccountId', glSettings?.defaultInventoryAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultGrni')}
                  </label>
                  {renderGlAccountSelect('defaultGrniAccountId', glSettings?.defaultGrniAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultShrinkage')}
                  </label>
                  {renderGlAccountSelect('defaultShrinkageAccountId', glSettings?.defaultShrinkageAccountId)}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.defaultFeeRevenue')}
                  </label>
                  {renderGlAccountSelect('defaultFeeRevenueAccountId', glSettings?.defaultFeeRevenueAccountId)}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.baseCurrency')}
                  </label>
                  <select 
                    className="input max-w-sm" 
                    value={glSettings?.baseCurrency || ''} 
                    onChange={(e) => updateGlSetting('baseCurrency', e.target.value)}
                  >
                    <option value="">{tCommon('notConfigured')}</option>
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.revenueRouting')}
                  </label>
                  <select 
                    className="input max-w-sm" 
                    value={glSettings?.revenueRoutingPrecedence || ''} 
                    onChange={(e) => updateGlSetting('revenueRoutingPrecedence', e.target.value)}
                  >
                    <option value="customer_first">{tSettings('gl.customerFirst')}</option>
                    <option value="product_first">{tSettings('gl.productFirst')}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tSettings('labels.expenseRouting')}
                  </label>
                  <select 
                    className="input max-w-sm" 
                    value={glSettings?.expenseRoutingPrecedence || ''} 
                    onChange={(e) => updateGlSetting('expenseRoutingPrecedence', e.target.value)}
                  >
                    <option value="supplier_first">{tSettings('gl.supplierFirst')}</option>
                    <option value="product_first">{tSettings('gl.productFirst')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Chart of Accounts ────────────────────────────────────────── */}
        <div id="coa-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">account_tree</span>
              {tSettings('labels.chartOfAccounts')}
            </h3>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-xs" onClick={() => setImportCoaModalOpen(true)}>{tSettings('importCoaModal.importAction')}</button>
              <button className="btn btn-secondary btn-xs" onClick={openSchemaEditor}>{tSettings('actions.configureMetadata')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => coaCreate(undefined, undefined, true)}>{tSettings('actions.addRootGroup')}</button>
            </div>
          </div>

          <table className="table-lines w-full">
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>{tSettings('labels.code')}</th>
                      <th>{tSettings('labels.name')}</th>
                      <th style={{ width: 140 }}>{tSettings('labels.type')}</th>
                      <th style={{ width: 60, textAlign: 'center' }}>{tSettings('labels.group')}</th>
                      <th style={{ width: 60, textAlign: 'center' }}>{tSettings('labels.bank')}</th>
                      <th style={{ width: 90, textAlign: 'center' }}>{tSettings('labels.currency')}</th>
                      <th style={{ width: 100, textAlign: 'center' }}>{tSettings('labels.status')}</th>
                      <th style={{ width: 260, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaCreating && !coaForm.parentAccountId && renderCoaRow(true, coaForm, 'new-root')}
                    {coaTree.map(acct =>
                      <Fragment key={acct.glAccountId}>
                        {coaEditingId === acct.glAccountId
                          ? renderCoaRow(true, acct, acct.glAccountId)
                          : renderCoaRow(false, acct, acct.glAccountId)
                        }
                        {coaCreating && coaForm.parentAccountId === acct.glAccountId && renderCoaRow(true, coaForm, 'new-child')}
                      </Fragment>
                    )}
                  </tbody>
                </table>
        </div>

        {/* ── Tax Categories ─────────────────────────────────────────────── */}
        <div id="tax-section" className="card relative">
          <InlineSettingsTable
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">payments</span>
                {tSettings('sections.tax')}
              </h3>
            }
            headerActions={
              <button className="btn btn-secondary btn-sm" onClick={() => setImportTaxModalOpen(true)}>
                {tSettings('actions.importSettings')}
              </button>
            }
            data={categories || []}
            rowKey={(r: any) => r.taxCategoryId}
            onSave={async (row: any, isNew: boolean) => {
              if (!row.code || !row.title || !row.type || row.rate === undefined || row.rate === '') {
                throw new Error(tCommon('errors.typeAndDateRequired'));
              }
              const payload = {
                code: row.code.toUpperCase(),
                title: row.title,
                type: row.type,
                rate: row.rate,
                isDefault: row.isDefault,
                exemptionReason: row.exemptionReason
              };
              if (isNew) {
                await api.taxCategoriesControllerCreate(payload);
                toast.success(tSettings('toasts.taxCreated') || 'Tax created');
              } else {
                await api.taxCategoriesControllerUpdate(row.taxCategoryId, payload);
                toast.success(tSettings('toasts.taxUpdated') || 'Tax updated');
              }
              loadTax();
            }}
            onDelete={async (row: any) => {
              if (!confirm(tSettings('confirmations.deleteTax', { title: row.title }) || 'Are you sure you want to delete this tax?')) return;
              await api.taxCategoriesControllerRemove(row.taxCategoryId);
              toast.success(tSettings('toasts.taxDeleted') || 'Tax deleted');
              loadTax();
            }}
            onAdd={() => ({ code: '', title: '', type: 'percentage', rate: 0, isDefault: false } as unknown as TaxCategory)}
            canEdit={() => true}
            canDelete={() => true}
            addLabel={tSettings('actions.create')}
            emptyLabel={tSettings('tax.empty')}
            columns={[
              {
                key: 'code',
                title: tSettings('labels.code'),
                type: 'text',
                width: 120,
                validate: (v: any) => v ? null : 'Required'
              },
              {
                key: 'title',
                title: tSettings('labels.title'),
                type: 'text',
                validate: (v: any) => v ? null : 'Required'
              },
              {
                key: 'type',
                title: tSettings('labels.type'),
                type: 'select',
                width: 140,
                options: [
                  { value: 'percentage', label: tSettings('tax.percentage') || 'Percentage' },
                  { value: 'fixed', label: tSettings('tax.fixed') || 'Fixed' },
                  { value: 'exempt', label: tSettings('tax.exempt') || 'Exempt' }
                ],
                render: (row: any, isEditing: boolean) => {
                  if (isEditing) return null; // handled by component
                  return <span className="bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-0.5 rounded text-xs">{row.type}</span>;
                }
              },
              {
                key: 'rate',
                title: tSettings('labels.rate'),
                type: 'text',
                width: 100,
                validate: (v: any) => (v !== '' && v !== null && v !== undefined) ? null : 'Required'
              },
              {
                key: 'isDefault',
                title: tSettings('labels.isDefault'),
                type: 'boolean' as const,
                width: 100
              }
            ]}
          />
        </div>

        {/* ── Exchange Rates ─────────────────────────────────────────────── */}
        <div id="rates-section" className="card relative">
          <InlineSettingsTable
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">currency_exchange</span>
                {tSettings('sections.rates')}
              </h3>
            }
            data={ratesWithBase}
            rowKey={(r: any) => r.exchangeRateId || r.currencyCode}
            onSave={async (row: any, isNew: boolean) => {
              if (!row.currencyCode || !row.effectiveDate || !row.buyRate || !row.sellRate) {
                throw new Error(tCommon('errors.typeAndDateRequired'));
              }
              const payload = {
                currencyCode: row.currencyCode.toUpperCase(),
                currencyName: row.currencyName || row.currencyCode.toUpperCase(),
                effectiveDate: row.effectiveDate,
                buyRate: row.buyRate,
                sellRate: row.sellRate
              };
              if (isNew) {
                await api.exchangeRatesControllerCreate(payload);
                toast.success(tSettings('toasts.rateCreated') || 'Rate created');
              } else {
                await api.exchangeRatesControllerUpdate(row.exchangeRateId, payload);
                toast.success(tSettings('toasts.rateUpdated') || 'Rate updated');
              }
              loadRates();
            }}
            onDelete={async (row: any) => {
              if (!confirm(tSettings('confirmations.deleteRate') || 'Are you sure you want to delete this rate?')) return;
              await api.exchangeRatesControllerRemove(row.exchangeRateId);
              toast.success(tSettings('toasts.rateDeleted') || 'Rate deleted');
              loadRates();
            }}
            onAdd={() => ({ currencyCode: '', currencyName: '', effectiveDate: new Date().toISOString().split('T')[0], buyRate: 1.0, sellRate: 1.0 } as unknown as ExchangeRate)}
            canEdit={(row: any) => !row.isSystemBase}
            canDelete={(row: any) => !row.isSystemBase}
            addLabel={tSettings('actions.create')}
            emptyLabel={tSettings('rates.empty')}
            columns={[
              {
                key: 'currencyCode',
                title: tSettings('labels.currencyCode'),
                type: 'text',
                width: 100,
                validate: (v: any) => v ? null : 'Required',
                render: (row: any, isEditing: boolean) => {
                  if (isEditing) return null;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className={row.isSystemBase ? 'font-medium' : ''}>{row.currencyCode}</span>
                      {row.isSystemBase && <span className="text-[10px] uppercase tracking-wider text-muted font-bold opacity-60">BASE</span>}
                    </div>
                  );
                }
              },
              {
                key: 'currencyName',
                title: tSettings('labels.currencyName'),
                type: 'text',
                validate: (v: any) => v ? null : 'Required'
              },
              {
                key: 'effectiveDate',
                title: tSettings('labels.effectiveDate'),
                type: 'text',
                width: 150,
                validate: (v: any) => v ? null : 'Required',
                render: (row: any, isEditing: boolean) => {
                  if (isEditing) return null;
                  if (row.isSystemBase) return <span className="text-xs italic text-muted">{tSettings('labels.systemBase')}</span>;
                  return <span>{new Date(row.effectiveDate).toLocaleDateString()}</span>;
                }
              },
              {
                key: 'buyRate',
                title: tSettings('labels.buyRate'),
                type: 'text',
                width: 110,
                validate: (v: any) => (v !== '' && v !== null && v !== undefined) ? null : 'Required'
              },
              {
                key: 'sellRate',
                title: tSettings('labels.sellRate'),
                type: 'text',
                width: 110,
                validate: (v: any) => (v !== '' && v !== null && v !== undefined) ? null : 'Required'
              }
            ]}
          />
        </div>

        {/* ── Cost Centers ─────────────────────────────────────────────────── */}
        <div id="cc-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">folder_shared</span>
              {tSettings('sections.costCenters')}
            </h3>
            <div className="flex items-center gap-2">
              <CsvImportButton onImport={handleImportCc} disabled={isImporting} />
              <button className="btn btn-primary btn-sm" onClick={ccCreate}>{tSettings('actions.create')}</button>
            </div>
          </div>
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 120 }}>{tSettings('labels.code')}</th>
                <th>{tSettings('labels.name')}</th>
                <th style={{ width: 120, textAlign: 'center' }}>{tSettings('labels.status')}</th>
                <th style={{ width: 150, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {ccCreating && renderCcRow(true, ccForm, 'new-cc')}
              {!ccLoading && ccs.length === 0 && !ccCreating && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('costCenters.empty')}</td></tr>
              )}

              {ccs.map(cc =>
                ccEditingId === cc.costCenterId
                  ? renderCcRow(true, cc, cc.costCenterId)
                  : renderCcRow(false, cc, cc.costCenterId)
              )}
            </tbody>
          </table>
        </div>

        {/* ── Activities ───────────────────────────────────────────────────── */}
        <div id="activity-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">account_tree</span>
              {tSettings('sections.activities')}
            </h3>
            <div className="flex items-center gap-2">
              <CsvImportButton onImport={handleImportActivity} disabled={isImporting} />
              <button className="btn btn-primary btn-sm" onClick={activityCreate}>{tSettings('actions.create')}</button>
            </div>
          </div>
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ width: 120 }}>{tSettings('labels.code')}</th>
                <th>{tSettings('labels.name')}</th>
                <th style={{ width: 120, textAlign: 'center' }}>{tSettings('labels.status')}</th>
                <th style={{ width: 150, textAlign: 'right' }}>{tSettings('actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {activityCreating && renderActivityRow(true, activityForm, 'new-activity')}
              {!activityLoading && activitiesData.length === 0 && !activityCreating && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('activities.empty')}</td></tr>
              )}

              {activitiesData.map(a =>
                activityEditingId === a.activityId
                  ? renderActivityRow(true, a, a.activityId)
                  : renderActivityRow(false, a, a.activityId)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        isOpen={schemaEditorOpen}
        onClose={() => setSchemaEditorOpen(false)}
        title={tSettings('labels.configureMetadataSchema')}
        width="max-w-2xl"
      >
        <div className="p-4 flex flex-col gap-6">
          <SchemaBuilder 
            value={schemaObj} 
            onChange={setSchemaObj} 
          />

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <button className="btn btn-secondary" onClick={() => setSchemaEditorOpen(false)}>{tSettings('actions.cancel')}</button>
            <button className="btn btn-primary" onClick={saveSchema}>{tSettings('actions.saveSchema')}</button>
          </div>
        </div>
      </SlideOver>

      {importCoaModalOpen && (
        <ImportCoaModal
          isOpen={importCoaModalOpen}
          onClose={() => setImportCoaModalOpen(false)}
          onImportComplete={loadGl}
        />
      )}

      {importTaxModalOpen && (
        <ImportTaxModal
          isOpen={importTaxModalOpen}
          onClose={() => setImportTaxModalOpen(false)}
          onImportComplete={loadTax}
        />
      )}
    </DetailsLayout>
  );
}
