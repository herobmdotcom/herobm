import { useState, useEffect, Fragment } from 'react';
import { Button } from '@/components/shared/Button';
import CsvImportButton from '@/components/shared/CsvImportButton';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { useTranslations } from 'next-intl';

export interface Activity {
  [key: string]: unknown;
  activityId: string;
  code: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

interface ActivitiesSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  glSettings: Record<string, any> | null;
  updateGlSetting: (field: string, value: unknown) => void;
}

export function ActivitiesSection({ glSettings, updateGlSetting }: ActivitiesSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const [activitiesData, setActivitiesData] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityEditingId, setActivityEditingId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState<Partial<api.ActivityResponseDto>>({});
  const [activityCreating, setActivityCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadActivities = async () => {
    try {
      setActivityLoading(true);
      const res = await api.activitiesControllerFindAll();
      setActivitiesData(res.data as unknown as Activity[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.activities') }) + ': ' + getErrorMessage(err));
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  const handleImportActivity = async (data: Record<string, any>[]) => {
    setIsImporting(true);
    try {
      const res = await api.activitiesControllerImport(data as unknown as api.CreateActivityDto[]);
      const responseData = res.data;
      toast.success(tSettings('toasts.importSuccess', { count: responseData.count }));
      loadActivities();
    } catch (err: unknown) {
      toast.error(tSettings('toasts.importFailed', { message: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  const renderActivityRow = (isEdit: boolean, data: Activity, key: string) => (
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
            <Button variant="secondary" size="xs" onClick={activityCancel}>{tSettings('actions.cancel')}</Button>
            <Button variant="primary" size="xs" onClick={activitySave}>{tSettings('actions.save')}</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {!data.isSystem && (
              <>
                <Button variant="secondary" size="xs" className="flex items-center justify-center" title={tSettings('actions.edit')} onClick={() => activityEdit(data)}>
                  { }
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                </Button>
                <Button variant="secondary" size="xs" className="flex items-center justify-center hover:!bg-red-50" style={{ color: '#ef4444', borderColor: '#ef4444' }} title={tSettings('actions.delete')} onClick={() => activityDelete(data.activityId)}>
                  { }
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
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
    <div id="activity-section" className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading !mb-0">
          {''}
          {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
          <span className="material-symbols-outlined">{'account_tree'}</span>
          {''}
          <span>{tSettings('financialSettings.activities')}</span>
        </h3>
        <div className="flex items-center gap-2">
          <CsvImportButton onImport={handleImportActivity} disabled={isImporting} />
          <Button variant="primary" size="sm" onClick={activityCreate}>{tSettings('actions.create')}</Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-1 max-w-sm">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Default Activity
        </label>
        <select 
          className="input w-full" 
          value={(glSettings?.defaultActivityId as string) || ''} 
          onChange={(e) => updateGlSetting('defaultActivityId', e.target.value)}
        >
          <option value="">{tCommon('notConfigured')}</option>
          {activitiesData.map(act => (
            <option key={act.activityId} value={act.activityId}>{act.code} - {act.name}</option>
          ))}
        </select>
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
          {activityCreating && renderActivityRow(true, activityForm as Activity, 'new-activity')}
          {!activityLoading && activitiesData.length === 0 && !activityCreating && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>{tSettings('activities.empty')}</td></tr>
          )}

          {activitiesData.map((a, idx) =>
            <Fragment key={a.activityId || `act-${idx}`}>
              {activityEditingId === a.activityId
                ? renderActivityRow(true, a, a.activityId || `act-${idx}`)
                : renderActivityRow(false, a, a.activityId || `act-${idx}`)}
            </Fragment>
          )}
        </tbody>
      </table>
    </div>
  );
}
