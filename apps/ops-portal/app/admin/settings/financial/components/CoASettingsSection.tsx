import { useState, useMemo, Fragment } from 'react';
import { Button } from '@/components/shared/Button';
import { SchemaBuilder } from '@/components/SchemaBuilder';
import { DynamicForm } from '@/components/DynamicForm';
import SlideOver from '@/components/shared/SlideOver';
import ImportCoaModal from '../ImportCoaModal';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage, CURRENCIES, GL_ACCOUNT_TYPE } from '@herobm/shared';
import { useTranslations } from 'next-intl';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
type CoaData = api.GlAccountResponseDto & { depth?: number; metadata?: Record<string, any>; isSystem?: boolean; isBankAccount?: boolean; currencyCode?: string; isActive?: boolean; accountType?: string };

interface CoASettingsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  glSettings: Record<string, any> | null;
  updateGlSetting: (field: string, value: unknown) => Promise<void>;
  glAccounts: api.GlAccountResponseDto[];
  loadGl: () => Promise<void>;
}

export function CoASettingsSection({ glSettings, updateGlSetting, glAccounts, loadGl }: CoASettingsSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  const [schemaObj, setSchemaObj] = useState<Record<string, any>>(glSettings?.accountMetadataSchema || { type: 'object', properties: {} });
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  const [viewMetadataObj, setViewMetadataObj] = useState<Record<string, any> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  const [coaForm, setCoaForm] = useState<Record<string, any>>({});
  const [coaCreating, setCoaCreating] = useState(false);
  const [coaEditingId, setCoaEditingId] = useState<string | null>(null);
  const [importCoaModalOpen, setImportCoaModalOpen] = useState(false);

  const coaTree = useMemo(() => {
    const map = new Map<string | null, CoaData[]>();
    for (const acct of glAccounts) {
      const parentId = acct.parentAccountId || null;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(acct);
    }
    const build = (parentId: string | null, depth: number = 0): CoaData[] => {
      const children = map.get(parentId) || [];
      const result: CoaData[] = [];
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

  const saveSchema = async () => {
    try {
      await updateGlSetting('accountMetadataSchema', schemaObj);
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
      const payload = { ...coaForm } as unknown as api.CreateAccountRequestDto;
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

  const renderCoaRow = (isEdit: boolean, data: Partial<CoaData>, key: string) => {
    const defaultLabels: string[] = [];
    if (glSettings && data.glAccountId) {
      if (glSettings.defaultArAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultAr'));
      if (glSettings.defaultRevenueAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultRevenue'));
      if (glSettings.defaultApAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultAp'));
      if (glSettings.defaultExpenseAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultExpense'));
      if (glSettings.defaultInventoryAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultInventory'));
      if (glSettings.defaultCogsAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultCogs'));
      if (glSettings.defaultGrniAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultGrni'));
      if (glSettings.defaultShrinkageAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultShrinkage'));
      if (glSettings.defaultFeeRevenueAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultFeeRevenue'));
      if (glSettings.defaultDiscountsReceivedAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultDiscountsReceived'));
      if (glSettings.defaultSalesTaxAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultSalesTax'));
      if (glSettings.defaultPurchaseTaxAccountId === data.glAccountId) defaultLabels.push(tSettings('labels.defaultPurchaseTax'));
    }

    return (
      <Fragment key={key}>
        <tr className={isEdit ? 'bg-[var(--bg-secondary)]' : undefined}>
          <td style={{ paddingLeft: `${(data.depth || 0) * 20 + 8}px` }}>
            {isEdit && coaCreating
              ? <input className="input w-[100px]" value={coaForm.accountCode} onChange={e => setCoaForm({ ...coaForm, accountCode: e.target.value })} placeholder="Code" />
              : <span className={`font-mono text-xs ${data.isGroup ? 'font-bold' : ''}`}>{data.accountCode}</span>}
          </td>
          <td>
            {isEdit
              ? <input className="input" value={coaForm.name} onChange={e => setCoaForm({ ...coaForm, name: e.target.value })} placeholder="Name" />
              : <span className={`${data.isGroup ? 'font-bold' : 'font-medium'} flex items-center gap-2`}>
                  {data.isGroup ? (
                    <>
                      { }
                      {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
                      <span className="material-symbols-outlined text-[16px]">{'folder'}</span>
                      { }
                    </>
                  ) : (
                    <>
                      { }
                      {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
                      <span className="material-symbols-outlined text-[16px] text-muted">{'receipt_long'}</span>
                      { }
                    </>
                  )}
                  {defaultLabels.length > 0 ? (
                    <span 
                      className="underline decoration-dotted underline-offset-4 cursor-help"
                      title={defaultLabels.join(', ')}
                    >
                      {data.name}
                    </span>
                  ) : (
                    <span>{data.name}</span>
                  )}
                </span>}
          </td>
        <td>
          {isEdit && coaCreating ? (
            <select className="input" disabled={!!coaForm.parentAccountId} value={coaForm.accountType} onChange={e => setCoaForm({ ...coaForm, accountType: e.target.value })}>
              {Object.values(GL_ACCOUNT_TYPE).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          ) : data.accountType}
        </td>
        <td className="text-center">
          {isEdit && coaCreating ? (
            <input type="checkbox" checked={coaForm.isGroup} onChange={e => setCoaForm({ ...coaForm, isGroup: e.target.checked })} />
          ) : data.isGroup ? (
            <>
              { }
              {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
              <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">{'check'}</span>
              { }
            </>
          ) : null}
        </td>
        <td className="text-center">
          {isEdit ? (
            <input type="checkbox" checked={coaForm.isBankAccount} onChange={e => setCoaForm({ ...coaForm, isBankAccount: e.target.checked })} />
          ) : data.isBankAccount ? (
            <>
              { }
              {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
              <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">{'check'}</span>
              { }
            </>
          ) : null}
        </td>
        <td className="text-center">
          {isEdit ? (
            <select 
              className="select w-[90px]" 
              value={coaForm.currencyCode || ''} 
              onChange={e => setCoaForm({ ...coaForm, currencyCode: e.target.value })}
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
        <td className="text-center">
          {isEdit ? (
            <label className="switch" title={coaForm.isActive ? tSettings('labels.active') : tSettings('labels.inactive')}>
              <input type="checkbox" checked={coaForm.isActive} onChange={e => setCoaForm({ ...coaForm, isActive: e.target.checked })} />
              <span className="switch-slider"></span>
            </label>
          ) : (
            <span className={`font-bold text-xs ${data.isActive ? 'text-[var(--success,#22c55e)]' : 'text-[var(--danger,#ef4444)]'}`}>
              {data.isActive ? tSettings('labels.active').toUpperCase() : tSettings('labels.inactive').toUpperCase()}
            </span>
          )}
        </td>
        <td className="text-right">
          {isEdit ? (
            <div className="flex justify-end gap-2 flex-nowrap whitespace-nowrap">
              <Button variant="secondary" size="xs" onClick={coaCancel}>{tSettings('actions.cancel')}</Button>
              <Button variant="primary" size="xs" onClick={coaSave}>{tSettings('actions.save')}</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 flex-nowrap whitespace-nowrap">
              {data.isGroup && <Button variant="secondary" size="xs" onClick={() => coaCreate(data.glAccountId, data.accountType)}>{tSettings('actions.addChild')}</Button>}
              <Button variant="secondary" size="xs" className="flex items-center justify-center" title={tSettings('actions.edit')} onClick={() => coaEdit(data)}>
                { }
                <span className="material-symbols-outlined text-base">edit</span>
              </Button>
              {Object.keys(data.metadata || {}).length > 0 && (
                <Button variant="secondary" size="xs" onClick={() => setViewMetadataObj(data)}>
                  {tSettings('actions.viewMetadata')}
                </Button>
              )}
              {data.isSystem && <span className="text-xs text-muted italic px-2">{tCommon('system')}</span>}
            </div>
          )}
        </td>
      </tr>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon */}
      {isEdit && (glSettings?.accountMetadataSchema as Record<string, any>)?.type === 'object' && (
        <tr className="bg-[var(--bg-secondary)]">
          <td colSpan={6} className="px-6 py-4 border-t-0">
            <div className="card bg-[var(--bg-primary)] p-4 border border-[var(--border)]">
              <DynamicForm 
                schema={glSettings!.accountMetadataSchema as Record<string, unknown>} 
                data={coaForm.metadata || {}} 
                onChange={(data) => setCoaForm({...coaForm, metadata: data})} 
              />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
    );
  };

  return (
    <>
      <div id="coa-section" className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-heading !mb-0">
            {''}
            {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
            <span className="material-symbols-outlined">{'account_tree'}</span>
            {''}
            <span>{tSettings('financialSettings.accounts')}</span>
          </h3>
          <div className="flex gap-2">
            <Button variant="secondary" size="xs" onClick={() => setImportCoaModalOpen(true)}>{tSettings('importCoaModal.importAction')}</Button>
            <Button variant="secondary" size="xs" onClick={openSchemaEditor}>{tSettings('actions.configureMetadata')}</Button>
            <Button variant="primary" size="sm" onClick={() => coaCreate(undefined, undefined, true)}>{tSettings('actions.addRootGroup')}</Button>
          </div>
        </div>

        <table className="table-lines w-full">
          <thead>
            <tr>
              <th className="w-[180px]">{tSettings('labels.code')}</th>
              <th>{tSettings('labels.name')}</th>
              <th className="w-[140px]">{tSettings('labels.type')}</th>
              <th className="w-[60px] text-center">{tSettings('labels.group')}</th>
              <th className="w-[60px] text-center">{tSettings('labels.bank')}</th>
              <th className="w-[90px] text-center">{tSettings('labels.currency')}</th>
              <th className="w-[100px] text-center">{tSettings('labels.status')}</th>
              <th className="w-[260px] text-right">{tSettings('actions.actions')}</th>
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
            <Button variant="secondary" onClick={() => setSchemaEditorOpen(false)}>{tSettings('actions.cancel')}</Button>
            <Button variant="primary" onClick={saveSchema}>{tSettings('actions.saveSchema')}</Button>
          </div>
        </div>
      </SlideOver>

      <SlideOver
        isOpen={!!viewMetadataObj}
        onClose={() => setViewMetadataObj(null)}
        title="Account Metadata"
      >
        <div className="p-4">
          <pre className="text-xs bg-[var(--bg-secondary)] p-4 rounded-lg overflow-auto border border-[var(--border)]">
            {JSON.stringify(viewMetadataObj?.metadata, null, 2)}
          </pre>
        </div>
      </SlideOver>

      {importCoaModalOpen && (
        <ImportCoaModal
          isOpen={importCoaModalOpen}
          onClose={() => setImportCoaModalOpen(false)}
          onImportComplete={loadGl}
        />
      )}
    </>
  );
}
