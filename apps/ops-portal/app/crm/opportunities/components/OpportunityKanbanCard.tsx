'use client';

import React from 'react';
import Link from 'next/link';
import type { OpportunityResponseDto } from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import { useSettings } from '@/components/SettingsProvider';

interface OpportunityKanbanCardProps {
  opportunity: OpportunityResponseDto;
  stages: { value: string; label?: string }[];
  onMoveStage: (opportunityId: string, newStage: string) => void;
}

export function OpportunityKanbanCard({
  opportunity,
  stages,
  onMoveStage,
}: OpportunityKanbanCardProps) {
  const { baseCurrency } = useSettings();
  // Extract primary client / organization
  type OrgRef = { organization?: { name?: string }; organizationName?: string; actor?: { name?: string }; actorName?: string };
  const oppOrgs = (opportunity.opportunityOrganizations || opportunity.opportunityActors) as unknown as OrgRef[] | undefined;
  const primaryActor =
    oppOrgs?.[0]?.organization?.name ||
    oppOrgs?.[0]?.organizationName ||
    oppOrgs?.[0]?.actor?.name ||
    oppOrgs?.[0]?.actorName;

  // Extract owner
  type OwnerRef = { displayName?: string; username?: string; email?: string; name?: string };
  const owner = opportunity.owner as OwnerRef | undefined;
  const ownerName =
    (opportunity as unknown as { ownerName?: string; ownerDisplayName?: string }).ownerName ||
    (opportunity as unknown as { ownerName?: string; ownerDisplayName?: string }).ownerDisplayName ||
    owner?.displayName ||
    owner?.username ||
    owner?.name;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', opportunity.opportunityId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const currency = opportunity.currencyCode || baseCurrency;
  const formattedValue = opportunity.estimatedValue
    ? currency
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: currency,
          maximumFractionDigits: 0,
        }).format(Number(opportunity.estimatedValue))
      : Number(opportunity.estimatedValue).toLocaleString()
    : null;

  return (
    <div
      draggable
      data-opportunity-id={opportunity.opportunityId}
      onDragStart={handleDragStart}
      className="card !p-0 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden shadow-none hover:border-[var(--accent)] transition-all cursor-grab active:cursor-grabbing group"
    >
      {/* Card Header with distinct background and full-width border */}
      <div className="px-3.5 pt-2 pb-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/crm/opportunities/${opportunity.opportunityId}`}
            className="font-semibold text-sm text-[var(--text-primary)] hover:text-[var(--accent)] line-clamp-2 transition-colors"
          >
            {opportunity.name}
          </Link>

          {/* Quick stage changer dropdown */}
          <select
            value={opportunity.status}
            onChange={(e) => {
              e.stopPropagation();
              onMoveStage(opportunity.opportunityId, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] py-0.5 px-1 rounded bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Change stage"
          >
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label || s.value}
              </option>
            ))}
          </select>
        </div>

        {primaryActor && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined text-[15px] opacity-70">
              business
            </span>
            <span className="truncate font-medium">{primaryActor}</span>
          </div>
        )}
      </div>

      {/* Card Body: Metadata section */}
      <div className="px-3.5 pt-3 pb-2.5 flex flex-col gap-0.5 text-xs">
        {/* Line 1: Amount & Probability */}
        <div className="flex items-center gap-1.5 text-xs">
          {formattedValue ? (
            <span className="font-bold text-[var(--text-primary)]">
              {formattedValue}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">No value</span>
          )}

          {opportunity.probability !== null &&
            opportunity.probability !== undefined && (
              <>
                <span className="text-[var(--text-muted)]">·</span>
                <span
                  className="font-medium text-[var(--text-secondary)]"
                  title="Probability"
                >
                  {opportunity.probability}%
                </span>
              </>
            )}
        </div>

        {/* Line 2: Close Date */}
        {opportunity.targetCloseDate && (
          <div className="text-[11px] text-[var(--text-muted)]">
            <span>Close: {formatLocalDate(opportunity.targetCloseDate)}</span>
          </div>
        )}

        {/* Line 3: Owner */}
        {ownerName && (
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            <span>Owner: {ownerName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
