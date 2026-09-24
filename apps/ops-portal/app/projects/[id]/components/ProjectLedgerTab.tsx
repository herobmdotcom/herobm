'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import * as api from '@herobm/sdk';
import { DataTable, DataTableColumn, MobileCardField } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import Tabs, { TabItem } from '@/components/shared/Tabs';
import { Button } from '@/components/shared/Button';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { formatLocalDate } from '@/lib/date';
import { formatAmount } from '@/lib/currency';
import { routes } from '@/lib/routes';
import { reportError } from '@/lib/api';
import { PROJECT_LINE_TYPE } from '@herobm/shared';
import { ConsumeProjectExpenseSlideOver } from './ConsumeProjectExpenseSlideOver';
import { BillProjectSlideOver } from './BillProjectSlideOver';

interface ProjectLedgerTabProps {
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  ledgerEntries: api.ProjectLedgerEntryResponseDto[];
  tasks?: api.ProjectTaskResponseDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  invoices?: api.SalesInvoiceResponseDto[];
  currency: string;
  isEditable?: boolean;
  profitability?: api.ProjectProfitabilityResponseDto | null;
  projectBillingType?: string;
  paymentTerms?: string;
  discountPercentage?: number;
  consumeExpense?: (dto: api.ConsumeExpenseDto) => Promise<void>;
  billProject?: (dto: api.BillProjectDto) => Promise<api.ProjectBillingResponseDto | unknown>;
  setLedgerEntryBillable?: (ledgerId: string, isBillable: boolean) => Promise<void>;
  reloadProject?: () => Promise<void>;
}

interface TaskLedgerGroup {
  key: string;
  taskId?: string;
  task?: api.ProjectTaskResponseDto;
  taskCode?: string;
  taskName: string;
  taskDescription?: string;
  entries: api.ProjectLedgerEntryResponseDto[];
  totalActualCost: number;
  totalActualRevenue: number;
  totalQuantity: number;
  unbilledCount: number;
  billedCount: number;
}

type BillingFilterTab = 'all' | 'unbilled' | 'billed' | 'non_billable';

function getTaskDisplayName(task?: api.ProjectTaskResponseDto, count?: number): string {
  if (!task) return '—';
  const prefix = task.taskCode ? `${task.taskCode} - ${task.name}` : task.name;
  return count !== undefined ? `${prefix} (${count})` : prefix;
}

