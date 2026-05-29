'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

const RESOURCES = [
  'customers', 'products', 'inventory', 'sales-orders', 'sales-returns',
  'purchase-orders', 'purchase-returns', 'suppliers', 'receptions', 'goods-received',
  'dashboard', 'tax-categories', 'settings', 'report', 'payments', 'system_logs',
  'import', 'api_keys', 'webhooks', 'events', 'roles', 'users', 'gl', 'locations'
];

const ACTIONS = ['read', 'write', 'archive', 'handle', 'invoice'];

const VALID_ACTIONS: Record<string, string[]> = {
  'customers': ['read', 'write', 'archive'],
  'products': ['read', 'write', 'archive'],
  'inventory': ['read', 'write', 'archive', 'handle'],
  'sales-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'sales-returns': ['read', 'write', 'archive', 'handle', 'invoice'],
  'purchase-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'purchase-returns': ['read', 'write', 'archive', 'handle', 'invoice'],
  'suppliers': ['read', 'write', 'archive'],
  'receptions': ['read', 'write', 'archive', 'handle'],
  'goods-received': ['read', 'write', 'archive', 'handle'],
  'dashboard': ['read'],
  'tax-categories': ['read', 'write', 'archive'],
  'settings': ['read', 'write', 'archive'],
  'report': ['read', 'write', 'archive'],
  'payments': ['read', 'write', 'archive'],
  'system_logs': ['read', 'write', 'archive'],
  'import': ['read', 'write', 'archive'],
  'api_keys': ['read', 'write', 'archive'],
  'webhooks': ['read', 'write', 'archive'],
  'events': ['read', 'write', 'archive'],
  'roles': ['read', 'write', 'archive'],
  'users': ['read', 'write', 'archive'],
  'gl': ['read', 'write'],
  'locations': ['read', 'write', 'archive'],
};

interface PermissionDetail {
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
}

interface ImplicitPermissionDetail extends PermissionDetail {
  sourceRole: string;
}

interface RoleWithDetails {
  role: string;
  localPermissions: PermissionDetail[];
  inherits: string[];
  implicitPermissions: ImplicitPermissionDetail[];
}

