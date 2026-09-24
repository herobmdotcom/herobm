'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ColDef } from 'ag-grid-community';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { useSettings } from '@/components/SettingsProvider';
import { PROJECT_STATE, PROJECT_BILLING_TYPE } from '@herobm/shared';

export interface ProjectsDetailGridProps {
  customerId?: string;
  opportunityId?: string;
  title?: string;
  showCustomerColumn?: boolean;
  createButtonLabel?: string;
  headerActions?: React.ReactNode;
  hideHeaderActions?: boolean;
  limit?: number;
  gridKey?: string;
  exportFileName?: string;
}

export interface ProjectGridRow {
  id?: string;
  projectId?: string;
  projectNumber?: string;
  name?: string;
  stage?: string | null;
  stateCode?: string;
  billingType?: string;
  currencyCode?: string | null;
  customer?: {
    customerId?: string;
    customerNumber?: string;
    name?: string;
    organization?: {
      name?: string;
    };
  } | null;
  customerName?: string | null;
  projectManager?: {
    displayName?: string;
    username?: string;
    name?: string;
  } | null;
  budgetLines?: Array<{
    totalCost?: string | number;
    totalPrice?: string | number;
    actualCost?: string | number;
    actualRevenue?: string | number;
  }> | null;
  ledgerEntries?: Array<{
    totalCostBase?: string | number;
    totalPriceBase?: string | number;
  }> | null;
  createdOn?: string | number | Date | null;
}

function getProjectStatusBadgeClass(status: string) {
  const s = (status || '').toLowerCase();
  if (s === PROJECT_STATE.DRAFT) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
  if (s === PROJECT_STATE.ACTIVE) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (s === PROJECT_STATE.CLOSED) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }
  return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
}

function formatBillingType(type?: string) {
  switch (type) {
    case PROJECT_BILLING_TYPE.TIME_AND_MATERIALS:
      return 'Time & Materials';
    case PROJECT_BILLING_TYPE.FIXED_PRICE:
      return 'Fixed Price';
    case PROJECT_BILLING_TYPE.MILESTONE:
      return 'Milestone Based';
    case PROJECT_BILLING_TYPE.COST_PLUS:
      return 'Cost Plus';
    default:
      return type ? type.replace(/_/g, ' ').toUpperCase() : '—';
  }
}

