'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { Button } from '@/components/shared/Button';
import { useTranslations } from 'next-intl';
import { formatLocalDate } from '@/lib/date';
import { getErrorMessage } from '@herobm/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface User {
  userId: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  events?: TimelineEvent[];
}



// ── Helpers ──────────────────────────────────────────────────────────────────

/** Decode the JWT payload from localStorage to get the current user's identity. */
function getCurrentUserId(): string | null {
  try {
    const token = localStorage.getItem('herobm_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    // harmless: unparseable/expired token in storage
    return null;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useTranslations('admin.users');
  const t2fa = useTranslations('admin.users.twoFactor');
  const tCommon = useTranslations('admin.settings.actions');
  useDocumentTitle(t('title'));
  const router = useRouter();

  /** Static role label lookup for built-in roles. */
  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: t('roles.admin'),
      viewer: t('roles.viewer'),
      sales: t('roles.sales'),
      warehouse: t('roles.warehouse'),
      procurement: t('roles.procurement'),
      finance: t('roles.finance'),
    };
    return labels[role] ?? role;
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<User> & { password?: string }>({});

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.usersControllerFindAll(),
        api.rolesControllerFindAll()
      ]);
      setUsers(usersRes.data as unknown as User[]);
      setRoles((rolesRes.data as { role: string }[]).map(r => r.role));
    } catch (err: unknown) {
      toast.error(t('toasts.loadFailed') + ': ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.usersControllerFindAll();
      setUsers(res.data as unknown as User[]);
    } catch (err: unknown) {
      toast.error(t('toasts.loadFailed') + ': ' + getErrorMessage(err));
    }
  };

  const allEvents = useMemo(() => {
    const evts: TimelineEvent[] = [];
    for (const u of users) {
      if (u.events) {
        evts.push(...u.events);
      }
    }
    // Sort oldest first so ActivityTimeline can reverse to show newest first
    evts.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime());
    return evts;
  }, [users]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const startEdit = (user: User) => {
    setEditingId(user.userId);
    setForm({ 
      role: user.role, 
      password: '',
      displayName: user.displayName || '',
      email: user.email || ''
    });
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ 
      username: '', 
      password: '', 
      role: 'viewer',
      displayName: '',
      email: ''
    });
  };

  const cancel = () => {
    setEditingId(null);
    setCreating(false);
  };

  const save = async () => {
    try {
      const payload: Partial<api.CreateUserDto & api.UpdateUserDto> = {
        role: form.role as api.CreateUserDtoRole,
        displayName: form.displayName || undefined,
        email: form.email || undefined,
      };
      if (form.password) payload.password = form.password;

      if (creating) {
        if (!form.username || !form.password) {
          toast.error(t('toasts.requiredFieldsError'));
          return;
        }
        payload.username = form.username;
        await api.usersControllerCreate(payload as api.CreateUserDto);
        toast.success(t('toasts.created'));
      } else if (editingId) {
        await api.usersControllerUpdate(editingId, payload as api.UpdateUserDto);
        toast.success(t('toasts.updated'));
      }
      cancel();
      loadUsers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.usersControllerToggleActive(user.userId, {});
      toast.success(t('toasts.toggled'));
      loadUsers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(t('confirmDelete', { username: user.username }))) return;
    try {
      await api.usersControllerRemove(user.userId);
      toast.success(t('toasts.deleted'));
      loadUsers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const reset2Fa = async (user: User) => {
    if (!confirm(t2fa('confirmReset'))) return;
    try {
      await api.usersControllerReset2Fa(user.userId, {});
      toast.success(t2fa('resetSuccess'));
      loadUsers();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── Row Renderer ───────────────────────────────────────────────────────────

  const isSelf = (userId: string) => currentUserId === userId;

  const renderRow = (isEdit: boolean, data: User, key: string) => (
    <tr key={key} className={isEdit ? 'bg-[var(--bg-secondary)]' : undefined}>
      {/* Username */}
      <td>
        {isEdit && creating
          ? <input
              className="input w-[140px]"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
              placeholder={t('placeholders.username')}
              autoFocus
            />
          : <span className="font-mono text-xs">{data.username}</span>}
      </td>

      {/* Full Name */}
      <td>
        {isEdit
          ? <input
              className="input w-[160px]"
              value={form.displayName ?? ''}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
              placeholder={t('placeholders.displayName')}
            />
          : <span className="font-medium text-sm">{data.displayName || '—'}</span>}
      </td>

      {/* Email */}
      <td>
        {isEdit
          ? <input
              className="input w-[180px]"
              value={form.email ?? ''}
              onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })}
              placeholder={t('placeholders.email')}
            />
          : <span className="text-xs text-[var(--text-secondary)]">{data.email || '—'}</span>}
      </td>

      {/* Role */}
      <td>
        {isEdit ? (
          <select
            className="input"
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            disabled={!creating && isSelf(data.userId)}
            title={!creating && isSelf(data.userId) ? t('cannotChangeOwnRoleError') : undefined}
          >
            {roles.map(r => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm">
            {roleLabel(data.role)}
          </span>
        )}
      </td>

      {/* Status */}
      <td>
        {!isEdit && (
          <span className={`badge badge-sm ${data.isActive ? 'badge-active' : 'badge-inactive'}`}>
            {data.isActive ? t('status.active') : t('status.disabled')}
          </span>
        )}
      </td>

      {/* 2FA */}
      <td>
        {!isEdit && (
          <span className="text-sm text-[var(--text-muted)]">—</span>
        )}
      </td>

      {/* Password (only in edit mode) */}
      <td>
        {isEdit && (
          <input
            className="input w-[140px]"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder={creating ? t('placeholders.password') : t('placeholders.passwordUnchanged')}
          />
        )}
      </td>

      {/* Created */}
      <td>
        {!isEdit && (
          <span className="text-xs text-[var(--text-muted)]">
            {formatLocalDate(data.createdAt)}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="text-right whitespace-nowrap">
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="xs" onClick={cancel}>
              {tCommon('cancel')}
            </Button>
            <Button variant="primary" size="xs" onClick={save}>
              {tCommon('save')}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {/* Reset 2FA */}
            <Button
              variant="secondary" size="xs"
              onClick={() => reset2Fa(data)}
              title={t2fa('reset')}
            >
              2FA
            </Button>

            {/* Toggle active */}
            <Button
              variant="secondary" size="xs"
              onClick={() => toggleActive(data)}
              disabled={isSelf(data.userId)}
              title={isSelf(data.userId) ? t('cannotDisableSelfError') : undefined}
              className={isSelf(data.userId) ? 'opacity-40 cursor-not-allowed' : undefined}
            >
              {data.isActive ? t('disable') : t('enable')}
            </Button>

            {/* Edit */}
            <Button variant="secondary" size="xs" className="flex items-center justify-center !p-1.5" title={tCommon('edit')} onClick={() => startEdit(data)}>
              { }
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </Button>

            {/* Delete */}
            <Button
              variant="secondary" size="xs"
              className={`flex items-center justify-center !p-1.5 ${isSelf(data.userId) ? 'opacity-40 cursor-not-allowed' : 'text-red-500 border-red-500 hover:!bg-red-50'}`}
              onClick={() => deleteUser(data)}
              disabled={isSelf(data.userId)}
              title={isSelf(data.userId) ? t('cannotDeleteSelfError') : tCommon('delete')}
            >
              { }
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </Button>
          </div>
        )}
      </td>
    </tr>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex flex-col gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              { }
              <span className="material-symbols-outlined">group</span>
              {t('title')}
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                ({users.length})
              </span>
            </h3>
            <Button variant="primary" size="sm" onClick={startCreate}>
              {t('buttons.createUser')}
            </Button>
          </div>

          {loading ? (
            <div className="p-6 text-center text-[var(--text-muted)]">
              {t('loading')}
            </div>
          ) : (
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th className="w-[120px]">{t('columns.username')}</th>
                  <th>{t('columns.displayName')}</th>
                  <th>{t('columns.email')}</th>
                  <th className="w-[130px]">{t('columns.role')}</th>
                  <th className="w-[90px]">{t('columns.status')}</th>
                  <th className="w-[80px]">{t2fa('column')}</th>
                  <th className="w-[140px]">{t('labels.password')}</th>
                  <th className="w-[100px]">{t('columns.createdAt')}</th>
                  <th className="w-[200px] text-right">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {creating && renderRow(true, {} as User, 'new-user')}
                {users.map(user =>
                  editingId === user.userId
                    ? renderRow(true, user, user.userId)
                    : renderRow(false, user, user.userId)
                )}
                {users.length === 0 && !creating && (
                  <tr>
                    <td colSpan={9} className="text-center p-6 text-[var(--text-muted)]">
                      {t('noneFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div id="activity-section" className="card">
          <ActivityTimeline events={allEvents} />
        </div>
      </div>
    </div>
  );
}