export default function RolesPage() {
  useDocumentTitle('Roles & Permissions');
  const router = useRouter();

  const [roles, setRoles] = useState<RoleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  
  // Local state for the matrix
  // Form permissions: Record<resource, Record<action, effect>>
  const [formPermissions, setFormPermissions] = useState<Record<string, Record<string, 'allow' | 'deny' | ''>>>({});
  const [formInherits, setFormInherits] = useState<string[]>([]);

  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  const toggleRole = (role: string) => {
    setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await api.rolesControllerFindAll();
      setRoles(res.data as unknown as RoleWithDetails[]);
    } catch (err: any) {
      toast.error('Failed to load roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const getRoleNames = () => roles.map(r => r.role);

  const initForm = (localPerms: PermissionDetail[], inherits: string[]) => {
    const map: Record<string, Record<string, 'allow' | 'deny' | ''>> = {};
    for (const res of RESOURCES) {
      map[res] = {};
      for (const act of ACTIONS) {
        map[res][act] = '';
      }
    }
    for (const p of localPerms) {
      if (map[p.resource]) {
        map[p.resource][p.action] = p.effect;
      }
    }
    setFormPermissions(map);
    setFormInherits([...inherits]);
  };

  const startEdit = (role: RoleWithDetails) => {
    setEditingRole(role.role);
    setIsCreating(false);
    initForm(role.localPermissions || [], role.inherits || []);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingRole(null);
    setNewRoleName('');
    initForm([], []);
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
    
    const permissionsToSave: PermissionDetail[] = [];
    Object.entries(formPermissions).forEach(([resource, acts]) => {
      Object.entries(acts).forEach(([action, effect]) => {
        if (effect === 'allow' || effect === 'deny') {
          permissionsToSave.push({ resource, action, effect: effect as 'allow' | 'deny' });
        }
      });
    });

    try {
      await api.rolesControllerSetPermissions(targetRole, {
        permissions: permissionsToSave as any,
        inherits: formInherits,
      } as any);
      toast.success(isCreating ? 'Role created' : 'Permissions updated');
      cancel();
      loadRoles();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteRole = async (role: string) => {
    if (role === 'admin' || role === 'viewer' || role === 'webhook' || role === 'agent') {
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

  const handlePermissionChange = (resource: string, action: string, effect: 'allow' | 'deny' | '') => {
    setFormPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: effect
      }
    }));
  };

  const handleInheritsToggle = (parentRole: string) => {
    setFormInherits(prev => 
      prev.includes(parentRole) 
        ? prev.filter(r => r !== parentRole) 
        : [...prev, parentRole]
    );
  };

  // Helper to render the permission matrix
  const renderMatrix = (isReadOnly: boolean, currentRoleItem?: RoleWithDetails) => {
    
    const getImplicitPerm = (resource: string, action: string) => {
      if (!currentRoleItem || !currentRoleItem.implicitPermissions) return null;
      return currentRoleItem.implicitPermissions.find(p => p.resource === resource && p.action === action) || null;
    };

    return (
      <div className="overflow-x-auto w-full">
        <table className="table-lines w-full table-fixed text-sm">
          <thead>
            <tr>
              <th className="w-[150px] text-left" style={{ textAlign: 'left' }}>Resource</th>
              {ACTIONS.map(a => <th key={a} className="text-center uppercase text-[var(--text-secondary)] text-xs tracking-wider" style={{ textAlign: 'center' }}>{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map(res => (
              <tr key={res}>
                <td className="font-medium text-[var(--text-secondary)]">{res}</td>
                {ACTIONS.map(act => {
                  const isNA = !VALID_ACTIONS[res]?.includes(act);

                  if (isNA) {
                    return (
                      <td key={act} className="text-center p-1">
                        <div className="flex items-center justify-center h-8">
                          <span className="text-[10px] text-muted font-bold uppercase tracking-widest opacity-40">N/A</span>
                        </div>
                      </td>
                    );
                  }

                  if (isReadOnly && currentRoleItem) {
                    const local = currentRoleItem.localPermissions?.find(p => p.resource === res && p.action === act);
                    const inherited = getImplicitPerm(res, act);
                    return (
                      <td key={act} className="text-center">
                        <div className="flex flex-col items-center justify-center h-full min-h-[40px]">
                          {local ? (
                            <span 
                              className={`material-symbols-outlined text-[20px] ${local.effect === 'allow' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                              title={`Explicitly ${local.effect}`}
                            >
                              {local.effect === 'allow' ? 'check_circle' : 'cancel'}
                            </span>
                          ) : inherited ? (
                            <span 
                              className={`material-symbols-outlined text-[20px] opacity-40 hover:opacity-100 transition-opacity cursor-help ${inherited.effect === 'allow' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                              title={`Inherited ${inherited.effect} from ${inherited.sourceRole}`}
                            >
                              {inherited.effect === 'allow' ? 'check_circle' : 'cancel'}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">-</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Editing state
                  const localVal = formPermissions[res]?.[act] || '';
                  const inheritedVal = getImplicitPerm(res, act);
                  
                  return (
                    <td key={act} className="text-center">
                      <div className="flex flex-col items-center gap-1 justify-center py-1">
                        <select 
                          className="input !py-0.5 !px-1 text-xs h-7 w-[80px] text-center"
                          value={localVal}
                          onChange={(e) => handlePermissionChange(res, act, e.target.value as any)}
                        >
                          <option value="">Unset</option>
                          <option value="allow">Allow</option>
                          <option value="deny">Deny</option>
                        </select>
                        {inheritedVal && !localVal && (
                          <span 
                            className={`material-symbols-outlined text-[16px] opacity-40 ${inheritedVal.effect === 'allow' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
                            title={`Inherited ${inheritedVal.effect} from ${inheritedVal.sourceRole}`}
                          >
                            {inheritedVal.effect === 'allow' ? 'check_circle' : 'cancel'}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Roles & Permissions"
          subtitle="Manage access control policies and inheritance"
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
            <button className="btn btn-primary btn-sm" onClick={startCreate}>+ Create Role</button>
          </div>

          {loading ? (
            <div className="p-6 text-center text-muted">Loading...</div>
          ) : (
            <div className="flex flex-col gap-6">
              {isCreating && (
                <div className="border border-[var(--border)] rounded p-4 bg-[var(--bg-secondary)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-muted">badge</span>
                      <input 
                        type="text" 
                        className="input font-medium text-lg w-64" 
                        placeholder="new-role-name" 
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={save}>Save Role</button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="label">Inherits From:</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {getRoleNames().map(r => (
                        <label key={r} className="flex items-center gap-1 bg-[var(--bg-card)] px-2 py-1 rounded border border-[var(--border)] cursor-pointer hover:border-[var(--accent)]">
                          <input 
                            type="checkbox" 
                            checked={formInherits.includes(r)}
                            onChange={() => handleInheritsToggle(r)}
                          />
                          <span className="text-sm font-medium">{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {renderMatrix(false)}
                </div>
              )}

              {roles.map(roleItem => (
                <div key={roleItem.role} className="border border-[var(--border)] rounded-xl overflow-hidden flex flex-col bg-white transition-colors">
                  <div 
                    className={`flex items-center justify-between px-5 py-3 hover:bg-[#f8f9fa] cursor-pointer select-none ${expandedRoles[roleItem.role] || editingRole === roleItem.role ? 'border-b border-[rgba(196,198,205,0.4)]' : ''}`}
                    onClick={() => toggleRole(roleItem.role)}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 text-[var(--accent)] ${expandedRoles[roleItem.role] || editingRole === roleItem.role ? 'rotate-90' : ''}`}>
                        chevron_right
                      </span>
                      <div className="font-bold text-sm text-[#041627] capitalize" style={{ fontFamily: 'Manrope, sans-serif' }}>{roleItem.role}</div>
                      {roleItem.inherits && roleItem.inherits.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          Inherits: <span className="font-medium">{roleItem.inherits.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      {editingRole === roleItem.role ? (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={cancel}>Cancel</button>
                          <button className="btn btn-primary btn-sm" onClick={save}>Save Changes</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(roleItem)}>Edit</button>
                          {roleItem.role !== 'admin' && roleItem.role !== 'viewer' && roleItem.role !== 'webhook' && roleItem.role !== 'agent' && (
                            <button className="btn btn-secondary btn-sm text-danger" onClick={() => deleteRole(roleItem.role)}>Delete</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {(expandedRoles[roleItem.role] || editingRole === roleItem.role) && (
                    <div className="p-4">
                      {editingRole === roleItem.role ? (
                        <div className="flex flex-col gap-4">
                          <div>
                            <label className="label">Inherits From:</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {getRoleNames().filter(r => r !== roleItem.role).map(r => (
                                <label key={r} className="flex items-center gap-1 bg-[var(--bg-card)] px-2 py-1 rounded border border-[var(--border)] cursor-pointer hover:border-[var(--accent)]">
                                  <input 
                                    type="checkbox" 
                                    checked={formInherits.includes(r)}
                                    onChange={() => handleInheritsToggle(r)}
                                  />
                                  <span className="text-sm font-medium">{r}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          {renderMatrix(false, roleItem)}
                        </div>
                      ) : (
                        renderMatrix(true, roleItem)
                      )}
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