export function ProjectsDetailGrid({
  customerId,
  opportunityId,
  title,
  showCustomerColumn,
  createButtonLabel,
  headerActions,
  hideHeaderActions = false,
  limit = 50,
  gridKey,
  exportFileName,
}: ProjectsDetailGridProps) {
  const tProjects = useTranslations('projects');
  const tStates = useTranslations('common.states');
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (opportunityId) params.set('opportunityId', opportunityId);
    params.set('limit', String(limit));
    return `/api/projects?${params.toString()}`;
  }, [customerId, opportunityId, limit]);

  const shouldShowCustomer = showCustomerColumn !== undefined ? showCustomerColumn : !customerId;

  const columns = useMemo<ColDef<ProjectGridRow>[]>(
    () => [
      {
        field: 'projectNumber',
        headerName: tProjects('columns.projectCode'),
        width: 150,
        pinned: 'left',
        cellRenderer: (p: { value?: string; data?: ProjectGridRow }) => {
          if (!p.value) return '—';
          const projId = p.data?.projectId || p.data?.id;
          return (
            <Link
              href={`/projects/${projId}`}
              className="font-semibold text-[var(--accent)] hover:underline font-mono"
            >
              {p.value}
            </Link>
          );
        },
      },
      {
        field: 'name',
        headerName: tProjects('columns.name'),
        minWidth: 180,
        flex: 1.5,
      },
      ...(shouldShowCustomer
        ? [
            {
              headerName: tProjects('columns.customer'),
              minWidth: 160,
              flex: 1.2,
              valueGetter: (p: { data?: ProjectGridRow }) =>
                p.data?.customerName ||
                p.data?.customer?.organization?.name ||
                p.data?.customer?.name ||
                p.data?.customer?.customerNumber ||
                '—',
            },
          ]
        : []),
      {
        field: 'stage',
        headerName: tProjects('columns.stage'),
        width: 130,
        valueFormatter: (p: { value?: string | null }) => p.value || '—',
      },
      {
        field: 'stateCode',
        headerName: tProjects('columns.status'),
        width: 120,
        cellRenderer: (p: { value?: string }) => {
          if (!p.value) return '—';
          const s = String(p.value).toLowerCase();
          const badgeClass = getProjectStatusBadgeClass(s);
          const label = tStates.has(s as Parameters<typeof tStates>[0])
            ? tStates(s as Parameters<typeof tStates>[0])
            : String(p.value).toUpperCase();
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${badgeClass}`}
            >
              {label}
            </span>
          );
        },
      },
      {
        field: 'billingType',
        headerName: tProjects('columns.billingType'),
        width: 150,
        valueFormatter: (p: { value?: string }) => formatBillingType(p.value),
      },
      {
        headerName: tProjects('columns.budget'),
        width: 130,
        type: 'numericColumn',
        valueGetter: (p: { data?: ProjectGridRow }) => {
          if (!p.data) return null;
          if (!p.data.budgetLines || p.data.budgetLines.length === 0) return 0;
          return p.data.budgetLines.reduce((sum, b) => sum + Number(b.totalCost || 0), 0);
        },
        valueFormatter: (p: { value?: number | null; data?: ProjectGridRow }) => {
          if (p.value === null || p.value === undefined) return '—';
          const rowCurr = p.data?.currencyCode || baseCurrency || 'USD';
          return formatAmount(p.value, rowCurr);
        },
      },
      {
        headerName: tProjects('columns.revenue'),
        width: 130,
        type: 'numericColumn',
        valueGetter: (p: { data?: ProjectGridRow }) => {
          if (!p.data) return null;
          const budgetActualRevenue = p.data.budgetLines?.reduce(
            (sum, b) => sum + Number(b.actualRevenue || 0),
            0,
          );
          if (budgetActualRevenue !== undefined && budgetActualRevenue > 0) {
            return budgetActualRevenue;
          }
          const ledgerRevenue = p.data.ledgerEntries?.reduce(
            (sum, e) => sum + Number(e.totalPriceBase || 0),
            0,
          );
          return ledgerRevenue ?? (budgetActualRevenue ?? 0);
        },
        valueFormatter: (p: { value?: number | null; data?: ProjectGridRow }) => {
          if (p.value === null || p.value === undefined) return '—';
          const rowCurr = p.data?.currencyCode || baseCurrency || 'USD';
          return formatAmount(p.value, rowCurr);
        },
      },
      {
        headerName: tProjects('columns.manager'),
        width: 150,
        valueGetter: (p: { data?: ProjectGridRow }) =>
          p.data?.projectManager?.displayName ||
          p.data?.projectManager?.username ||
          p.data?.projectManager?.name ||
          '—',
      },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 120,
        valueFormatter: (p: { value?: string | number | Date | null }) =>
          p.value ? formatLocalDate(p.value) : '—',
      },
    ],
    [tProjects, tStates, tCommon, shouldShowCustomer, baseCurrency],
  );

  const defaultHeaderActions = useMemo(() => {
    if (hideHeaderActions) return undefined;
    if (headerActions) return headerActions;

    const queryParams: string[] = [];
    if (opportunityId) queryParams.push(`opportunityId=${encodeURIComponent(opportunityId)}`);
    if (customerId) queryParams.push(`customerId=${encodeURIComponent(customerId)}`);
    const qs = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    const label =
      createButtonLabel ||
      (tProjects.has('buttons.createProject')
        ? tProjects('buttons.createProject')
        : 'Create Project');

    return (
      <Button asChild size="sm" variant="primary">
        <Link href={`/projects/new${qs}`}>{label}</Link>
      </Button>
    );
  }, [hideHeaderActions, headerActions, opportunityId, customerId, createButtonLabel, tProjects]);

  const defaultKey = gridKey || `projects-detail-grid-${customerId || ''}-${opportunityId || ''}`;
  const defaultTitle = title || tProjects('title');

  return (
    <DetailTabGrid<ProjectGridRow>
      title={defaultTitle}
      endpoint={endpoint}
      columns={columns}
      gridKey={defaultKey}
      urlPrefix="projects"
      searchPlaceholder={tProjects('placeholders.searchProjects')}
      exportFileName={exportFileName || 'projects'}
      fetchAll
      rowIdField="projectId"
      rowHref={(proj: { projectId?: string; id?: string }) => `/projects/${proj.projectId || proj.id}`}
      headerActions={defaultHeaderActions}
    />
  );
}

export default ProjectsDetailGrid;
