import React from 'react';
import Link from 'next/link';
import { formatLocalDate } from '@/lib/date';
import type { OpportunityResponseDto } from '@herobm/sdk';

interface OpportunityCardProps {
  opportunity: OpportunityResponseDto;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const id = opportunity.opportunityId;
  const currency = opportunity.currencyCode || 'USD';
  const formattedValue = opportunity.estimatedValue
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
      }).format(Number(opportunity.estimatedValue))
    : null;

  return (
    <Link
      href={`/crm/opportunities/${id}`}
      className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] flex items-start gap-3 w-full hover:border-[var(--accent)] hover:shadow-sm transition-all cursor-pointer block"
    >
      <span className="material-symbols-outlined text-[var(--accent)] mt-0.5">
        trending_up
      </span>

      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-[var(--text-primary)]">
            {opportunity.name}
          </span>
          {formattedValue && (
            <span className="text-xs font-bold bg-[var(--surface-muted)] px-2 py-0.5 rounded text-[var(--text-primary)]">
              {formattedValue}
            </span>
          )}
        </div>

        <div className="text-sm text-[var(--text-muted)] flex flex-wrap items-center gap-2">
          <span className="capitalize">Type: {opportunity.type.replace('_', ' ')}</span>
          <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
          <span className="capitalize">Stage: {opportunity.status.replace('_', ' ')}</span>
          {opportunity.probability !== null && opportunity.probability !== undefined && (
            <>
              <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
              <span>Win: {opportunity.probability}%</span>
            </>
          )}
          <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
          <span>Created: {formatLocalDate(opportunity.createdOn)}</span>
        </div>
      </div>
    </Link>
  );
}

// Backward-compatibility alias
export const ProjectCard = ({ project }: { project: OpportunityResponseDto }) => (
  <OpportunityCard opportunity={project} />
);
