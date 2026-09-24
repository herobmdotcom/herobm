'use client';

import React, { useMemo } from 'react';
import { useSettings } from '@/components/SettingsProvider';
import { SalesOrdersDetailGrid } from '@/components/shared/SalesOrdersDetailGrid';
import { ProjectsDetailGrid } from '@/components/shared/ProjectsDetailGrid';

interface OpportunityCommercialTabProps {
  opportunityId: string;
  opportunityName?: string;
  customerId?: string | null;
  currencyCode?: string | null;
  dealRevenue?: number | null;
  quoteCount?: number | null;
  projectCount?: number | null;
}

export default function OpportunityCommercialTab({
  opportunityId,
  customerId,
  currencyCode,
  dealRevenue = 0,
  quoteCount = 0,
  projectCount = 0,
}: OpportunityCommercialTabProps) {
  const { baseCurrency } = useSettings();
  const activeCurrency = currencyCode || baseCurrency;

  const formattedRevenue = useMemo(() => {
    const num = Number(dealRevenue || 0);
    if (!activeCurrency) {
      return num.toLocaleString();
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
    }).format(num);
  }, [dealRevenue, activeCurrency]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Simple Commercial Stat Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-[var(--text-muted)] block uppercase font-medium tracking-wider">
              Deal Revenue
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1 block">
              {formattedRevenue}
            </span>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              Live aggregation of quote line items
            </span>
          </div>

          <div>
            <span className="text-xs text-[var(--text-muted)] block uppercase font-medium tracking-wider">
              Quotes & Orders
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1 block">
              {quoteCount}
            </span>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              Associated active quotes & orders
            </span>
          </div>

          <div>
            <span className="text-xs text-[var(--text-muted)] block uppercase font-medium tracking-wider">
              Delivery Projects
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1 block">
              {projectCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              Linked operational service jobs
            </span>
          </div>
        </div>
      </div>

      {/* Embedded Sales Quotes Grid */}
      <SalesOrdersDetailGrid
        title="Sales Quotes & Orders"
        opportunityId={opportunityId}
        customerId={customerId || undefined}
        currencyCode={activeCurrency || undefined}
        createButtonLabel="Create Quote"
        gridKey={`opportunity-quotes-${opportunityId}`}
        showCustomerColumn
      />

      {/* Embedded Linked Projects Grid */}
      <ProjectsDetailGrid
        title="Delivery Projects"
        opportunityId={opportunityId}
        customerId={customerId || undefined}
        createButtonLabel="Create Project"
        gridKey={`opportunity-projects-${opportunityId}`}
        showCustomerColumn
      />
    </div>
  );
}
