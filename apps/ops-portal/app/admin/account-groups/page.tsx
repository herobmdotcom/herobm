'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function AccountGroupsAdmin() {
  useDocumentTitle('Account Groups');
  const t = useTranslations('admin.accountGroups');
  const tCommon = useTranslations('admin.common');
  const tGlobalCommon = useTranslations('common');
  const [groups, setGroups] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const renderGlAccountLabel = (id: string | null | undefined) => {
    if (!id) return <span className="text-muted text-xs italic">{t('notConfigured')}</span>;
    const acct = glAccounts.find((a: any) => a.glAccountId === id);
    return acct ? <span className="font-mono text-xs">{acct.accountCode} - {acct.name}</span> : <span className="text-muted text-xs font-mono">{id}</span>;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, accounts] = await Promise.all([
        apiFetch<any[]>('/api/account-groups'),
        apiFetch<any[]>('/api/gl/accounts')
      ]);
      const sorted = data.sort((a, b) => 
        (a.groupCode || '').localeCompare(b.groupCode || '', undefined, { numeric: true })
      );
      setGroups(sorted);
      setGlAccounts(accounts || []);
    } catch(err: any) {
      toast.error('Failed to load groups: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleEdit = (group: any) => {
    setEditingId(group.accountGroupId);
    setEditForm({ ...group });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      groupCode: '',
      name: '',
      defaultDiscountPercentage: '0',
      defaultArAccountId: '',
      defaultRevenueAccountId: '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editForm.groupCode || !editForm.name) {
      toast.error('Code and Name are required');
      return;
    }
    try {
      if (editingId) {
        await apiMutate(`/api/account-groups/${editingId}`, 'PATCH', editForm);
        toast.success('Group updated');
      } else {
        await apiMutate('/api/account-groups', 'POST', editForm);
        toast.success('Group created');
      }
      handleCancel();
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm(tGlobalCommon('confirmDelete'))) return;
    try {
      await apiMutate(`/api/account-groups/${id}`, 'DELETE');
      toast.success(t('toasts.deleted'));
      loadData();
    } catch(err: any) {
      toast.error(err.message);
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
              <th style={{ width: 120 }}>{tCommon('code')}</th>
              <th>{tCommon('name')}</th>
              <th style={{ width: 150 }}>{tCommon('defDiscount')}</th>
              <th style={{ width: 180 }}>{tCommon('defArAccount')}</th>
              <th style={{ width: 180 }}>{tCommon('defRevAccount')}</th>
              <th style={{ width: 150, textAlign: 'right' }}>{tCommon('actions')}</th>
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
                  <input className="input" value={editForm.defaultDiscountPercentage} onChange={e => setEditForm({...editForm, defaultDiscountPercentage: e.target.value})} type="number" step="0.01" />
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultArAccountId || ''} onChange={e => setEditForm({...editForm, defaultArAccountId: e.target.value || null})}>
                    <option value="">-- {tGlobalCommon('selectNone')} --</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultRevenueAccountId || ''} onChange={e => setEditForm({...editForm, defaultRevenueAccountId: e.target.value || null})}>
                    <option value="">-- {tGlobalCommon('selectNone')} --</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{tGlobalCommon('cancel')}</button>
                    <button className="btn btn-primary btn-xs" onClick={handleSave}>{tGlobalCommon('save')}</button>
                  </div>
                </td>
              </tr>
            )}
            
            {!loading && groups.length === 0 && !isCreating && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  {t('noGroups')}
                </td>
              </tr>
            )}

            {groups.map(g => (
              editingId === g.accountGroupId ? (
                <tr key={g.accountGroupId} style={{ background: 'var(--bg-secondary)' }}>
                  <td>
                    <input className="input" value={editForm.groupCode} onChange={e => setEditForm({...editForm, groupCode: e.target.value})} />
                  </td>
                  <td>
                    <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </td>
                  <td>
                    <input className="input" value={editForm.defaultDiscountPercentage} onChange={e => setEditForm({...editForm, defaultDiscountPercentage: e.target.value})} type="number" step="0.01" />
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultArAccountId || ''} onChange={e => setEditForm({...editForm, defaultArAccountId: e.target.value || null})}>
                      <option value="">-- {tGlobalCommon('selectNone')} --</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultRevenueAccountId || ''} onChange={e => setEditForm({...editForm, defaultRevenueAccountId: e.target.value || null})}>
                      <option value="">-- {tGlobalCommon('selectNone')} --</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{tGlobalCommon('cancel')}</button>
                      <button className="btn btn-primary btn-xs" onClick={handleSave}>{tGlobalCommon('save')}</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={g.accountGroupId}>
                  <td className="font-mono text-xs">{g.groupCode}</td>
                  <td className="font-medium">{g.name}</td>
                  <td>{g.defaultDiscountPercentage}%</td>
                  <td>{renderGlAccountLabel(g.defaultArAccountId)}</td>
                  <td>{renderGlAccountLabel(g.defaultRevenueAccountId)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(g)}>{tGlobalCommon('edit')}</button>
                      <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(g.accountGroupId)}>{tGlobalCommon('delete')}</button>
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
