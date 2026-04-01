'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { CURRENCIES, HOME_CURRENCY } from '@/lib/currency';

export default function SupplierGroupsAdmin() {
  useDocumentTitle('Supplier Groups');
  const [groups, setGroups] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const renderGlAccountLabel = (id: string | null | undefined) => {
    if (!id) return <span className="text-muted text-xs italic">Not configured</span>;
    const acct = glAccounts.find((a: any) => a.glAccountId === id);
    return acct ? <span className="font-mono text-xs">{acct.accountCode} - {acct.name}</span> : <span className="text-muted text-xs font-mono">{id}</span>;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, accounts] = await Promise.all([
        apiFetch<any[]>('/api/supplier-groups'),
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
    setEditingId(group.supplierGroupId);
    setEditForm({ ...group });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      groupCode: '',
      name: '',
      defaultApAccountId: '',
      defaultExpenseAccountId: '',
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
        await apiMutate(`/api/supplier-groups/${editingId}`, 'PATCH', editForm);
        toast.success('Group updated');
      } else {
        await apiMutate('/api/supplier-groups', 'POST', editForm);
        toast.success('Group created');
      }
      handleCancel();
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure you want to delete this group?")) return;
    try {
      await apiMutate(`/api/supplier-groups/${id}`, 'DELETE');
      toast.success('Group deleted');
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Supplier Groups</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage group classifications for supplier accounts
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCreate}>
          + New Group
        </button>
      </div>

      <div className="card mb-6">
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Defined Groups
        </h3>
        <table className="table-lines w-full">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Code</th>
              <th>Name</th>
              <th style={{ width: 180 }}>Def. AP Account</th>
              <th style={{ width: 180 }}>Def. Expense Account</th>
              <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isCreating && (
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td>
                  <input className="input" value={editForm.groupCode} onChange={e => setEditForm({...editForm, groupCode: e.target.value})} placeholder="Code" />
                </td>
                <td>
                  <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Name" />
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultApAccountId || ''} onChange={e => setEditForm({...editForm, defaultApAccountId: e.target.value || null})}>
                    <option value="">-- None --</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input font-mono text-xs" value={editForm.defaultExpenseAccountId || ''} onChange={e => setEditForm({...editForm, defaultExpenseAccountId: e.target.value || null})}>
                    <option value="">-- None --</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-secondary btn-xs" onClick={handleCancel}>Cancel</button>
                    <button className="btn btn-primary btn-xs" onClick={handleSave}>Save</button>
                  </div>
                </td>
              </tr>
            )}
            
            {!loading && groups.length === 0 && !isCreating && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No supplier groups defined.
                </td>
              </tr>
            )}

            {groups.map(g => (
              editingId === g.supplierGroupId ? (
                <tr key={g.supplierGroupId} style={{ background: 'var(--bg-secondary)' }}>
                  <td>
                    <input className="input" value={editForm.groupCode} onChange={e => setEditForm({...editForm, groupCode: e.target.value})} />
                  </td>
                  <td>
                    <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultApAccountId || ''} onChange={e => setEditForm({...editForm, defaultApAccountId: e.target.value || null})}>
                      <option value="">-- None --</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="input font-mono text-xs" value={editForm.defaultExpenseAccountId || ''} onChange={e => setEditForm({...editForm, defaultExpenseAccountId: e.target.value || null})}>
                      <option value="">-- None --</option>
                      {glAccounts.map((a: any) => (
                        <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={handleCancel}>Cancel</button>
                      <button className="btn btn-primary btn-xs" onClick={handleSave}>Save</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={g.supplierGroupId}>
                  <td className="font-mono text-xs">{g.groupCode}</td>
                  <td className="font-medium">{g.name}</td>
                  <td>{renderGlAccountLabel(g.defaultApAccountId)}</td>
                  <td>{renderGlAccountLabel(g.defaultExpenseAccountId)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(g)}>Edit</button>
                      <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(g.supplierGroupId)}>Delete</button>
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
