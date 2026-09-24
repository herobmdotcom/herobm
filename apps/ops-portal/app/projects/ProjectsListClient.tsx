'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import { useSettings } from '@/components/SettingsProvider';
import type { ColDef } from 'ag-grid-community';
import type { ProjectResponseDto } from '@herobm/sdk';

export default function ProjectsListClient() {
  const t = useTranslations('projects');
  const tStates = useTranslations('common.states');
  const { app: appSettings } = useSettings();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const projectStages = (appSettings?.projectStages || []) as Array<{ value: string; order?: number }>;
  const sortedStages = useMemo(
    () => [...projectStages].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [projectStages]
  );

  const columns = useMemo<ColDef<ProjectResponseDto>[]>(
    () => [
      {
        field: 'projectNumber',
        headerName: t('columns.projectCode'),
        width: 150,
        pinned: 'left',
        cellRenderer: (params: { value?: string }) => (
          <span className="font-semibold text-[var(--accent)]">{params.value}</span>
        ),
      },
      {
        field: 'name',
        headerName: t('columns.name'),
        minWidth: 200,
        flex: 2,
      },
      {
        headerName: t('columns.customer'),
        minWidth: 160,
        flex: 1.5,
        valueGetter: (params) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK untyped relation helper
          const cust = params.data?.customer as any;
          return cust?.customerName || cust?.name || cust?.customerNumber || '—';
        },
      },
      {
        field: 'stage',
        headerName: t('columns.stage'),
        width: 140,
        valueFormatter: (params) => (params.value as string) || '—',
      },
      {
        field: 'stateCode',
        headerName: t('columns.status'),
        width: 140,
        valueFormatter: (params) => {
          if (!params.value) return '—';
          const s = String(params.value).toLowerCase();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic translation key from API state code
          return tStates.has(s as any) ? tStates(s as any) : String(params.value);
        },
      },
      {
        field: 'billingType',
        headerName: t('columns.billingType'),
        width: 150,
        valueFormatter: (params) => {
          if (!params.value) return '—';
          return (params.value as string).replace(/_/g, ' ').toUpperCase();
        },
      },
      {
        field: 'startDate',
        headerName: t('columns.startDate'),
        width: 120,
        valueFormatter: (params) => {
          return params.value ? formatLocalDate(params.value as string) : '—';
        },
      },
      {
        field: 'targetEndDate',
        headerName: t('columns.endDate'),
        width: 120,
        valueFormatter: (params) => {
          return params.value ? formatLocalDate(params.value as string) : '—';
        },
      },
      {
        headerName: t('columns.manager'),
        width: 150,
        valueGetter: (params) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK untyped relation helper
          const mgr = params.data?.projectManager as any;
          return mgr?.name || mgr?.email || '—';
        },
      },
    ],
    [t]
  );

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') {
      params.set('stateCode', statusFilter);
    }
    if (stageFilter && stageFilter !== 'all') {
      params.set('stage', stageFilter);
    }
    const qs = params.toString();
    return qs ? `/api/projects?${qs}` : '/api/projects';
  }, [statusFilter, stageFilter]);

  return (
    <DataGrid<ProjectResponseDto>
      endpoint={endpoint}
      columns={columns}
      customFieldEntityType="projects"
      gridKey="projects-list"
      searchPlaceholder={t('placeholders.searchProjects')}
      exportFileName="projects"
      rowIdField="projectId"
      rowHref={(row) => `/projects/${row.projectId}`}
      pageTitle={t('title')}
      defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
      headerFilters={
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          {sortedStages.length > 0 && (
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="all">All Stages</option>
              {sortedStages.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value}
                </option>
              ))}
            </select>
          )}
        </div>
      }
      headerActions={
        <Button asChild variant="primary">
          <Link href="/projects/new">
            {t('buttons.createProject')}
          </Link>
        </Button>
      }
    />
  );
}
