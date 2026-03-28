'use client';

import { useState, useEffect } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function ProductGroupsAdmin() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any[]>('/api/product-groups');
      const sorted = data.sort((a, b) => 
        (a.groupCode || '').localeCompare(b.groupCode || '', undefined, { numeric: true })
      );
      setGroups(sorted);
    } catch(err: any) {
      toast.error('Failed to load groups: ' + err.message);
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
      defaultDiscountPercentage: '0',
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
        await apiMutate(`/api/product-groups/${editingId}`, 'PATCH', editForm);
        toast.success('Group updated');
      } else {
        await apiMutate('/api/product-groups', 'POST', editForm);
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
      await apiMutate(`/api/product-groups/${id}`, 'DELETE');
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
          <h1 className="text-2xl font-bold">Product Groups</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage group classifications for products and inventory
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
              <th style={{ width: 150 }}>Def. Discount %</th>
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
                  <input className="input" value={editForm.defaultDiscountPercentage} onChange={e => setEditForm({...editForm, defaultDiscountPercentage: e.target.value})} type="number" step="0.01" />
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
                <td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No product groups defined.
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
                    <input className="input" value={editForm.defaultDiscountPercentage} onChange={e => setEditForm({...editForm, defaultDiscountPercentage: e.target.value})} type="number" step="0.01" />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={handleCancel}>Cancel</button>
                      <button className="btn btn-primary btn-xs" onClick={handleSave}>Save</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={g.productGroupId}>
                  <td className="font-mono text-xs">{g.groupCode}</td>
                  <td className="font-medium">{g.name}</td>
                  <td>{g.defaultDiscountPercentage}%</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(g)}>Edit</button>
                      <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(g.productGroupId)}>Delete</button>
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
