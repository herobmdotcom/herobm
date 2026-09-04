'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import { OpportunityCard } from './OpportunityCard';
import { Button } from './Button';
import Link from 'next/link';

interface OpportunitiesTabProps {
  entityId: string;
  entityType: 'actor' | 'contact';
}

export function OpportunitiesTab({
  entityId,
  entityType,
}: OpportunitiesTabProps) {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<
    api.OpportunityResponseDto[]
  >([]);

  useEffect(() => {
    const loadOpportunities = async () => {
      setLoading(true);
      try {
        const query =
          entityType === 'actor'
            ? { actorId: entityId }
            : { contactId: entityId };
        const res = await api.opportunitiesControllerFindAll(query);
        const data = res.data?.data;
        if (Array.isArray(data)) {
          const list = [...data];
          list.sort(
            (a, b) =>
              new Date(b.modifiedOn).getTime() -
              new Date(a.modifiedOn).getTime(),
          );
          setOpportunities(list);
        }
      } catch (err) {
        toast.error('Failed to load opportunities');
        reportError(err, 'OpportunitiesTab');
      } finally {
        setLoading(false);
      }
    };

    loadOpportunities();
  }, [entityId, entityType]);

  if (loading) {
    return (
      <div className="text-gray-500 text-sm py-4">
        Loading opportunities...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-5xl">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            <span className="material-symbols-outlined">trending_up</span>
            Opportunities
          </h3>
          <Button asChild size="sm" variant="secondary">
            <Link href="/crm/opportunities/new">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
              <span className="material-symbols-outlined text-[15px] mr-1">
                add
              </span>
              New Opportunity
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {opportunities.length > 0 ? (
            opportunities.map((opp) => (
              <OpportunityCard key={opp.opportunityId} opportunity={opp} />
            ))
          ) : (
            <div className="text-gray-500 text-sm py-4">
              {/* eslint-disable-next-line i18next/no-literal-string -- Untranslated empty state */}
              No opportunities linked to this {entityType} yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Backward-compatibility alias
export const ProjectsTab = OpportunitiesTab;