export function ProjectLedgerTab({
  projectId = '',
  projectNumber,
  projectName,
  ledgerEntries,
  tasks = [],
  budgetLines = [],
  invoices = [],
  currency,
  isEditable = false,
  profitability = null,
  projectBillingType,
  paymentTerms,
  discountPercentage,
  consumeExpense,
  billProject,
  setLedgerEntryBillable,
  reloadProject,
}: ProjectLedgerTabProps) {
  const t = useTranslations('projects');
  const [showExpenseSlideOver, setShowExpenseSlideOver] = useState<boolean>(false);
  const [showBillSlideOver, setShowBillSlideOver] = useState<boolean>(false);
  const [activeBillingTab, setActiveBillingTab] = useState<BillingFilterTab>('all');

  const [paginatedEntries, setPaginatedEntries] = useState<api.ProjectLedgerEntryResponseDto[]>(ledgerEntries || []);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(ledgerEntries?.length || 0);

  const fetchLedger = React.useCallback(async (cursorToFetch?: string | null, append = false) => {
    if (!projectId) return;
    setLoadingEntries(true);
    try {
      const res = await api.projectsControllerGetLedgerEntries(projectId, {
        cursor: cursorToFetch || undefined,
        limit: 50,
      });
      const data = res.data as { data?: api.ProjectLedgerEntryResponseDto[]; nextCursor?: string | null; hasMore?: boolean; total?: number };
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(res.data) ? res.data : []);
      if (append) {
        setPaginatedEntries((prev) => [...prev, ...items]);
      } else {
        setPaginatedEntries(items);
      }
      setNextCursor(data?.nextCursor ?? null);
      setHasMore(Boolean(data?.hasMore));
      if (data?.total !== undefined) {
        setTotalCount(data.total);
      }
    } catch (err) {
      reportError(err, 'ProjectLedgerTab:fetchLedger'); // fallback
    } finally {
      setLoadingEntries(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (projectId) {
      fetchLedger();
    }
  }, [projectId, fetchLedger]);

  React.useEffect(() => {
    if (ledgerEntries && ledgerEntries.length > 0 && paginatedEntries.length === 0) {
      setPaginatedEntries(ledgerEntries);
    }
  }, [ledgerEntries, paginatedEntries.length]);

  const sourceEntries = paginatedEntries.length > 0 ? paginatedEntries : (ledgerEntries || []);

  const getEntryTypeLabel = (entryType?: string, sourceType?: string) => {
    const rawSource = (sourceType || '').toLowerCase();
    const rawEntry = (entryType || '').toLowerCase();
    if (rawSource === 'inventory_return' || rawEntry === 'return') {
      return t('entryTypes.return');
    }
    if (!entryType) return '—';
    const labels: Record<string, string> = {
      usage: t('entryTypes.usage'),
      sale: t('entryTypes.sale'),
      return: t('entryTypes.return'),
    };
    if (labels[rawEntry]) return labels[rawEntry];
    return entryType.charAt(0).toUpperCase() + entryType.slice(1).toLowerCase();
  };

  const getSourceTypeLabel = (sourceType?: string) => {
    if (!sourceType) return null;
    const raw = sourceType.toLowerCase();
    const labels: Record<string, string> = {
      timesheet: t('sourceTypes.timesheet'),
      inventory_issue: t('sourceTypes.inventory_issue'),
      inventory_return: t('sourceTypes.inventory_return'),
      purchase_invoice: t('sourceTypes.purchase_invoice'),
      manual_journal: t('sourceTypes.manual_journal'),
    };
    if (labels[raw]) return labels[raw];
    return sourceType
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getLineTypeLabel = (lineType?: string) => {
    if (!lineType) return '—';
    const raw = lineType.toLowerCase();
    if (raw === PROJECT_LINE_TYPE.ITEM || raw === 'item') return 'Material';
    if (raw === PROJECT_LINE_TYPE.RESOURCE || raw === 'resource') return 'Labor';
    if (raw === PROJECT_LINE_TYPE.EXPENSE || raw === 'expense') return 'Expense';
    return lineType.charAt(0).toUpperCase() + lineType.slice(1).toLowerCase();
  };

  const getSourceRoute = (entry: api.ProjectLedgerEntryResponseDto): string | null => {
    const rawType = (entry.sourceType || '').toLowerCase();
    if (rawType === 'inventory_issue' || rawType === 'inventory_return') {
      const entryId = entry.inventoryEntryId || entry.sourceId;
      return routes.inventory.ledger(entryId || undefined);
    }
    if (rawType === 'manual_journal') {
      return entry.sourceId
        ? `/general-ledger/journal-entries?entry=${entry.sourceId}`
        : routes.generalLedger.journalEntries.list();
    }
    if (rawType === 'timesheet') {
      return entry.resourceId
        ? routes.resources.detail(entry.resourceId)
        : routes.resources.list();
    }
    if (rawType === 'purchase_invoice') {
      return entry.sourceId
        ? routes.supplierInvoices.detail(entry.sourceId)
        : routes.supplierInvoices.list();
    }
    if (rawType === 'sales_invoice') {
      return entry.sourceId
        ? routes.salesInvoices.detail(entry.sourceId)
        : routes.salesInvoices.list();
    }
    return null;
  };

  const renderSourceReference = (entry: api.ProjectLedgerEntryResponseDto) => {
    const typeLabel = getSourceTypeLabel(entry.sourceType);
    const shortId =
      entry.sourceId && entry.sourceId.length > 8
        ? entry.sourceId.slice(0, 8)
        : entry.sourceId;

    if (!typeLabel && !entry.sourceId) {
      return <span className="text-[var(--text-muted)]">—</span>;
    }

    const route = getSourceRoute(entry);
    const content = typeLabel ? (
      <>
        <span className="font-sans text-[var(--text-secondary)] mr-1">
          {typeLabel}
        </span>
        {shortId && (
          <span className="text-[var(--accent)]">#{shortId}</span>
        )}
      </>
    ) : (
      <span className="text-[var(--accent)]">#{shortId}</span>
    );

    if (route) {
      return (
        <Link
          href={route}
          className="font-mono text-xs text-[var(--accent)] hover:underline inline-flex items-center cursor-pointer"
          title={entry.sourceId ? `ID: ${entry.sourceId}` : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </Link>
      );
    }

    return (
      <span
        className="font-mono text-xs text-[var(--accent)]"
        title={entry.sourceId ? `ID: ${entry.sourceId}` : undefined}
      >
        {content}
      </span>
    );
  };

  // Clean raw entries to remove internal staging movements
  const cleanedLedgerEntries = useMemo(() => {
    return (sourceEntries || []).filter((e) => {
      const desc = e.description || '';
      const isStagedEntry = desc.startsWith('Staged ') || desc.includes('Transfer Staging');
      const isReallocation = desc.startsWith('Reallocated from staging');
      return !isStagedEntry && !isReallocation;
    });
  }, [sourceEntries]);

  // Counts for Tabs
  const allCount = cleanedLedgerEntries.length;
  const unbilledEntries = useMemo(
    () => cleanedLedgerEntries.filter((e) => !e.isBilled && e.isBillable !== false),
    [cleanedLedgerEntries]
  );
  const unbilledCount = unbilledEntries.length;
  const billedCount = useMemo(
    () => cleanedLedgerEntries.filter((e) => e.isBilled).length,
    [cleanedLedgerEntries]
  );
  const nonBillableEntries = useMemo(
    () => cleanedLedgerEntries.filter((e) => e.isBillable === false),
    [cleanedLedgerEntries]
  );
  const nonBillableCount = nonBillableEntries.length;

  // Filtered by active billing tab
  const tabFilteredEntries = useMemo(() => {
    if (activeBillingTab === 'unbilled') {
      return cleanedLedgerEntries.filter((e) => !e.isBilled && e.isBillable !== false);
    }
    if (activeBillingTab === 'billed') {
      return cleanedLedgerEntries.filter((e) => e.isBilled);
    }
    if (activeBillingTab === 'non_billable') {
      return cleanedLedgerEntries.filter((e) => e.isBillable === false);
    }
    return cleanedLedgerEntries;
  }, [cleanedLedgerEntries, activeBillingTab]);

  // Task-grouped data matching Budget table structure
  const taskGroups: TaskLedgerGroup[] = useMemo(() => {
    const groups: TaskLedgerGroup[] = [];
    const matchedLedgerIds = new Set<string>();

    for (const task of tasks) {
      const matchingEntries = tabFilteredEntries.filter(
        (e) => e.projectTaskId === task.projectTaskId
      );
      matchingEntries.forEach((e) => matchedLedgerIds.add(e.ledgerId));

      const totalActualCost = matchingEntries.reduce(
        (sum, e) => sum + Number(e.totalCostBase || 0),
        0
      );
      const totalActualRevenue = matchingEntries.reduce(
        (sum, e) => sum + Number(e.totalPriceBase || 0),
        0
      );
      const totalQuantity = matchingEntries.reduce(
        (sum, e) => sum + Number(e.quantity || 0),
        0
      );
      const unbilled = matchingEntries.filter((e) => !e.isBilled && e.isBillable !== false).length;
      const billed = matchingEntries.filter((e) => e.isBilled).length;

      // In 'all' tab, show all tasks (matching Budget tab). In filtered tabs, show if matchingEntries > 0.
      if (activeBillingTab === 'all' || matchingEntries.length > 0) {
        groups.push({
          key: `task-${task.projectTaskId}`,
          taskId: task.projectTaskId,
          task,
          taskCode: task.taskCode,
          taskName: task.name,
          taskDescription: task.description || undefined,
          entries: matchingEntries,
          totalActualCost,
          totalActualRevenue,
          totalQuantity,
          unbilledCount: unbilled,
          billedCount: billed,
        });
      }
    }

    // Check for orphan / unassigned entries
    const orphanEntries = tabFilteredEntries.filter(
      (e) => !matchedLedgerIds.has(e.ledgerId)
    );

    if (orphanEntries.length > 0) {
      const totalActualCost = orphanEntries.reduce(
        (sum, e) => sum + Number(e.totalCostBase || 0),
        0
      );
      const totalActualRevenue = orphanEntries.reduce(
        (sum, e) => sum + Number(e.totalPriceBase || 0),
        0
      );
      const totalQuantity = orphanEntries.reduce(
        (sum, e) => sum + Number(e.quantity || 0),
        0
      );
      const unbilled = orphanEntries.filter((e) => !e.isBilled).length;
      const billed = orphanEntries.filter((e) => e.isBilled).length;

      groups.push({
        key: 'unassigned-tasks',
        taskName: t('labels.unassignedTask') || 'General / Unassigned',
        entries: orphanEntries,
        totalActualCost,
        totalActualRevenue,
        totalQuantity,
        unbilledCount: unbilled,
        billedCount: billed,
      });
    }

    return groups;
  }, [tasks, tabFilteredEntries, activeBillingTab, t]);

  // Grand totals
  const grandTotals = useMemo(() => {
    const totalActualCost = tabFilteredEntries.reduce(
      (sum, e) => sum + Number(e.totalCostBase || 0),
      0
    );
    const totalActualRevenue = tabFilteredEntries.reduce(
      (sum, e) => sum + Number(e.totalPriceBase || 0),
      0
    );
    const totalQuantity = tabFilteredEntries.reduce(
      (sum, e) => sum + Number(e.quantity || 0),
      0
    );

    return {
      totalActualCost,
      totalActualRevenue,
      totalQuantity,
    };
  }, [tabFilteredEntries]);

  // Derived KPI calculations matching ProjectOverviewTab
  const kpiData = useMemo(() => {
    const totalBudgetCost =
      profitability?.totalBudgetCost !== undefined
        ? Number(profitability.totalBudgetCost)
        : (budgetLines || []).reduce(
            (sum, b) => sum + Number(b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0)),
            0
          );

    const totalBudgetPrice =
      profitability?.totalBudgetPrice !== undefined
        ? Number(profitability.totalBudgetPrice)
        : (budgetLines || []).reduce(
            (sum, b) => sum + Number(b.totalPrice || Number(b.plannedQuantity || 0) * Number(b.unitPrice || 0)),
            0
          );

    const totalActualCost =
      profitability?.totalActualCost !== undefined
        ? Number(profitability.totalActualCost)
        : cleanedLedgerEntries.reduce((sum, e) => sum + Number(e.totalCostBase || 0), 0);

    const totalBillablePrice =
      profitability?.totalBillablePrice !== undefined
        ? Number(profitability.totalBillablePrice)
        : cleanedLedgerEntries.reduce((sum, e) => sum + Number(e.totalPriceBase || 0), 0);

    const totalBilledPrice =
      profitability?.totalBilledPrice !== undefined
        ? Number(profitability.totalBilledPrice)
        : cleanedLedgerEntries
            .filter((e) => e.isBilled)
            .reduce((sum, e) => sum + Number(e.totalPriceBase || 0), 0);

    const marginVal =
      profitability?.actualMarginPercent !== undefined
        ? Number(profitability.actualMarginPercent)
        : totalBillablePrice > 0
        ? ((totalBillablePrice - totalActualCost) / totalBillablePrice) * 100
        : 0;

    return {
      totalBudgetCost,
      totalBudgetPrice,
      totalActualCost,
      totalBillablePrice,
      totalBilledPrice,
      marginVal,
    };
  }, [profitability, budgetLines, cleanedLedgerEntries]);

  // Standard Tab items (standard font rendering and neutral count badge)
  const billingTabs: TabItem<BillingFilterTab>[] = useMemo(
    () => [
      {
        id: 'all',
        label: t('tabs.allTransactions') || 'All Transactions',
        badge: `(${allCount})`,
      },
      {
        id: 'unbilled',
        label: t('tabs.unbilledWip') || 'Unbilled (WIP)',
        badge: `(${unbilledCount})`,
      },
      {
        id: 'billed',
        label: t('tabs.billed') || 'Billed',
        badge: `(${billedCount})`,
      },
      {
        id: 'non_billable',
        label: t('tabs.nonBillable') || 'Non-Billable',
        badge: `(${nonBillableCount})`,
      },
    ],
    [t, allCount, unbilledCount, billedCount, nonBillableCount]
  );

  // DataTable Columns matching Budget tab style
  const columns: DataTableColumn<TaskLedgerGroup>[] = useMemo(
    () => [
      {
        id: 'task',
        header: t('labels.task') || 'Target Task',
      },
      {
        id: 'entryDate',
        header: t('columns.entryDate') || 'Date',
        width: '110px',
      },
      {
        id: 'entryType',
        header: t('columns.entryType') || 'Entry Type',
        width: '100px',
      },
      {
        id: 'lineType',
        header: t('columns.lineType') || 'Line Type',
        width: '90px',
      },
      {
        id: 'description',
        header: t('labels.description') || 'Description',
        className: 'border-r border-[var(--border)]',
      },
      {
        id: 'billing',
        header: t('columns.billing') || 'Billing',
        width: '140px',
      },
      {
        id: 'quantity',
        header: t('columns.quantity') || 'Quantity',
        align: 'right',
        width: '80px',
      },
      {
        id: 'actualCost',
        header: t('columns.actualCost') || 'Actual Cost',
        align: 'right',
        width: '110px',
      },
      {
        id: 'discountPercentage',
        header: 'Disc %',
        align: 'right',
        width: '80px',
      },
      {
        id: 'actualRevenue',
        header: t('columns.actualRevenue') || 'Actual Revenue',
        align: 'right',
        width: '120px',
        className: 'border-r border-[var(--border)]',
      },
      {
        id: 'sourceRef',
        header: t('columns.sourceRef') || 'Source Reference',
        width: '180px',
      },
    ],
    [t]
  );

  // DataTable Columns for Project Sales Invoices
  const invoiceColumns: DataTableColumn<api.SalesInvoiceResponseDto>[] = useMemo(
    () => [
      {
        id: 'invoiceNumber',
        header: t('columns.invoiceNumber') || 'Invoice #',
        width: '140px',
        render: (inv) => (
          <Link
            href={routes.salesInvoices.detail(inv.invoiceId)}
            className="font-mono text-xs text-[var(--accent)] hover:underline font-medium inline-flex items-center"
          >
            {inv.invoiceNumber}
          </Link>
        ),
      },
      {
        id: 'invoiceDate',
        header: t('columns.date') || 'Date',
        width: '110px',
        render: (inv) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {formatLocalDate(inv.invoiceDate || inv.createdOn)}
          </span>
        ),
      },
      {
        id: 'dueDate',
        header: t('columns.dueDate') || 'Due Date',
        width: '110px',
        render: (inv) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {inv.dueDate ? formatLocalDate(inv.dueDate) : '—'}
          </span>
        ),
      },
      {
        id: 'customer',
        header: t('columns.customer') || 'Customer',
        render: (inv) => (
          <span className="text-xs text-[var(--text-primary)]">
            {inv.customerName || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('columns.status') || 'Status',
        width: '130px',
        render: (inv) => (
          <StateBadge state={inv.stateCode as ValidState} />
        ),
      },
      {
        id: 'taxAmount',
        header: t('columns.tax') || 'Tax',
        align: 'right',
        width: '100px',
        render: (inv) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {formatAmount(Number(inv.taxAmount || 0), inv.currencyCode || currency)}
          </span>
        ),
      },
      {
        id: 'totalAmount',
        header: t('columns.total') || 'Total Amount',
        align: 'right',
        width: '120px',
        render: (inv) => (
          <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
            {formatAmount(Number(inv.totalAmount || 0), inv.currencyCode || currency)}
          </span>
        ),
      },
      {
        id: 'outstandingAmount',
        header: t('columns.balanceDue') || 'Balance Due',
        align: 'right',
        width: '120px',
        render: (inv) => (
          <span
            className={`font-mono text-xs font-medium ${
              Number(inv.outstandingAmount || 0) > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {formatAmount(Number(inv.outstandingAmount || 0), inv.currencyCode || currency)}
          </span>
        ),
      },
    ],
    [t, currency]
  );

  const renderBillingBadge = (entry: api.ProjectLedgerEntryResponseDto) => {
    if (entry.isBilled) {
      const invoiceNumber = entry.salesInvoiceNumber;
      const invoiceId = entry.salesInvoiceId;

      if (invoiceNumber) {
        if (invoiceId) {
          return (
            <Link
              href={routes.salesInvoices.detail(invoiceId)}
              className="font-mono text-xs text-[var(--accent)] hover:underline inline-flex items-center cursor-pointer font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {invoiceNumber}
            </Link>
          );
        }
        return (
          <span className="font-mono text-xs text-[var(--text-primary)] font-medium">
            {invoiceNumber}
          </span>
        );
      }

      return (
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {t('labels.billedBadge')}
        </span>
      );
    }

    if (isEditable && setLedgerEntryBillable) {
      return (
        <select
          aria-label="Billing Status"
          className={`text-xs py-0.5 px-1.5 rounded border border-transparent hover:border-[var(--border)] bg-transparent hover:bg-[var(--bg-secondary)]/60 cursor-pointer transition-colors focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--border)] focus:outline-none ${
            entry.isBillable === false
              ? 'text-[var(--text-muted)] italic'
              : 'text-[var(--text-secondary)] font-normal'
          }`}
          value={entry.isBillable === false ? 'non_billable' : 'billable'}
          onClick={(e) => e.stopPropagation()}
          onChange={async (e) => {
            e.stopPropagation();
            const newBillable = e.target.value === 'billable';
            try {
              await setLedgerEntryBillable(entry.ledgerId, newBillable);
            } catch {
              // Error toast is handled inside useProject.setLedgerEntryBillable
            }
          }}
        >
          <option value="billable">{t('labels.unbilledBadge')}</option>
          <option value="non_billable">{t('labels.nonBillableBadge')}</option>
        </select>
      );
    }

    return (
      <span
        className={`text-xs ${
          entry.isBillable === false
            ? 'text-[var(--text-muted)] italic'
            : 'text-[var(--text-secondary)]'
        }`}
      >
        {entry.isBillable === false
          ? t('labels.nonBillableBadge')
          : t('labels.unbilledBadge')}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. KPIs Card (Matches Overview Tab) */}
      <div id="kpi-section" className="card">
        <h3 className="section-heading">
          {t('sections.kpis')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Total Budget Cost</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(kpiData.totalBudgetCost, currency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Total Actual Cost</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(kpiData.totalActualCost, currency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Budget Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(kpiData.totalBudgetPrice, currency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Billable Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(kpiData.totalBillablePrice, currency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Billed Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(kpiData.totalBilledPrice, currency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Actual Margin %</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {kpiData.marginVal.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Accounts Table Card with Budget-like Roll-up Hierarchy */}
      <div className="card space-y-4">
        <div>
          <h3 className="section-heading !mb-0">
            {t('tabs.accounts')}
          </h3>
        </div>

        {/* Standard Tabs Navigation */}
        <Tabs<BillingFilterTab>
          tabs={billingTabs}
          activeTab={activeBillingTab}
          onChange={setActiveBillingTab}
          actions={
            isEditable ? (
              <div className="flex items-center gap-2">
                {consumeExpense && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowExpenseSlideOver(true)}
                  >
                    {t('buttons.recordExpense')}
                  </Button>
                )}
                {billProject && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowBillSlideOver(true)}
                  >
                    {t('buttons.createInvoice')}
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        {/* Unified Roll-up Table structured like Budget Table */}
        <DataTable<TaskLedgerGroup>
          columns={columns}
          data={taskGroups}
          keyExtractor={(group) => group.key}
          emptyMessage={t('noTransactions')}
          renderCustomRow={(group, _idx, visibleCols) => {
            const formattedActualCost = formatAmount(group.totalActualCost, currency);
            const formattedActualRevenue = formatAmount(group.totalActualRevenue, currency);

            return (
              <React.Fragment key={group.key}>
                {/* Task Roll-up Summary Row */}
                <tr className="bg-[var(--bg-secondary)]/50 font-semibold border-t border-b border-[var(--border)]">
                  <td colSpan={5} className="text-left py-2.5 px-3 border-r border-[var(--border)]">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {group.task ? getTaskDisplayName(group.task, group.entries.length) : `${group.taskName} (${group.entries.length})`}
                    </span>
                  </td>
                  <td className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">
                    {group.unbilledCount > 0
                      ? `${group.unbilledCount} unbilled`
                      : group.entries.length > 0
                      ? 'All billed'
                      : '—'}
                  </td>
                  <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">
                    —
                  </td>
                  <td className="text-right py-2.5 px-3">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formattedActualCost}
                    </span>
                  </td>
                  <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">
                    —
                  </td>
                  <td className="text-right py-2.5 px-3 border-r border-[var(--border)]">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {formattedActualRevenue}
                    </span>
                  </td>
                  <td className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">—</td>
                </tr>

                {/* Ledger Entries for this Task */}
                {group.entries.map((entry) => {
                  const isSale = entry.entryType?.toLowerCase() === 'sale';
                  const entryDesc = entry.description || '—';

                  return (
                    <tr
                      key={entry.ledgerId}
                      className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-secondary)]/30"
                    >
                      <td className="text-left py-2 px-3 pl-6 text-xs text-[var(--text-muted)]">
                        {'\u21B3'}
                      </td>
                      <td className="text-left py-2 px-3 font-mono text-xs text-[var(--text-muted)]">
                        {formatLocalDate(entry.postingDate || entry.createdOn)}
                      </td>
                      <td className="text-left py-2 px-3">
                        <span
                          className={`badge ${
                            isSale ? 'badge-primary' : 'badge-secondary'
                          } text-[10px] uppercase font-medium`}
                        >
                          {getEntryTypeLabel(entry.entryType, entry.sourceType)}
                        </span>
                      </td>
                      <td className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-medium">
                        {getLineTypeLabel(entry.lineType)}
                      </td>
                      <td className="text-left py-2 px-3 border-r border-[var(--border)]">
                        <span className="text-xs text-[var(--text-primary)]">
                          {entryDesc}
                        </span>
                      </td>
                      <td className="text-left py-2 px-3">
                        {renderBillingBadge(entry)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-xs text-[var(--text-primary)]">
                        {Number(entry.quantity || 0).toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-xs text-[var(--text-primary)]">
                        {formatAmount(Number(entry.totalCostBase || 0), currency)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-xs text-[var(--text-primary)]">
                        {entry.discountPercentage != null && entry.discountPercentage !== ''
                          ? `${Number(entry.discountPercentage)}%`
                          : (discountPercentage ? `${Number(discountPercentage)}%` : '0%')}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-xs text-[var(--text-primary)] border-r border-[var(--border)]">
                        {formatAmount(Number(entry.totalPriceBase || 0), currency)}
                      </td>
                      <td className="text-left py-2 px-3 text-xs">
                        {renderSourceReference(entry)}
                      </td>
                    </tr>
                  );
                })}

                {/* Empty Task Indicator */}
                {group.entries.length === 0 && (
                  <tr key={`${group.key}-empty`}>
                    <td
                      colSpan={visibleCols.length}
                      className="text-xs text-[var(--text-muted)] italic pl-8 py-2 bg-[var(--bg-secondary)]/10"
                    >
                      {t('labels.noTaskTransactions')}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          }}
          footer={
            taskGroups.length > 0 ? (
              <tr className="border-t-2 border-[var(--border)] font-bold bg-[var(--bg-secondary)]/40">
                <td colSpan={5} className="text-left py-3 px-3 text-xs font-bold text-[var(--text-primary)] border-r border-[var(--border)]">
                  {t('columns.total')}
                </td>
                <td className="py-3 px-3 text-xs text-[var(--text-muted)]">—</td>
                <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
                <td className="py-3 px-3 text-right">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {formatAmount(grandTotals.totalActualCost, currency)}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
                <td className="py-3 px-3 text-right border-r border-[var(--border)]">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {formatAmount(grandTotals.totalActualRevenue, currency)}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs text-[var(--text-muted)]">—</td>
              </tr>
            ) : undefined
          }
          mobileCard={(group) => {
            const formattedActualCost = formatAmount(group.totalActualCost, currency);
            const formattedActualRevenue = formatAmount(group.totalActualRevenue, currency);
            const taskLabel = group.task
              ? getTaskDisplayName(group.task, group.entries.length)
              : `${group.taskName} (${group.entries.length})`;

            return (
              <div key={group.key} className="card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="font-bold text-sm text-[var(--text-primary)]">
                    {taskLabel}
                  </span>
                </div>

                {/* Task Roll-up Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--bg-secondary)]/40 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[var(--text-muted)] block">{t('columns.actualCost')}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {formattedActualCost}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block">{t('columns.actualRevenue')}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {formattedActualRevenue}
                    </span>
                  </div>
                </div>

                {/* Lines */}
                {group.entries.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {group.entries.map((entry) => {
                      const isSale = entry.entryType?.toLowerCase() === 'sale';
                      return (
                        <MobileLineItemCard
                          key={entry.ledgerId}
                          title={entry.description || '—'}
                          topRightBadge={
                            <div className="flex items-center gap-1.5">
                              {renderBillingBadge(entry)}
                              <span
                                className={`badge ${
                                  isSale ? 'badge-primary' : 'badge-secondary'
                                } text-xs uppercase font-medium`}
                              >
                                {getEntryTypeLabel(entry.entryType, entry.sourceType)}
                              </span>
                            </div>
                          }
                          details={[
                            {
                              label: t('columns.entryDate'),
                              value: formatLocalDate(entry.postingDate || entry.createdOn),
                            },
                            {
                              label: t('columns.lineType'),
                              value: getLineTypeLabel(entry.lineType),
                            },
                            {
                              label: t('columns.quantity'),
                              value: Number(entry.quantity || 0).toLocaleString(),
                            },
                            {
                              label: t('columns.actualCost'),
                              value: formatAmount(Number(entry.totalCostBase || 0), currency),
                            },
                            {
                              label: 'Disc %',
                              value: entry.discountPercentage != null && entry.discountPercentage !== ''
                                ? `${Number(entry.discountPercentage)}%`
                                : (discountPercentage ? `${Number(discountPercentage)}%` : '0%'),
                            },
                            {
                              label: t('columns.actualRevenue'),
                              value: formatAmount(Number(entry.totalPriceBase || 0), currency),
                            },
                            {
                              label: t('columns.sourceRef'),
                              value: renderSourceReference(entry),
                            },
                          ]}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic py-1">
                    {t('labels.noTaskTransactions')}
                  </p>
                )}
              </div>
            );
          }}
        />

        {hasMore && (
          <div className="flex items-center justify-center pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingEntries}
              onClick={() => fetchLedger(nextCursor, true)}
            >
              {loadingEntries
                ? t('buttons.loadingMore') || 'Loading...'
                : t('buttons.loadMoreEntries') || `Load More Entries (${totalCount > paginatedEntries.length ? `${paginatedEntries.length} of ${totalCount}` : 'More'})`}
            </Button>
          </div>
        )}

        {/* SlideOver: Record Project Expense */}
        {consumeExpense && (
          <ConsumeProjectExpenseSlideOver
            isOpen={showExpenseSlideOver}
            onClose={() => setShowExpenseSlideOver(false)}
            projectId={projectId}
            projectNumber={projectNumber}
            tasks={tasks}
            budgetLines={budgetLines}
            ledgerEntries={ledgerEntries}
            currency={currency}
            consumeExpense={consumeExpense}
            onSuccess={async () => {
              await fetchLedger();
              if (reloadProject) await reloadProject();
            }}
          />
        )}

        {/* SlideOver: Bill Project (Create Sales Invoice) */}
        {billProject && (
          <BillProjectSlideOver
            isOpen={showBillSlideOver}
            onClose={() => setShowBillSlideOver(false)}
            projectId={projectId}
            projectNumber={projectNumber}
            projectName={projectName}
            currency={currency}
            projectBillingType={projectBillingType}
            customerPaymentTerms={paymentTerms}
            tasks={tasks}
            budgetLines={budgetLines}
            unbilledEntries={unbilledEntries}
            discountPercentage={discountPercentage}
            defaultBillingMode={activeBillingTab === 'unbilled' ? 'time_and_materials' : 'time_and_materials'}
            billProject={billProject}
            onSuccess={async () => {
              await fetchLedger();
              if (reloadProject) await reloadProject();
            }}
          />
        )}
      </div>

      {/* 3. Project Sales Invoices Table Card */}
      <div id="project-invoices-section" className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-heading !mb-0 flex items-center gap-2">
            <span>{t('sections.invoices')}</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">({invoices.length})</span>
          </h3>
        </div>

        <DataTable<api.SalesInvoiceResponseDto>
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={(inv) => inv.invoiceId}
          emptyMessage={t('labels.noInvoices')}
          mobileCard={(inv) => (
            <div key={inv.invoiceId} className="card p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <Link
                  href={routes.salesInvoices.detail(inv.invoiceId)}
                  className="font-mono font-bold text-sm text-[var(--accent)] hover:underline"
                >
                  {inv.invoiceNumber}
                </Link>
                <StateBadge state={inv.stateCode as ValidState} />
              </div>
              <MobileCardField label={t('columns.customer') || 'Customer'} value={inv.customerName || '—'} />
              <MobileCardField label={t('columns.date') || 'Date'} value={formatLocalDate(inv.invoiceDate || inv.createdOn)} />
              {inv.dueDate && (
                <MobileCardField label={t('columns.dueDate') || 'Due Date'} value={formatLocalDate(inv.dueDate)} />
              )}
              <MobileCardField label={t('columns.tax') || 'Tax'} value={formatAmount(Number(inv.taxAmount || 0), inv.currencyCode || currency)} />
              <MobileCardField
                label={t('columns.total') || 'Total Amount'}
                value={
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {formatAmount(Number(inv.totalAmount || 0), inv.currencyCode || currency)}
                  </span>
                }
              />
              <MobileCardField
                label={t('columns.balanceDue') || 'Balance Due'}
                value={
                  <span
                    className={`font-mono font-medium ${
                      Number(inv.outstandingAmount || 0) > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {formatAmount(Number(inv.outstandingAmount || 0), inv.currencyCode || currency)}
                  </span>
                }
              />
              <div className="pt-2 flex justify-end">
                <Link
                  href={routes.salesInvoices.detail(inv.invoiceId)}
                  className="text-xs text-[var(--accent)] hover:underline font-medium inline-flex items-center gap-1"
                >
                  View Invoice &rarr;
                </Link>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
