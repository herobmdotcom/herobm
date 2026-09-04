'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import { getBadgeColor } from '@/lib/utils';
import { reportError } from '@/lib/api';
import { getErrorMessage } from '@herobm/shared';
import * as api from '@herobm/sdk';
import type { ActorLinkResponseDto } from '@herobm/sdk';

interface ActorHierarchyTabProps {
  actorId: string;
}

type LinkTypeOption = 'parent_company' | 'subsidiary' | 'partner';

export function ActorHierarchyTab({ actorId }: ActorHierarchyTabProps) {
  const [links, setLinks] = useState<ActorLinkResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkTypeOption>('subsidiary');
  const [saving, setSaving] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.actorsControllerGetLinks(actorId);
      setLinks((res.data as unknown as ActorLinkResponseDto[]) || []);
    } catch (err) {
      reportError(err, 'ActorHierarchyTab:loadLinks');
      toast.error('Failed to load corporate links');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleAddLink = async () => {
    if (!selectedActor) {
      toast.error('Please select an actor to link');
      return;
    }
    setSaving(true);
    try {
      await api.actorsControllerAddLink(actorId, {
        targetActorId: selectedActor.actorId,
        linkType: selectedLinkType,
      });
      toast.success('Corporate link added');
      setSelectedActor(null);
      setIsLinking(false);
      await loadLinks();
    } catch (err) {
      reportError(err, 'ActorHierarchyTab:handleAddLink');
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLink = async (linkId: string, partnerName: string) => {
    if (!window.confirm(`Are you sure you want to remove the link with ${partnerName}?`)) {
      return;
    }
    try {
      await api.actorsControllerRemoveLink(actorId, linkId);
      toast.success('Corporate link removed');
      await loadLinks();
    } catch (err) {
      reportError(err, 'ActorHierarchyTab:handleRemoveLink');
      toast.error(getErrorMessage(err));
    }
  };

  // Categorize links from this actor's perspective
  const categorized = links.map((link) => {
    const isSource = link.sourceActorId === actorId;
    const partner = isSource ? link.targetActor : link.sourceActor;
    let effectiveRole = link.linkType;

    if (!isSource) {
      if (link.linkType === 'subsidiary') effectiveRole = 'parent_company';
      else if (link.linkType === 'parent_company') effectiveRole = 'subsidiary';
    }

    return {
      linkId: link.linkId,
      partnerId: partner?.actorId || (isSource ? link.targetActorId : link.sourceActorId),
      partnerName: partner?.name || 'Unknown Actor',
      partnerIndustry: partner?.industry,
      effectiveRole,
      rawLinkType: link.linkType,
      isSource,
    };
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'parent_company':
        return 'Parent Company';
      case 'subsidiary':
        return 'Subsidiary';
      case 'partner':
        return 'Strategic Partner';
      case 'referrer':
        return 'Referrer';
      default:
        return role.replace(/_/g, ' ');
    }
  };

  const linkButtonText = isLinking ? 'Cancel' : 'Link Company';
  const saveButtonText = saving ? 'Linking...' : 'Save Link';

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Corporate Hierarchy & Affiliates
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Manage parent companies, subsidiaries, and strategic partners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/crm/map?actorId=${actorId}`}>
              View Network Graph
            </Link>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsLinking(!isLinking)}
          >
            {linkButtonText}
          </Button>
        </div>
      </div>

      {isLinking && (
        <div className="p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--accent)]/30 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Link Related Company
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                Select Company
              </label>
              <ActorSelect
                value={selectedActor ? selectedActor.actorId : null}
                onChange={setSelectedActor}
                excludeId={actorId}
                placeholder="Search by company name..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                Relationship Type
              </label>
              <select
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                value={selectedLinkType}
                onChange={(e) => setSelectedLinkType(e.target.value as LinkTypeOption)}
              >
                <option value="parent_company">Parent Company (target is parent of this actor)</option>
                <option value="subsidiary">Subsidiary (target is owned by this actor)</option>
                <option value="partner">Strategic Partner / Affiliate</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsLinking(false);
                setSelectedActor(null);
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

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          Loading corporate structure...
        </div>
      ) : categorized.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">
            No Corporate Links Established
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            This company has no parent companies, subsidiaries, or partner relations recorded yet.
          </p>
          <div className="mt-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsLinking(true)}
            >
              Link First Company
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categorized.map((item) => (
            <div
              key={item.linkId}
              className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex items-start justify-between gap-4 hover:border-[var(--accent)]/40 transition-colors"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/crm/actors/${item.partnerId}`}
                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline truncate"
                  >
                    {item.partnerName}
                  </Link>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${getBadgeColor(
                      item.effectiveRole,
                    )}`}
                  >
                    {getRoleLabel(item.effectiveRole)}
                  </span>
                </div>
                {item.partnerIndustry && (
                  <span className="text-xs text-[var(--text-muted)]">
                    Industry: {item.partnerIndustry}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 text-xs px-2 py-1 h-auto"
                onClick={() => handleRemoveLink(item.linkId, item.partnerName)}
              >
                Unlink
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
