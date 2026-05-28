'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

interface RoleWithPermissions {
  role: string;
  permissions: { resource: string; action: string }[];
}

export default function RolesPage() {
  useDocumentTitle('Roles & Permissions');
  const router = useRouter();

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [formPermissions, setFormPermissions] = useState<{ resource: string; action: string }[]>([]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await api.rolesControllerFindAll();
      setRoles(res.data as unknown as RoleWithPermissions[]);
    } catch (err: any) {
      toast.error('Failed to load roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const startEdit = (role: RoleWithPermissions) => {
    setEditingRole(role.role);
    setIsCreating(false);
    setFormPermissions([...role.permissions]);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingRole(null);
    setNewRoleName('');
    setFormPermissions([]);
  };

  const cancel = () => {
    setEditingRole(null);
    setIsCreating(false);
  };

  const save = async () => {
    const targetRole = isCreating ? newRoleName.trim().toLowerCase() : editingRole;
    if (!targetRole) {
      toast.error('Role name is required');
      return;
    }
    
    try {
      await api.rolesControllerSetPermissions(targetRole, {
        permissions: formPermissions,
      });
      toast.success(isCreating ? 'Role created' : 'Permissions updated');
      cancel();
      loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteRole = async (role: string) => {
    if (role === 'admin' || role === 'viewer') {
      toast.error('Cannot delete system-critical roles');
      return;
    }
    if (!confirm(`Are you sure you want to delete role '${role}'?`)) return;
    try {
      await api.rolesControllerRemove(role);
      toast.success('Role deleted');
      loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removePermission = (index: number) => {
    setFormPermissions(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const addPermission = () => {
    setFormPermissions(prev => [...prev, { resource: '', action: 'read' }]);
  };

  const updatePermission = (index: number, field: 'resource' | 'action', value: string) => {
    setFormPermissions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Roles & Permissions"
          subtitle="Manage access control policies"
          onBack={() => router.push('/admin/users')}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              <span className="material-symbols-outlined">security</span>
              Roles
            </h3>
            <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Create</button>
          </div>

          {loading ? (
            <div className="p-6 text-center text-muted">Loading...</div>
          ) : (
            <div className="flex flex-col gap-4">
              {isCreating && (
                <div className="border border-[var(--border)] rounded p-4 bg-[var(--bg-secondary)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-muted">badge</span>
                      <input 
                        type="text" 
                        className="input font-medium text-lg" 
                        placeholder="new-role-name" 
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
                    </div>
                  </div>
                  <div>
                    <table className="table-lines w-full mb-4">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Action</th>
                          <th style={{ width: '80px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formPermissions.map((p, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className="input"
                                value={p.resource}
                                onChange={e => updatePermission(idx, 'resource', e.target.value)}
                                placeholder="e.g. customers"
                              />
                            </td>
                            <td>
                              <select
                                className="input"
                                value={p.action}
                                onChange={e => updatePermission(idx, 'action', e.target.value)}
                              >
                                <option value="read">read</option>
                                <option value="write">write</option>
                                <option value="archive">archive</option>
                              </select>
                            </td>
                            <td className="text-right">
                              <button className="btn btn-secondary btn-sm text-danger" onClick={() => removePermission(idx)}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="btn btn-secondary btn-sm" onClick={addPermission}>
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Permission
                    </button>
                  </div>
                </div>
              )}

              {roles.map(roleItem => (
                <div key={roleItem.role} className="border border-[var(--border)] rounded p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-lg capitalize">{roleItem.role}</h4>
                    <div className="flex gap-2">
                      {editingRole === roleItem.role ? (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
                          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(roleItem)}>Edit</button>
                          {roleItem.role !== 'admin' && roleItem.role !== 'viewer' && (
                            <button className="btn btn-secondary btn-sm text-danger" onClick={() => deleteRole(roleItem.role)}>Delete</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {editingRole === roleItem.role ? (
                    <div>
                      <table className="table-lines w-full mb-4">
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Action</th>
                            <th style={{ width: '80px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formPermissions.map((p, idx) => (
                            <tr key={idx}>
                              <td>
                                <input
                                  className="input"
                                  value={p.resource}
                                  onChange={e => updatePermission(idx, 'resource', e.target.value)}
                                  placeholder="e.g. customers"
                                />
                              </td>
                              <td>
                                <select
                                  className="input"
                                  value={p.action}
                                  onChange={e => updatePermission(idx, 'action', e.target.value)}
                                >
                                  <option value="read">read</option>
                                  <option value="write">write</option>
                                  <option value="archive">archive</option>
                                  <option value="execute">execute</option>
                                </select>
                              </td>
                            <td className="text-right">
                              <button className="btn btn-icon text-muted hover:text-danger" onClick={() => removePermission(idx)} title="Remove">
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="btn btn-secondary btn-sm" onClick={addPermission}>
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Permission
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table-lines w-full text-sm">
                        <thead>
                          <tr>
                            <th style={{ width: '30%' }}>Resource</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Read</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Write</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Archive</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(
                            new Set([
                              'customers', 'products', 'inventory', 'sales-orders', 'purchase-orders', 
                              'suppliers', 'receptions', 'goods-received', 'dashboard', 'settings', 
                              'report', 'payments', 'users', 'roles', 'gl', 'tax-categories', 'import',
                              ...roleItem.permissions.map(p => p.resource)
                            ])
                          ).sort().map(res => {
                            const hasPerm = (act: string) => roleItem.permissions.some(p => p.resource === res && p.action === act);
                            const renderIcon = (act: string) => hasPerm(act) 
                              ? <span className="material-symbols-outlined text-[var(--success)] text-base align-middle">check_circle</span>
                              : <span className="material-symbols-outlined text-[var(--text-muted)] text-base opacity-30 align-middle">remove</span>;

                            // Only show row if it's a standard resource OR if the role actually has a permission for it
                            const isStandard = ['customers', 'products', 'inventory', 'sales-orders', 'purchase-orders', 'suppliers', 'receptions', 'goods-received', 'dashboard', 'settings', 'report', 'payments', 'users', 'roles', 'gl', 'tax-categories', 'import'].includes(res);
                            if (!isStandard && !roleItem.permissions.some(p => p.resource === res)) return null;

                            return (
                              <tr key={res}>
                                <td className="font-medium text-[var(--text-secondary)]">{res}</td>
                                <td style={{ textAlign: 'center' }}>{renderIcon('read')}</td>
                                <td style={{ textAlign: 'center' }}>{renderIcon('write')}</td>
                                <td style={{ textAlign: 'center' }}>{renderIcon('archive')}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
