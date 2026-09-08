'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import OrganizationSelect, { Organization } from '@/components/shared/OrganizationSelect';
import { getBadgeColor } from '@/lib/utils';
import { reportError } from '@/lib/api';
import { getErrorMessage, DEFAULT_ORGANIZATION_CONTACT_ROLES } from '@herobm/shared';
import * as api from '@herobm/sdk';
import type { ContactResponseDto } from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';

interface ContactAffiliationsTabProps {
  contactId: string;
  contact: ContactResponseDto | null;
  onAffiliationUpdated: () => void;
}

export function ContactAffiliationsTab({
  contactId,
  contact,
  onAffiliationUpdated,
}: ContactAffiliationsTabProps) {
  const { app: appSettings } = useSettings();
  const [isLinking, setIsLinking] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const availableRoles = [
    ...(appSettings?.organizationContactRoles && appSettings.organizationContactRoles.length > 0
      ? appSettings.organizationContactRoles
      : DEFAULT_ORGANIZATION_CONTACT_ROLES),
  ].sort((a, b) => Number(a.order) - Number(b.order));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO relational typing
  const links: any[] = (contact as any)?.organizationContactLinks || [];

  const handleToggleRole = (roleValue: string) => {
    const val = roleValue.toLowerCase();
    setSelectedRoles((prev) =>
      prev.some((r) => r.toLowerCase() === val)
        ? prev.filter((r) => r.toLowerCase() !== val)
        : [...prev, val],
    );
  };

  const handleAddLink = async () => {
    if (!selectedOrganization) {
      toast.error('Please select an organization to link');
      return;
    }
    setSaving(true);
    try {
      await api.organizationsControllerAddContact(selectedOrganization.organizationId, {
        contactId,
        primaryFor: selectedRoles,
      });
      toast.success('Organization linked successfully');
      setSelectedOrganization(null);
      setSelectedRoles([]);
      setIsLinking(false);
      onAffiliationUpdated();
    } catch (err) {
      reportError(err, 'ContactAffiliationsTab:handleAddLink');
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLink = async (orgId: string, orgName: string) => {
    if (!window.confirm(`Are you sure you want to unlink ${contact?.firstName || 'this contact'} from ${orgName}?`)) {
      return;
    }
    try {
      await api.organizationsControllerRemoveContact(orgId, contactId);
      toast.success('Organization unlinked successfully');
      onAffiliationUpdated();
    } catch (err) {
      reportError(err, 'ContactAffiliationsTab:handleRemoveLink');
      toast.error(getErrorMessage(err));
    }
  };

  const linkButtonText = isLinking ? 'Cancel' : 'Link Organization';
  const saveButtonText = saving ? 'Linking...' : 'Save Link';

  return (
    <div className="flex flex-col gap-3 max-w-5xl">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined">business</span>
            Organizations
          </h3>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsLinking(!isLinking)}
          >
            {linkButtonText}
          </Button>
        </div>

        {isLinking && (
          <div className="p-4 rounded-lg border border-[var(--border)] flex flex-col gap-4 mb-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Link to Organization
            </h4>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                Select Organization
              </label>
              <OrganizationSelect
                value={selectedOrganization ? selectedOrganization.organizationId : null}
                onChange={setSelectedOrganization}
                placeholder="Search organization name..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-2">
                Designated Dispatch Roles (Primary For)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableRoles.map((role) => {
                  const roleValue = role.value.toLowerCase();
                  const isChecked = selectedRoles.some((r) => r.toLowerCase() === roleValue);
                  return (
                    <label
                      key={role.value}
                      className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRole(role.value)}
                        className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                      <span className="text-[var(--text-primary)] font-medium capitalize">
                        {role.value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsLinking(false);
                  setSelectedOrganization(null);
                  setSelectedRoles([]);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAddLink}
                disabled={saving || !selectedOrganization}
              >
                {saveButtonText}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {links.length > 0 ? (
            links.map((link) => {
              const org = link.organization || link.actor || {};
              const orgId = link.organizationId || link.actorId || org.organizationId || org.actorId;
              const orgName = org.name || 'Unnamed Organization';
              const primaryFor: string[] = link.primaryFor || [];

              return (
                <div
                  key={link.linkId || orgId}
                  className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] flex items-start gap-3 w-full hover:border-[var(--accent)] transition-all"
                >
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                  <span className="material-symbols-outlined text-[var(--accent)] mt-0.5">
                    business
                  </span>

                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link
                        href={`/crm/organizations/${orgId}`}
                        className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                      >
                        {orgName}
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs px-2 py-1 h-auto"
                        onClick={() => handleRemoveLink(orgId, orgName)}
                      >
                        Unlink
                      </Button>
                    </div>

                    <div className="text-sm text-[var(--text-muted)] flex flex-wrap items-center gap-2">
                      {org.industry && <span>Industry: {org.industry}</span>}
                      {org.industry && (org.headquartersCity || org.headquartersCountry) && (
                        <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
                      )}
                      {(org.headquartersCity || org.headquartersCountry) && (
                        <span>
                          Location: {[org.headquartersCity, org.headquartersCountry].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>

                    {primaryFor.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mr-1">
                          Primary Contact For:
                        </span>
                        {primaryFor.map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${getBadgeColor(
                              tag,
                            )}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)] italic pt-1">
                        General contact (no dispatch tags assigned)
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 text-sm py-4">
              No organizations linked to this contact yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Backward-compatibility alias
export const ContactActorsTab = ContactAffiliationsTab;
export const ContactOrganizationsTab = ContactAffiliationsTab;
