import { useState, useEffect, Fragment } from 'react';
import { Button } from '@/components/shared/Button';
import CsvImportButton from '@/components/shared/CsvImportButton';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { useTranslations } from 'next-intl';

export interface CostCenter {
  [key: string]: unknown;
  costCenterId: string;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

interface CostCentersSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  glSettings: Record<string, any> | null;
  updateGlSetting: (field: string, value: unknown) => void;
}

export function CostCentersSection({ glSettings, updateGlSetting }: CostCentersSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const [ccs, setCcs] = useState<CostCenter[]>([]);
  const [ccLoading, setCcLoading] = useState(true);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [ccForm, setCcForm] = useState<Partial<api.CostCenterResponseDto>>({});
  const [ccCreating, setCcCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadCcs = async () => {
    try {
      setCcLoading(true);
      const res = await api.costCentersControllerFindAll();
      setCcs(res.data as unknown as CostCenter[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.costCenters') }) + ': ' + getErrorMessage(err));
    } finally {
      setCcLoading(false);
    }
  };

  useEffect(() => {
    loadCcs();
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  const handleImportCc = async (data: Record<string, any>[]) => {
    setIsImporting(true);
    try {
      const res = await api.costCentersControllerImport(data as unknown as api.CreateCostCenterDto[]);
      const responseData = res.data;
      toast.success(tSettings('toasts.importSuccess', { count: responseData.count }));
      loadCcs();
    } catch (err: unknown) {
      toast.error(tSettings('toasts.importFailed', { message: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  const renderCcRow = (isEdit: boolean, data: CostCenter, key: string) => (
    <tr key={key} className={isEdit ? 'bg-[var(--bg-secondary)]' : undefined}>
      <td>
        {isEdit && ccCreating
          ? <input className="input w-[100px]" value={ccForm.code} onChange={e => setCcForm({ ...ccForm, code: e.target.value.toUpperCase() })} placeholder={tSettings('placeholders.ccCode')} />
          : <span className="font-mono text-xs">{data.code}</span>}
      </td>
      <td>
        {isEdit
          ? <input className="input" value={ccForm.name} onChange={e => setCcForm({ ...ccForm, name: e.target.value })} placeholder={tSettings('placeholders.ccName')} />
          : <span className="font-medium">{data.name}</span>}
      </td>
      <td className="text-center">
        {isEdit ? (
          <label className="switch" title={ccForm.isActive ? tSettings('labels.active') : tSettings('labels.inactive')}>
            <input type="checkbox" checked={ccForm.isActive} onChange={e => setCcForm({...ccForm, isActive: e.target.checked})} />
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
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="xs" onClick={ccCancel}>{tSettings('actions.cancel')}</Button>
            <Button variant="primary" size="xs" onClick={ccSave}>{tSettings('actions.save')}</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {!data.isSystem && (
              <>
                <Button variant="secondary" size="xs" className="flex items-center justify-center" title={tSettings('actions.edit')} onClick={() => ccEdit(data)}>
                  { }
                  <span className="material-symbols-outlined text-base">edit</span>
                </Button>
                <Button variant="secondary" size="xs" className="flex items-center justify-center hover:!bg-red-50 text-red-500 border-red-500" title={tSettings('actions.delete')} onClick={() => ccDelete(data.costCenterId)}>
                  { }
                  <span className="material-symbols-outlined text-base">delete</span>
                </Button>
              </>
            )}
            {data.isSystem && <span className="text-xs text-muted italic px-2">{tCommon('system')}</span>}
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <div id="cc-section" className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading !mb-0">
          {''}
          {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
          <span className="material-symbols-outlined">{'folder_shared'}</span>
          {''}
          <span>{tSettings('financialSettings.costCenters')}</span>
        </h3>
        <div className="flex items-center gap-2">
          <CsvImportButton onImport={handleImportCc} disabled={isImporting} />
          <Button variant="primary" size="sm" onClick={ccCreate}>{tSettings('actions.create')}</Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-1 max-w-sm">
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          Default Cost Center
        </label>
        <select 
          className="input w-full" 
          value={(glSettings?.defaultCostCenterId as string) || ''} 
          onChange={(e) => updateGlSetting('defaultCostCenterId', e.target.value)}
        >
          <option value="">{tCommon('notConfigured')}</option>
          {ccs.map(cc => (
            <option key={cc.costCenterId} value={cc.costCenterId}>{cc.code} - {cc.name}</option>
          ))}
        </select>
      </div>

      <table className="table-lines w-full">
        <thead>
          <tr>
            <th className="w-[120px]">{tSettings('labels.code')}</th>
            <th>{tSettings('labels.name')}</th>
            <th className="w-[120px] text-center">{tSettings('labels.status')}</th>
            <th className="w-[150px] text-right">{tSettings('actions.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {ccCreating && renderCcRow(true, ccForm as CostCenter, 'new-cc')}
          {!ccLoading && ccs.length === 0 && !ccCreating && (
            <tr><td colSpan={4} className="text-center py-7 text-[var(--text-muted)]">{tSettings('costCenters.empty')}</td></tr>
          )}

          {ccs.map((cc, idx) =>
            <Fragment key={cc.costCenterId || `cc-${idx}`}>
              {ccEditingId === cc.costCenterId
                ? renderCcRow(true, cc, cc.costCenterId || `cc-${idx}`)
                : renderCcRow(false, cc, cc.costCenterId || `cc-${idx}`)}
            </Fragment>
          )}
        </tbody>
      </table>
    </div>
  );
}
