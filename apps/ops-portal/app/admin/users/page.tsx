'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { useTranslations } from 'next-intl';
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

const ROLES = ['admin', 'viewer', 'sales', 'warehouse', 'procurement', 'finance'] as const;

type RoleKey = typeof ROLES[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Decode the JWT payload from localStorage to get the current user's identity. */
function getCurrentUserId(): string | null {
  try {
    const token = localStorage.getItem('herobm_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.settings.actions');
  useDocumentTitle(t('title'));
  const router = useRouter();

  /** Static role label lookup — avoids dynamic template literal type errors with next-intl. */
  const roleLabels: Record<RoleKey, string> = {
    admin: t('roles.admin'),
    viewer: t('roles.viewer'),
    sales: t('roles.sales'),
    warehouse: t('roles.warehouse'),
    procurement: t('roles.procurement'),
    finance: t('roles.finance'),
  };
  const roleLabel = (role: string) => roleLabels[role as RoleKey] ?? role;

  // ── State ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<User> & { password?: string }>({});

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.usersControllerFindAll();
      setUsers(res.data as unknown as User[]);
    } catch (err: unknown) {
      toast.error(t('toasts.loadFailed') + ': ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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

  // ── Row Renderer ───────────────────────────────────────────────────────────

  const isSelf = (userId: string) => currentUserId === userId;

  const renderRow = (isEdit: boolean, data: User, key: string) => (
    <tr key={key} style={isEdit ? { background: 'var(--bg-secondary)' } : undefined}>
      {/* Username */}
      <td>
        {isEdit && creating
          ? <input
              className="input"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
              placeholder={t('placeholders.username')}
              autoFocus
              style={{ width: 140 }}
            />
          : <span className="font-mono text-xs">{data.username}</span>}
      </td>

      {/* Full Name */}
      <td>
        {isEdit
          ? <input
              className="input"
              value={form.displayName ?? ''}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
              placeholder={t('placeholders.displayName')}
              style={{ width: 160 }}
            />
          : <span className="font-medium text-sm">{data.displayName || '—'}</span>}
      </td>

      {/* Email */}
      <td>
        {isEdit
          ? <input
              className="input"
              value={form.email ?? ''}
              onChange={e => setForm({ ...form, email: e.target.value.toLowerCase() })}
              placeholder={t('placeholders.email')}
              style={{ width: 180 }}
            />
          : <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{data.email || '—'}</span>}
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
            {ROLES.map(r => (
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

      {/* Password (only in edit mode) */}
      <td>
        {isEdit && (
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder={creating ? t('placeholders.password') : t('placeholders.passwordUnchanged')}
            style={{ width: 140 }}
          />
        )}
      </td>

      {/* Created */}
      <td>
        {!isEdit && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(data.createdAt).toLocaleDateString()}
          </span>
        )}
      </td>

      {/* Actions */}
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {isEdit ? (
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary btn-xs" onClick={cancel}>
              {tCommon('cancel')}
            </button>
            <button className="btn btn-primary btn-xs" onClick={save}>
              {tCommon('save')}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {/* Toggle active */}
            <button
              className="btn btn-secondary btn-xs"
              onClick={() => toggleActive(data)}
              disabled={isSelf(data.userId)}
              title={isSelf(data.userId) ? t('cannotDisableSelfError') : undefined}
              style={isSelf(data.userId) ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              {data.isActive ? t('disable') : t('enable')}
            </button>

            {/* Edit */}
            <button className="btn btn-secondary btn-xs" onClick={() => startEdit(data)}>
              {tCommon('edit')}
            </button>

            {/* Delete */}
            <button
              className="btn btn-secondary btn-xs"
              style={{
                color: isSelf(data.userId) ? undefined : 'var(--danger)',
                borderColor: isSelf(data.userId) ? undefined : 'var(--danger)',
                opacity: isSelf(data.userId) ? 0.4 : 1,
                cursor: isSelf(data.userId) ? 'not-allowed' : undefined,
              }}
              onClick={() => deleteUser(data)}
              disabled={isSelf(data.userId)}
              title={isSelf(data.userId) ? t('cannotDeleteSelfError') : undefined}
            >
              {tCommon('delete')}
            </button>
          </div>
        )}
      </td>
    </tr>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('title')}
          subtitle={t('subtitle')}
          onBack={() => router.push('/')}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading !mb-0">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">group</span>
              {t('title')}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                ({users.length})
              </span>
            </h3>
            <button className="btn btn-primary btn-sm" onClick={startCreate}>
              {t('buttons.createUser')}
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('loading')}
            </div>
          ) : (
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>{t('columns.username')}</th>
                  <th>{t('columns.displayName')}</th>
                  <th>{t('columns.email')}</th>
                  <th style={{ width: 130 }}>{t('columns.role')}</th>
                  <th style={{ width: 90 }}>{t('columns.status')}</th>
                  <th style={{ width: 140 }}>{t('labels.password')}</th>
                  <th style={{ width: 100 }}>{t('columns.createdAt')}</th>
                  <th style={{ textAlign: 'right', width: 180 }}>{tCommon('actions')}</th>
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
                    <td colSpan={8} className="text-center p-6" style={{ color: 'var(--text-muted)' }}>
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
    </DetailsLayout>
  );
}
