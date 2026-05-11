'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export default function ProductGroupsAdmin() {
  const t = useTranslations('admin.productGroups');
  const tc = useTranslations('admin.common');
  const t_gen = useTranslations('common');
  
  useDocumentTitle(t('title'));
  
  const [groups, setGroups] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const renderGlAccountLabel = (id: string | null | undefined) => {
    if (!id) return <span className="text-muted text-xs italic">{tc('notConfigured')}</span>;
    const acct = glAccounts.find((a: any) => a.glAccountId === id);
    return acct ? <span className="font-mono text-xs">{acct.accountCode} - {acct.name}</span> : <span className="text-muted text-xs font-mono">{id}</span>;
  };

  const renderDimensionLabel = (id: string | null | undefined, list: any[], codeField: string) => {
    if (!id) return <span className="text-muted text-xs italic">{tc('notConfigured')}</span>;
    const dim = list.find((d: any) => d.id === id || d.costCenterId === id || d.activityId === id);
    return dim ? <span className="font-mono text-xs">{dim[codeField]} - {dim.name}</span> : <span className="text-muted text-xs font-mono">{id}</span>;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, accounts, cc, act] = await Promise.all([
        apiFetch<any[]>('/api/product-groups'),
        apiFetch<any[]>('/api/gl/accounts'),
        apiFetch<any[]>('/api/settings/cost-centers'),
        apiFetch<any[]>('/api/settings/activities')
      ]);
      const sorted = data.sort((a, b) => 
        (a.groupCode || '').localeCompare(b.groupCode || '', undefined, { numeric: true })
      );
      setGroups(sorted);
      setGlAccounts(accounts || []);
      setCostCenters(cc || []);
      setActivities(act || []);
    } catch(err: any) {
      toast.error(t('toasts.loadFailed') + ': ' + err.message);
      reportError(err, 'ProductGroupsAdmin_loadData');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleEdit = (group: any) => {
    setEditingId(group.productGroupId);
    setEditForm({ ...group });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      groupCode: '',
      name: '',
      defaultExpenseAccountId: '',
      defaultRevenueAccountId: '',
      defaultCostCenterId: '',
      defaultActivityId: '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editForm.groupCode || !editForm.name) {
      toast.error(t('toasts.requiredFields'));
      return;
    }
    try {
      if (editingId) {
        await apiMutate(`/api/product-groups/${editingId}`, 'PATCH', editForm);
        toast.success(t('toasts.updated'));
      } else {
        await apiMutate('/api/product-groups', 'POST', editForm);
        toast.success(t('toasts.created'));
      }
      handleCancel();
      loadData();
    } catch(err: any) {
      toast.error(err.message);
      reportError(err, 'ProductGroupsAdmin_handleSave');
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm(t('confirmDelete'))) return;
    try {
      await apiMutate(`/api/product-groups/${id}`, 'DELETE');
      toast.success(t('toasts.deleted'));
      loadData();
    } catch(err: any) {
      toast.error(err.message);
      reportError(err, 'ProductGroupsAdmin_handleDelete');
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('subtitle')}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCreate}>
          {t('newGroup')}
        </button>
      </div>

      <div className="card mb-6">
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {t('definedGroups')}
        </h3>
        <table className="table-lines w-full">
          <thead>
            <tr>
              <th style={{ width: 100 }}>{tc('code')}</th>
              <th>{tc('name')}</th>
              <th style={{ width: 140 }}>{tc('defExpenseAccount')}</th>
              <th style={{ width: 140 }}>{tc('defRevAccount')}</th>
              <th style={{ width: 140 }}>{tc('defCostCenter')}</th>
              <th style={{ width: 140 }}>{tc('defActivity')}</th>
              <th style={{ width: 120, textAlign: 'right' }}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isCreating && (
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td>
                  <input className="input" value={editForm.groupCode} onChange={e => setEditForm({...editForm, groupCode: e.target.value})} placeholder={t('placeholders.code')} />
                </td>
                <td>
                  <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder={t('placeholders.name')} />
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultExpenseAccountId || ''} onChange={e => setEditForm({...editForm, defaultExpenseAccountId: e.target.value || null})}>
                    <option value="">{t_gen('selectNone')}</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultRevenueAccountId || ''} onChange={e => setEditForm({...editForm, defaultRevenueAccountId: e.target.value || null})}>
                    <option value="">{t_gen('selectNone')}</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultCostCenterId || ''} onChange={e => setEditForm({...editForm, defaultCostCenterId: e.target.value || null})}>
                    <option value="">{t_gen('selectNone')}</option>
                    {costCenters.map((c: any) => (
                      <option key={c.costCenterId} value={c.costCenterId}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultActivityId || ''} onChange={e => setEditForm({...editForm, defaultActivityId: e.target.value || null})}>
                    <option value="">{t_gen('selectNone')}</option>
                    {activities.map((a: any) => (
                      <option key={a.activityId} value={a.activityId}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{t_gen('cancel')}</button>
                    <button className="btn btn-primary btn-xs" onClick={handleSave}>{t_gen('save')}</button>
                  </div>
                </td>
              </tr>
            )}
            
            {!loading && groups.length === 0 && !isCreating && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  {t('noGroups')}
                </td>
              </tr>
            )}

            {groups.map(g => (
              editingId === g.productGroupId ? (
                <tr key={g.productGroupId} style={{ background: 'var(--bg-secondary)' }}>
                  <td>
                    <input className="input" value={editForm.groupCode} onChange={e => setEditForm({...editForm, groupCode: e.target.value})} />
                  </td>
                  <td>
                    <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultExpenseAccountId || ''} onChange={e => setEditForm({...editForm, defaultExpenseAccountId: e.target.value || null})}>
                      <option value="">{t_gen('selectNone')}</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultRevenueAccountId || ''} onChange={e => setEditForm({...editForm, defaultRevenueAccountId: e.target.value || null})}>
                      <option value="">{t_gen('selectNone')}</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultCostCenterId || ''} onChange={e => setEditForm({...editForm, defaultCostCenterId: e.target.value || null})}>
                      <option value="">{t_gen('selectNone')}</option>
                      {costCenters.map((c: any) => (
                        <option key={c.costCenterId} value={c.costCenterId}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultActivityId || ''} onChange={e => setEditForm({...editForm, defaultActivityId: e.target.value || null})}>
                      <option value="">{t_gen('selectNone')}</option>
                      {activities.map((a: any) => (
                        <option key={a.activityId} value={a.activityId}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{t_gen('cancel')}</button>
                      <button className="btn btn-primary btn-xs" onClick={handleSave}>{t_gen('save')}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={g.productGroupId}>
                  <td className="font-mono text-xs">{g.groupCode}</td>
                  <td className="font-medium">{g.name}</td>
                  <td>{renderGlAccountLabel(g.defaultExpenseAccountId)}</td>
                  <td>{renderGlAccountLabel(g.defaultRevenueAccountId)}</td>
                  <td>{renderDimensionLabel(g.defaultCostCenterId, costCenters, 'code')}</td>
                  <td>{renderDimensionLabel(g.defaultActivityId, activities, 'code')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(g)}>{t_gen('edit')}</button>
                      <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(g.productGroupId)}>{t_gen('delete')}</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
