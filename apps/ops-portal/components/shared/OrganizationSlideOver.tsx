import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';
import OrganizationSelect, { Organization } from '@/components/shared/OrganizationSelect';
import { useSettings } from '@/components/SettingsProvider';

export interface OrganizationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId?: string;
  projectId?: string;
  onSaved: () => void;
  editingOrganization?: {
    organizationId: string;
    name: string;
    industry?: string;
    email?: string;
    roles?: string[];
  } | null;
}

export const OrganizationSlideOver: React.FC<OrganizationSlideOverProps> = ({
  isOpen,
  onClose,
  opportunityId,
  projectId,
  onSaved,
  editingOrganization,
}) => {
  const targetOpportunityId = opportunityId || projectId || '';
  const tCommon = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const { app } = useSettings();
  const orgRoles = app?.opportunityOrganizationRoles || [];
  
  const editing = editingOrganization;

  const [dto, setDto] = useState({
    name: '',
    industry: '',
    email: '',
    roles: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setDto({
          name: editing.name || '',
          industry: editing.industry || '',
          email: editing.email || '',
          roles: editing.roles || [],
        });
        setSelectedOrg({
          organizationId: editing.organizationId,
          name: editing.name,
          industry: editing.industry,
          email: editing.email,
        });
      } else {
        setDto({
          name: '',
          industry: '',
          email: '',
          roles: [],
        });
        setSelectedOrg(null);
      }
    }
  }, [isOpen, editing]);

  const handleSelectOrg = (org: Organization | null) => {
    setSelectedOrg(org);
    if (!org) {
      setDto({
        name: '',
        industry: '',
        email: '',
        roles: dto.roles,
      });
      return;
    }
    
    setDto({
      name: org.name || '',
      industry: org.industry || '',
      email: org.email || '',
      roles: dto.roles,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dto.name) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Org ID compatibility wrapper
      let finalOrgId = selectedOrg?.organizationId || (selectedOrg as any)?.id || (selectedOrg as any)?.actorId;

      if (typeof finalOrgId === 'object' && finalOrgId !== null) {
        finalOrgId = finalOrgId.id || finalOrgId.organizationId || finalOrgId.actorId || String(finalOrgId);
      }
      if (typeof finalOrgId === 'string') {
        finalOrgId = finalOrgId.replace(/[^0-9a-fA-F-]/g, '').toLowerCase();
      }

      if (finalOrgId) {
        // Update the global record identity
        await api.organizationsControllerUpdate(finalOrgId, {
          name: dto.name,
          industry: dto.industry || undefined,
          email: dto.email || undefined,
        });
      } else {
        // Create new organization
        const newOrgResponse = await api.organizationsControllerCreate({
          name: dto.name,
          industry: dto.industry || undefined,
          email: dto.email || undefined,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Org ID compatibility wrapper
        finalOrgId = (newOrgResponse?.data as any)?.organizationId || (newOrgResponse?.data as any)?.id || finalOrgId;
        if (typeof finalOrgId === 'string') finalOrgId = finalOrgId.trim();
      }

      if (finalOrgId) {
        if (typeof finalOrgId !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(finalOrgId)) {
          reportError(new Error(`DEBUG INVALID finalOrgId: ${finalOrgId}, selectedOrg: ${JSON.stringify(selectedOrg)}`), 'OrganizationSlideOver');
          throw new Error(`Invalid finalOrgId (not a UUID): ${JSON.stringify(finalOrgId)}. selectedOrg: ${JSON.stringify(selectedOrg)}`);
        }
        
        if (editing && editing.organizationId === finalOrgId) {
          // Update existing link
          await api.opportunitiesControllerUpdateOrganization(targetOpportunityId, finalOrgId, {
            roles: dto.roles.length > 0 ? dto.roles : undefined,
          });
        } else {
          // Link to opportunity
          await api.opportunitiesControllerAddOrganization(targetOpportunityId, { 
            organizationId: finalOrgId, 
            roles: dto.roles.length > 0 ? dto.roles : undefined,
          });
        }
      }

      toast.success('Organization linked successfully');
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit Organization Link" : "Link Organization"}
      width="max-w-md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="organization-form"
            variant="primary"
            className="bg-[var(--accent)] hover:opacity-90 border-none text-white"
            loading={saving}
          >
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      }
    >
      <form id="organization-form" onSubmit={handleSave} className="flex flex-col gap-5 h-full pb-6">
        
        {!editing && (
          <div className="bg-[var(--bg-secondary)] -mx-6 px-6 py-4 border-b border-[var(--border)] mb-2">
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              Search Existing Organization
            </label>
            <OrganizationSelect
              value={selectedOrg?.organizationId || null}
              onChange={handleSelectOrg}
              placeholder="Type to search..."
              disabled={saving}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input w-full"
            value={dto.name}
            onChange={(e) => setDto({ ...dto, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Industry
          </label>
          <input
            type="text"
            className="input w-full"
            value={dto.industry}
            onChange={(e) => setDto({ ...dto, industry: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Email
          </label>
          <input
            type="email"
            className="input w-full"
            value={dto.email}
            onChange={(e) => setDto({ ...dto, email: e.target.value })}
          />
        </div>

        <div className="mt-2 pt-4 border-t border-gray-100">
          <label className="block text-sm font-medium mb-3 text-[var(--text-muted)]">
            Roles
          </label>
          <div className="flex flex-col gap-3">
            {[...orgRoles].sort((a, b) => Number(a.order) - Number(b.order)).map((r) => (
              <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={dto.roles.includes(r.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDto({ ...dto, roles: [...dto.roles, r.value] });
                    } else {
                      setDto({ ...dto, roles: dto.roles.filter(x => x !== r.value) });
                    }
                  }}
                />
                <span className="text-sm capitalize group-hover:text-gray-900 transition-colors">{r.value}</span>
              </label>
            ))}
          </div>
        </div>

      </form>
    </SlideOver>
  );
};

export const ActorSlideOver = OrganizationSlideOver;
export type ActorSlideOverProps = OrganizationSlideOverProps;
