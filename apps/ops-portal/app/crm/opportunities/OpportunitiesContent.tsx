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
import { OpportunityKanbanBoard } from './components/OpportunityKanbanBoard';
import { toast } from 'react-hot-toast';

export default function OpportunitiesContent() {
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
    } catch {
      toast.error('Failed to load opportunities');
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
    } catch {
      toast.error('Failed to update stage');
      loadOpportunities();
    }
  };

  const columns = useMemo<ColDef[]>(
    () => [
      { field: 'name', headerName: 'Opportunity Name', minWidth: 200, flex: 2 },
      {
        headerName: 'Client / Actor',
        minWidth: 160,
        flex: 1.5,
        valueGetter: (params) => {
          const actors = params.data?.opportunityActors || params.data?.projectActors;
          return actors?.[0]?.actor?.name || '—';
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
            minimumFractionDigits: 2,
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
    [],
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Top Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Opportunities
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage your sales deals, revenue forecasts, and pipeline stages
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border)] p-0.5 bg-[var(--surface-muted)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? '!bg-[var(--surface)] !text-[var(--text-primary)] shadow-sm'
                  : '!text-[var(--text-secondary)] hover:!text-[var(--text-primary)]'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? '!bg-[var(--surface)] !text-[var(--text-primary)] shadow-sm'
                  : '!text-[var(--text-secondary)] hover:!text-[var(--text-primary)]'
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
      </div>

      {/* Main Content Area */}
      {viewMode === 'kanban' ? (
        <OpportunityKanbanBoard
          opportunities={opportunities}
          stages={stages}
          onMoveStage={handleMoveStage}
          loading={loading}
        />
      ) : (
        <DataGrid
          endpoint="/api/opportunities"
          columns={columns}
          gridKey="crm-opportunities"
          searchPlaceholder="Search opportunities..."
          exportFileName="opportunities"
          rowIdField="opportunityId"
          rowHref={(row) => `/crm/opportunities/${row.opportunityId}`}
          defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        />
      )}
    </div>
  );
}
