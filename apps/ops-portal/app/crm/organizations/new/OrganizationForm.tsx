'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useSettings } from '@/components/SettingsProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { COUNTRIES, getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';

interface OrganizationFormProps {
  isNew?: boolean;
  organizationId?: string;
}

export default function OrganizationForm({ isNew = true, organizationId }: OrganizationFormProps) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const { organization } = useSettings();
  useDocumentTitle(isNew ? 'New Organization' : 'Edit Organization');

  const defaultCountry = organization?.country || '';

  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    name: '',
    industry: '',
    headquartersCountry: defaultCountry,
    email: '',
    isTaxRegistered: false,
    ownerId: '',
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.usersControllerFindAll();
        const u = res.data as unknown;
        const list: api.UserResponseDto[] = Array.isArray(u) ? u : (u as { data?: api.UserResponseDto[] })?.data || [];
        setUsers(list);
      } catch (err) {
        reportError(err, 'OrganizationForm - loadUsers');
        toast.error('Failed to load users: ' + getErrorMessage(err));
      }
    };
    loadUsers();
  }, []);

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = Boolean(dto.name && dto.name.trim() !== '');

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        ...dto,
        isTaxRegistered: Boolean(dto.isTaxRegistered),
      };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '' || payload[key] === null) {
          delete payload[key];
        }
      });

      if (isNew) {
        const res = await api.organizationsControllerCreate(payload as unknown as api.CreateOrganizationDto);
        const org = res.data;
        toast.success('Organization created');
        router.push(`/crm/organizations/${org.organizationId}`);
      } else {
        if (!organizationId) throw new Error('Missing organizationId');
        await api.organizationsControllerUpdate(organizationId, payload as unknown as api.UpdateOrganizationDto);
        toast.success('Organization updated');
        router.push('/crm/organizations');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'An error occurred');
      reportError(err, 'OrganizationForm');
    } finally {
      setSubmitting(false);
    }
  };

  const title = isNew ? 'Create Organization' : 'Edit Organization';

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={title}
          subtitle="Organization Management"
          isSaving={submitting}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/crm/organizations')}
                disabled={submitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!isValid || submitting}
              >
                {submitting ? tCommon('saving') : title}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
        {/* General Info Card */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">info</span>
            GENERAL INFO
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Acme Holdings"
                  disabled={submitting}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Industry
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  placeholder="e.g. Technology, Manufacturing"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Country
                </label>
                <select
                  className="input"
                  value={dto.headquartersCountry}
                  onChange={(e) => updateField('headquartersCountry', e.target.value)}
                  disabled={submitting}
                >
                  <option value="">{tCommon('notConfigured')}</option>
                  {COUNTRIES.map((c: { code: string; name: string }) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={dto.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="contact@example.com"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="organization-owner-select" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Account Owner
                </label>
                <select
                  id="organization-owner-select"
                  className="input"
                  value={dto.ownerId}
                  onChange={(e) => updateField('ownerId', e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Unassigned --</option>
                  {users.map((u: api.UserResponseDto) => (
                    <option key={(u as unknown as { userId: string }).userId || u.userId} value={(u as unknown as { userId: string }).userId || u.userId}>
                      {u.displayName || u.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
