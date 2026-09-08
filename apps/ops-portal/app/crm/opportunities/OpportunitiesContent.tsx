'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import DataGrid from '@/components/shared/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import * as api from '@herobm/sdk';
import type { OpportunityResponseDto } from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslations } from 'next-intl';
import { OpportunityKanbanBoard } from './components/OpportunityKanbanBoard';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

export default function OpportunitiesContent() {
  const tGrid = useTranslations('common.grid');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [opportunities, setOpportunities] = useState<OpportunityResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const { app: appSettings, baseCurrency } = useSettings();

  const stages = useMemo(() => {
    const list = appSettings?.opportunityStages || appSettings?.projectStatuses;
    if (list && list.length > 0) {
      return [...list]
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map((s) => ({ value: s.value, label: s.value }));
    }
    return [];
  }, [appSettings?.opportunityStages, appSettings?.projectStatuses]);

  // Load opportunities for Kanban
  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.opportunitiesControllerFindAll();
      const items = res.data?.data || [];
      setOpportunities(Array.isArray(items) ? items : []);
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleMoveStage = async (opportunityId: string, newStage: string) => {
    // Optimistic update
    setOpportunities((prev) =>
      prev.map((opp) =>
        opp.opportunityId === opportunityId ? { ...opp, status: newStage } : opp,
      ),
    );

    try {
      await api.opportunitiesControllerUpdate(opportunityId, { status: newStage });
      toast.success(`Moved to ${newStage}`);
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Failed to update stage');
      loadOpportunities();
    }
  };

  const columns = useMemo<ColDef[]>(
    () => [
      { field: 'name', headerName: 'Opportunity Name', minWidth: 200, flex: 2 },
      {
        headerName: 'Client / Organization',
        minWidth: 160,
        flex: 1.5,
        valueGetter: (params) => {
          const orgs = params.data?.opportunityOrganizations || params.data?.opportunityActors || params.data?.projectActors;
          return orgs?.[0]?.organization?.name || orgs?.[0]?.actor?.name || '—';
        },
      },
      { field: 'status', headerName: 'Stage', width: 140 },
      {
        field: 'estimatedValue',
        headerName: 'Value',
        width: 140,
        valueFormatter: (p) => {
          if (!p.value) return '—';
          const curr = p.data?.currencyCode || baseCurrency;
          const num = Number(p.value);
          if (!curr) return num.toLocaleString();
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: curr,
            maximumFractionDigits: 0,
          }).format(num);
        },
      },
      {
        field: 'dealRevenue',
        headerName: 'Deal Revenue',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => {
          if (p.value === null || p.value === undefined) return '—';
          const curr = p.data?.currencyCode || baseCurrency;
          const num = Number(p.value);
          if (!curr) return num.toLocaleString();
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: curr,
            maximumFractionDigits: 2,
          }).format(num);
        },
      },
      {
        field: 'probability',
        headerName: 'Win %',
        width: 110,
        valueFormatter: (p) => (p.value !== null && p.value !== undefined ? `${p.value}%` : '—'),
      },
      {
        field: 'targetCloseDate',
        headerName: 'Close Date',
        width: 140,
        valueFormatter: (p) => (p.value ? formatLocalDate(p.value) : '—'),
      },
      { field: 'type', headerName: 'Type', width: 130 },
      {
        field: 'createdOn',
        headerName: 'Created',
        width: 130,
        valueFormatter: (p) => formatLocalDate(p.value),
      },
    ],
    [baseCurrency],
  );

  const headerActions = (
    <div className="flex items-center gap-3">
      {/* View Mode Toggle */}
      <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-secondary)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('kanban')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
            viewMode === 'kanban'
              ? '!bg-white dark:!bg-white/20 !text-[var(--text-primary)] dark:!text-white font-semibold shadow-sm border border-black/5 dark:border-white/15'
              : '!bg-transparent !text-[var(--text-muted)] hover:!text-[var(--text-primary)] font-medium border border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">view_kanban</span>
          Kanban
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
            viewMode === 'list'
              ? '!bg-white dark:!bg-white/20 !text-[var(--text-primary)] dark:!text-white font-semibold shadow-sm border border-black/5 dark:border-white/15'
              : '!bg-transparent !text-[var(--text-muted)] hover:!text-[var(--text-primary)] font-medium border border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
          List
        </Button>
      </div>

      <Button asChild variant="primary">
        <Link href="/crm/opportunities/new">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
          <span className="material-symbols-outlined text-[18px] mr-1.5">add</span>
          New Opportunity
        </Link>
      </Button>
    </div>
  );

  const hasConfiguredStages = stages.length > 0;

  const crmWarningBanner = !hasConfiguredStages ? (
    <div
      data-testid="crm-settings-warning"
      className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0"
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[24px] text-amber-600 dark:text-amber-400 shrink-0">
          warning
        </span>
        <div>
          <h4 className="text-sm font-semibold">CRM Settings Required</h4>
          <p className="text-xs text-amber-700 dark:text-amber-400/90">
            Opportunity stages have not been defined. Configure stages in CRM Settings to manage deals and enable the Kanban pipeline.
          </p>
        </div>
      </div>
      <Button asChild variant="secondary" size="sm" className="shrink-0 border-amber-500/40 hover:bg-amber-500/20 text-xs font-semibold">
        <Link href="/admin/settings/crm">
          Configure CRM Settings
          <span className="material-symbols-outlined text-[16px] ml-1">arrow_forward</span>
        </Link>
      </Button>
    </div>
  ) : null;

  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col">
        {crmWarningBanner && <div className="p-4 lg:px-6 lg:pt-6 pb-0">{crmWarningBanner}</div>}
        <div className="flex-1 min-h-0">
          <DataGrid
            endpoint="/api/opportunities"
            columns={columns}
            gridKey="crm-opportunities"
            searchPlaceholder="Search opportunities..."
            exportFileName="opportunities"
            rowIdField="opportunityId"
            rowHref={(row) => `/crm/opportunities/${row.opportunityId}`}
            pageTitle="Opportunities"
            defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
            headerActions={headerActions}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:h-full flex flex-col relative p-4 lg:p-6">
      {crmWarningBanner}
      <div className="relative lg:h-full flex flex-col min-h-0">
        <div className="flex-1 lg:min-h-0 flex flex-col z-10 lg:bg-[var(--bg-card)] lg:rounded-xl lg:border lg:border-[var(--border)] lg:overflow-hidden transition-all">
          {/* Header matching standard template */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between lg:px-6 pt-4 pb-2 lg:pt-4 lg:pb-2 gap-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between lg:justify-start gap-4 w-full lg:w-auto">
              <div className="flex items-center justify-between w-full lg:w-auto gap-4 min-w-0">
                <div className="flex items-center gap-4 min-w-0">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] truncate min-w-0">
                    Opportunities
                  </h2>
                  <div className="hidden lg:block h-5 w-px bg-[var(--border)] shrink-0" />
                  <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shrink-0">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">
                      {tGrid('rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                      {loading ? '...' : opportunities.length.toLocaleString()}
                    </span>
                  </div>
                </div>
                {/* Mobile header actions */}
                <div className="lg:hidden flex-1 flex items-center justify-end min-w-0 ml-4">
                  {headerActions}
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-end gap-3">
              {headerActions}
            </div>
          </div>

          {/* Kanban Board Area */}
          <div className="flex-1 min-h-0 p-4 lg:px-6 lg:pb-6 overflow-hidden">
            <OpportunityKanbanBoard
              opportunities={opportunities}
              stages={stages}
              onMoveStage={handleMoveStage}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
