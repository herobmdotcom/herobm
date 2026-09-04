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
  // Extract primary client / actor
  type ActorRef = { actor?: { name?: string }; actorName?: string };
  const oppActors = opportunity.opportunityActors as unknown as ActorRef[] | undefined;
  const primaryActor =
    oppActors?.[0]?.actor?.name ||
    oppActors?.[0]?.actorName;

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
      onDragStart={handleDragStart}
      className="card p-3.5 flex flex-col gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-none hover:border-[var(--accent)] transition-all cursor-grab active:cursor-grabbing group"
    >
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

      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-xs">
        {formattedValue ? (
          <span className="font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded text-[11px]">
            {formattedValue}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] text-[11px]">No value</span>
        )}

        {opportunity.probability !== null &&
          opportunity.probability !== undefined && (
            <span
              className="text-[11px] font-medium text-[var(--text-secondary)]"
              title="Probability"
            >
              {opportunity.probability}%
            </span>
          )}
      </div>

      {opportunity.targetCloseDate && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
          <span className="material-symbols-outlined text-[13px]">event</span>
          <span>Close: {formatLocalDate(opportunity.targetCloseDate)}</span>
        </div>
      )}
    </div>
  );
}
