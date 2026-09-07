'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import { getBadgeColor } from '@/lib/utils';
import { reportError } from '@/lib/api';
import { getErrorMessage } from '@herobm/shared';
import * as api from '@herobm/sdk';
import type { ContactResponseDto } from '@herobm/sdk';

interface ContactAffiliationsTabProps {
  contactId: string;
  contact: ContactResponseDto | null;
  onAffiliationUpdated: () => void;
}

const DISPATCH_ROLES = [
  { id: 'billing', label: 'Billing / Invoicing' },
  { id: 'shipping', label: 'Shipping / Receiving' },
  { id: 'purchasing', label: 'Purchasing / Procurement' },
  { id: 'sales', label: 'Sales Orders' },
  { id: 'general', label: 'General Notices' },
];

export function ContactAffiliationsTab({
  contactId,
  contact,
  onAffiliationUpdated,
}: ContactAffiliationsTabProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO relational typing
  const links: any[] = (contact as any)?.actorContactLinks || [];

  const handleToggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  };

  const handleAddLink = async () => {
    if (!selectedActor) {
      toast.error('Please select a company to link');
      return;
    }
    setSaving(true);
    try {
      await api.actorsControllerAddContact(selectedActor.actorId, {
        contactId,
        primaryFor: selectedRoles,
      });
      toast.success('Company affiliation added');
      setSelectedActor(null);
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

  const handleRemoveLink = async (actorId: string, actorName: string) => {
    if (!window.confirm(`Are you sure you want to unlink ${contact?.firstName || 'this contact'} from ${actorName}?`)) {
      return;
    }
    try {
      await api.actorsControllerRemoveContact(actorId, contactId);
      toast.success('Company affiliation removed');
      onAffiliationUpdated();
    } catch (err) {
      reportError(err, 'ContactAffiliationsTab:handleRemoveLink');
      toast.error(getErrorMessage(err));
    }
  };

  const linkButtonText = isLinking ? 'Cancel' : 'Link Company';
  const saveButtonText = saving ? 'Linking...' : 'Save Affiliation';

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Affiliated Companies & Organizations
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Companies where this contact is employed, sits on the board, or acts as a designated dispatch contact
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsLinking(!isLinking)}
        >
          {linkButtonText}
        </Button>
      </div>

      {isLinking && (
        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--accent)]/30 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Link to Company
          </h3>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
              Select Company / Actor
            </label>
            <ActorSelect
              value={selectedActor ? selectedActor.actorId : null}
              onChange={setSelectedActor}
              placeholder="Search company name..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] block mb-2">
              Designated Dispatch Roles (Primary For)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DISPATCH_ROLES.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => handleToggleRole(role.id)}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-[var(--text-primary)] font-medium">
                    {role.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsLinking(false);
                setSelectedActor(null);
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
              disabled={saving || !selectedActor}
            >
              {saveButtonText}
            </Button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">
            No Company Affiliations
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            This contact is currently not linked to any company or organization.
          </p>
          <div className="mt-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsLinking(true)}
            >
              Link to First Company
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((link) => {
            const actor = link.actor || {};
            const actorName = actor.name || 'Unnamed Company';
            const primaryFor: string[] = link.primaryFor || [];

            return (
              <div
                key={link.linkId || link.actorId}
                className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col justify-between gap-3 hover:border-[var(--accent)]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/crm/actors/${link.actorId}`}
                      className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                    >
                      {actorName}
                    </Link>
                    {actor.industry && (
                      <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                        Industry: {actor.industry}
                      </span>
                    )}
                    {actor.headquartersCity && (
                      <span className="text-xs text-[var(--text-muted)] block">
                        Location: {actor.headquartersCity}
                        {actor.headquartersCountry ? `, ${actor.headquartersCountry}` : ''}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs px-2 py-1 h-auto"
                    onClick={() => handleRemoveLink(link.actorId, actorName)}
                  >
                    Unlink
                  </Button>
                </div>

                {primaryFor.length > 0 ? (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--text-muted)] block mb-1 uppercase font-semibold">
                      Primary Contact For
                    </span>
                    <div className="flex flex-wrap gap-1">
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
                  </div>
                ) : (
                  <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] italic">
                    General contact (no dispatch tags assigned)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
