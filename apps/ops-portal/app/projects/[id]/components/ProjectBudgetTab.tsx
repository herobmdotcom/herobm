'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { PROJECT_TASK_STATE, PROJECT_LINE_TYPE, computeLinePrice } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { formatAmount } from '@/lib/currency';
import { BudgetLineSlideOver } from './BudgetLineSlideOver';

export interface EnrichedBudgetLine extends api.ProjectBudgetLineResponseDto {
  actualCost: number;
  actualRevenue: number;
  actualQuantity: number;
  isOverBudget: boolean;
  isUnbudgeted?: boolean;
}

interface ProjectBudgetTabProps {
  budgetLines: api.ProjectBudgetLineResponseDto[];
  tasks: api.ProjectTaskResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency: string;
  isEditable: boolean;
  discountPercentage?: number;
  createBudgetLine: (dto: api.CreateProjectBudgetLineDto) => Promise<void>;
  updateBudgetLine?: (lineId: string, dto: api.UpdateProjectBudgetLineDto) => Promise<void>;
  deleteBudgetLine?: (lineId: string) => Promise<void>;
}

interface TaskBudgetGroup {
  key: string;
  task?: api.ProjectTaskResponseDto;
  taskId?: string;
  taskCode?: string;
  taskName: string;
  taskDescription?: string;
  budgetLines: EnrichedBudgetLine[];
  totalBudgetCost: number;
  totalBudgetRevenue: number;
  actualCost: number;
  actualRevenue: number;
  remainingBudget: number;
  consumptionPercent: number;
  isOverBudget: boolean;
  hasBudget: boolean;
  hasActuals: boolean;
}

function getTaskDisplayName(task?: api.ProjectTaskResponseDto): string {
  if (!task) return '—';
  return task.taskCode ? `${task.taskCode} — ${task.name}` : task.name;
}

function getLineTypeBadgeLabel(lineType?: string): string {
  if (lineType === PROJECT_LINE_TYPE.ITEM || lineType === 'item') return 'material';
  if (lineType === PROJECT_LINE_TYPE.RESOURCE || lineType === 'resource') return 'service';
  if (lineType === PROJECT_LINE_TYPE.EXPENSE || lineType === 'expense') return 'expense';
  return lineType || '—';
}

export function ProjectBudgetTab({
  budgetLines,
  tasks,
  ledgerEntries = [],
  currency,
  isEditable,
  discountPercentage = 0,
  createBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
}: ProjectBudgetTabProps) {
  const t = useTranslations('projects');
  const formatLineCount = (count: number) => t('labels.linesCount', { count });
  const [showCreateSlideOver, setShowCreateSlideOver] = useState(false);
  const [editingLine, setEditingLine] = useState<api.ProjectBudgetLineResponseDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (line: api.ProjectBudgetLineResponseDto) => {
    if (!deleteBudgetLine) return;
    const confirmMsg = t('confirmDeleteBudgetLine') || 'Are you sure you want to delete this budget line?';
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(line.budgetLineId);
    try {
      await deleteBudgetLine(line.budgetLineId);
    } finally {
      setDeletingId(null);
    }
  };

  const renderActionButtons = (line: EnrichedBudgetLine) => {
    if (!isEditable || line.isUnbudgeted) return null;
    const matchedTask = tasks.find((tk) => tk.projectTaskId === line.projectTaskId);
    const isTaskCompleted = matchedTask?.stateCode === PROJECT_TASK_STATE.COMPLETED;
    const isDeleting = deletingId === line.budgetLineId;

    return (
      <div className="flex items-center justify-end gap-2">
        {updateBudgetLine && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title={isTaskCompleted ? 'Cannot edit budget allocations on a completed task' : t('buttons.editBudgetLine')}
            disabled={isDeleting || isTaskCompleted}
            onClick={() => setEditingLine(line)}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </Button>
        )}
        {deleteBudgetLine && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            title={isTaskCompleted ? 'Cannot delete budget allocations on a completed task' : t('buttons.deleteBudgetLine')}
            disabled={isDeleting || isTaskCompleted}
            onClick={() => handleDelete(line)}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </Button>
        )}
      </div>
    );
  };

  const taskGroups: TaskBudgetGroup[] = useMemo(() => {
    const groups: TaskBudgetGroup[] = [];
    const matchedLineIds = new Set<string>();
    const matchedLedgerEntryIds = new Set<string>();

    for (const task of tasks) {
      const taskBudgetLines = (budgetLines || []).filter(
        (b) => b.projectTaskId === task.projectTaskId,
      );
      taskBudgetLines.forEach((b) => matchedLineIds.add(b.budgetLineId));

      const taskLedgerEntries = (ledgerEntries || []).filter(
        (l) => l.projectTaskId === task.projectTaskId,
      );

      // Match each planned budget line to its ledger entries
      const enrichedLines: EnrichedBudgetLine[] = taskBudgetLines.map((b) => {
        // Direct match by budgetLineId
        const directlyMatched = taskLedgerEntries.filter(
          (l) => l.budgetLineId && l.budgetLineId === b.budgetLineId,
        );
        directlyMatched.forEach((l) => matchedLedgerEntryIds.add(l.ledgerId));

        // Heuristic fallback for entries without budgetLineId
        const fallbackMatched = taskLedgerEntries.filter((l) => {
          if (l.budgetLineId || matchedLedgerEntryIds.has(l.ledgerId)) return false;
          if (b.lineType === 'resource' && l.lineType === 'resource') {
            if (b.resourceId && l.resourceId === b.resourceId) return true;
            if (b.productId && l.productId === b.productId) return true;
          }
          if (b.lineType === 'item' && l.lineType === 'item') {
            if (b.productId && l.productId === b.productId) return true;
          }
          if (b.lineType === 'expense' && l.lineType === 'expense') {
            if (b.productId && l.productId === b.productId) return true;
          }
          return false;
        });
        fallbackMatched.forEach((l) => matchedLedgerEntryIds.add(l.ledgerId));

        const allMatched = [...directlyMatched, ...fallbackMatched];
        const actualCost =
          b.actualCost !== undefined
            ? Number(b.actualCost)
            : allMatched.reduce(
                (sum, l) => sum + Number(l.totalCostBase || 0),
                0,
              );
        const actualRevenue =
          b.actualRevenue !== undefined
            ? Number(b.actualRevenue)
            : allMatched.reduce(
                (sum, l) => sum + Number(l.totalPriceBase || 0),
                0,
              );
        const actualQuantity =
          b.actualQuantity !== undefined
            ? Number(b.actualQuantity)
            : allMatched.reduce(
                (sum, l) => sum + Number(l.quantity || 0),
                0,
              );

        const plannedQty = Number(b.plannedQuantity || 0);
        const unitCost = Number(b.unitCost || 0);
        const totalPlannedCost = Number(b.totalCost || plannedQty * unitCost);
        const isOverBudget =
          b.isOverBudget !== undefined
            ? Boolean(b.isOverBudget)
            : totalPlannedCost > 0
            ? actualCost > totalPlannedCost
            : actualCost > 0;

        return {
          ...b,
          actualCost,
          actualRevenue,
          actualQuantity,
          isOverBudget,
        };
      });

      // Find any unmatched subledger entries on this task
      const unmatchedTaskEntries = taskLedgerEntries.filter(
        (l) => !matchedLedgerEntryIds.has(l.ledgerId),
      );

      if (unmatchedTaskEntries.length > 0) {
        unmatchedTaskEntries.forEach((l) => matchedLedgerEntryIds.add(l.ledgerId));
        const unbudgetedCost = unmatchedTaskEntries.reduce(
          (sum, l) => sum + Number(l.totalCostBase || 0),
          0,
        );
        const unbudgetedRevenue = unmatchedTaskEntries.reduce(
          (sum, l) => sum + Number(l.totalPriceBase || 0),
          0,
        );
        const unbudgetedQty = unmatchedTaskEntries.reduce(
          (sum, l) => sum + Number(l.quantity || 0),
          0,
        );

        enrichedLines.push({
          budgetLineId: `unbudgeted-${task.projectTaskId}`,
          projectId: task.projectId,
          projectTaskId: task.projectTaskId,
          lineType: 'expense',
          description: t('labels.unbudgetedLine') || 'Other / Unbudgeted Actuals',
          plannedQuantity: '0',
          unitCost: '0',
          totalCost: '0',
          unitPrice: '0',
          totalPrice: '0',
          actualCost: unbudgetedCost,
          actualRevenue: unbudgetedRevenue,
          actualQuantity: unbudgetedQty,
          isOverBudget: unbudgetedCost > 0,
          isUnbudgeted: true,
        });
      }

      const totalBudgetCost = taskBudgetLines.reduce(
        (sum, b) =>
          sum + Number(b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0)),
        0,
      );

      const totalBudgetRevenue = taskBudgetLines.reduce(
        (sum, b) => {
          if (b.totalPrice != null) return sum + Number(b.totalPrice);
          const qty = Number(b.plannedQuantity || 0);
          const price = Number(b.unitPrice || 0);
          const disc = b.discountPercentage != null && b.discountPercentage !== '' ? Number(b.discountPercentage) : Number(discountPercentage || 0);
          return sum + computeLinePrice({ quantity: qty, pricePerUnit: price, discountPercentage: disc, taxRate: 0 }).amount;
        },
        0,
      );

      const actualCost = taskLedgerEntries.reduce(
        (sum, l) => sum + Number(l.totalCostBase || 0),
        0,
      );

      const actualRevenue = taskLedgerEntries.reduce(
        (sum, l) => sum + Number(l.totalPriceBase || 0),
        0,
      );

      const remainingBudget = totalBudgetCost - actualCost;
      const consumptionPercent =
        totalBudgetCost > 0
          ? (actualCost / totalBudgetCost) * 100
          : actualCost > 0
            ? 100
            : 0;
      const isOverBudget =
        totalBudgetCost > 0 ? actualCost > totalBudgetCost : actualCost > 0;
      const hasBudget = totalBudgetCost > 0;
      const hasActuals = actualCost > 0;

      groups.push({
        key: `task-${task.projectTaskId}`,
        task,
        taskId: task.projectTaskId,
        taskCode: task.taskCode,
        taskName: task.name,
        taskDescription: task.description || undefined,
        budgetLines: enrichedLines,
        totalBudgetCost,
        totalBudgetRevenue,
        actualCost,
        actualRevenue,
        remainingBudget,
        consumptionPercent,
        isOverBudget,
        hasBudget,
        hasActuals,
      });
    }

    // Orphan lines & unassigned ledger entries
    const orphanLines = (budgetLines || []).filter((b) => !matchedLineIds.has(b.budgetLineId));
    const orphanLedgerEntries = (ledgerEntries || []).filter(
      (l) => !matchedLedgerEntryIds.has(l.ledgerId),
    );

    if (orphanLines.length > 0 || orphanLedgerEntries.length > 0) {
      const enrichedOrphanLines: EnrichedBudgetLine[] = orphanLines.map((b) => {
        const directlyMatched = orphanLedgerEntries.filter(
          (l) => l.budgetLineId && l.budgetLineId === b.budgetLineId,
        );
        directlyMatched.forEach((l) => matchedLedgerEntryIds.add(l.ledgerId));

        const actualCost = directlyMatched.reduce(
          (sum, l) => sum + Number(l.totalCostBase || 0),
          0,
        );
        const actualRevenue = directlyMatched.reduce(
          (sum, l) => sum + Number(l.totalPriceBase || 0),
          0,
        );
        const actualQuantity = directlyMatched.reduce(
          (sum, l) => sum + Number(l.quantity || 0),
          0,
        );

        const totalPlannedCost = Number(b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0));
        return {
          ...b,
          actualCost,
          actualRevenue,
          actualQuantity,
          isOverBudget: totalPlannedCost > 0 ? actualCost > totalPlannedCost : actualCost > 0,
        };
      });

      const remainingOrphanEntries = orphanLedgerEntries.filter(
        (l) => !matchedLedgerEntryIds.has(l.ledgerId),
      );

      if (remainingOrphanEntries.length > 0) {
        const unbudgetedCost = remainingOrphanEntries.reduce(
          (sum, l) => sum + Number(l.totalCostBase || 0),
          0,
        );
        const unbudgetedRevenue = remainingOrphanEntries.reduce(
          (sum, l) => sum + Number(l.totalPriceBase || 0),
          0,
        );
        const unbudgetedQty = remainingOrphanEntries.reduce(
          (sum, l) => sum + Number(l.quantity || 0),
          0,
        );

        enrichedOrphanLines.push({
          budgetLineId: 'unbudgeted-unassigned',
          projectId: '',
          projectTaskId: '',
          lineType: 'expense',
          description: t('labels.unbudgetedLine') || 'Other / Unbudgeted Actuals',
          plannedQuantity: '0',
          unitCost: '0',
          totalCost: '0',
          unitPrice: '0',
          totalPrice: '0',
          actualCost: unbudgetedCost,
          actualRevenue: unbudgetedRevenue,
          actualQuantity: unbudgetedQty,
          isOverBudget: unbudgetedCost > 0,
          isUnbudgeted: true,
        });
      }

      const totalBudgetCost = orphanLines.reduce(
        (sum, b) =>
          sum + Number(b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0)),
        0,
      );

      const totalBudgetRevenue = orphanLines.reduce(
        (sum, b) => {
          if (b.totalPrice != null) return sum + Number(b.totalPrice);
          const qty = Number(b.plannedQuantity || 0);
          const price = Number(b.unitPrice || 0);
          const disc = b.discountPercentage != null && b.discountPercentage !== '' ? Number(b.discountPercentage) : Number(discountPercentage || 0);
          return sum + computeLinePrice({ quantity: qty, pricePerUnit: price, discountPercentage: disc, taxRate: 0 }).amount;
        },
        0,
      );

      const actualCost = orphanLedgerEntries.reduce(
        (sum, l) => sum + Number(l.totalCostBase || 0),
        0,
      );

      const actualRevenue = orphanLedgerEntries.reduce(
        (sum, l) => sum + Number(l.totalPriceBase || 0),
        0,
      );

      const remainingBudget = totalBudgetCost - actualCost;
      const consumptionPercent =
        totalBudgetCost > 0
          ? (actualCost / totalBudgetCost) * 100
          : actualCost > 0
            ? 100
            : 0;
      const isOverBudget =
        totalBudgetCost > 0 ? actualCost > totalBudgetCost : actualCost > 0;
      const hasBudget = totalBudgetCost > 0;
      const hasActuals = actualCost > 0;

      groups.push({
        key: 'unassigned-tasks',
        taskName: '—',
        budgetLines: enrichedOrphanLines,
        totalBudgetCost,
        totalBudgetRevenue,
        actualCost,
        actualRevenue,
        remainingBudget,
        consumptionPercent,
        isOverBudget,
        hasBudget,
        hasActuals,
      });
    }

    return groups;
  }, [tasks, budgetLines, ledgerEntries, discountPercentage, t]);

  const grandTotals = useMemo(() => {
    const totalBudgetCost = (budgetLines || []).reduce(
      (sum, b) =>
        sum + Number(b.totalCost || Number(b.plannedQuantity || 0) * Number(b.unitCost || 0)),
      0,
    );
    const totalBudgetRevenue = (budgetLines || []).reduce(
      (sum, b) => {
        if (b.totalPrice != null) return sum + Number(b.totalPrice);
        const qty = Number(b.plannedQuantity || 0);
        const price = Number(b.unitPrice || 0);
        const disc = b.discountPercentage != null && b.discountPercentage !== '' ? Number(b.discountPercentage) : Number(discountPercentage || 0);
        return sum + computeLinePrice({ quantity: qty, pricePerUnit: price, discountPercentage: disc, taxRate: 0 }).amount;
      },
      0,
    );
    const totalActualCost = (ledgerEntries || []).reduce(
      (sum, l) => sum + Number(l.totalCostBase || 0),
      0,
    );
    const totalActualRevenue = (ledgerEntries || []).reduce(
      (sum, l) => sum + Number(l.totalPriceBase || 0),
      0,
    );
    const consumptionPercent =
      totalBudgetCost > 0
        ? (totalActualCost / totalBudgetCost) * 100
        : totalActualCost > 0
          ? 100
          : 0;
    const isOverBudget =
      totalBudgetCost > 0 ? totalActualCost > totalBudgetCost : totalActualCost > 0;
    const hasBudget = totalBudgetCost > 0;
    const hasActuals = totalActualCost > 0;

    return {
      totalBudgetCost,
      totalBudgetRevenue,
      totalActualCost,
      totalActualRevenue,
      consumptionPercent,
      isOverBudget,
      hasBudget,
      hasActuals,
    };
  }, [budgetLines, ledgerEntries]);

  const columns: DataTableColumn<TaskBudgetGroup>[] = useMemo(() => {
    const cols: DataTableColumn<TaskBudgetGroup>[] = [
      {
        id: 'task',
        header: t('labels.task') || 'Target Task',
      },
      {
        id: 'lineType',
        header: t('columns.lineType') || 'Type',
        width: '100px',
      },
      {
        id: 'description',
        header: t('columns.description') || 'Description',
        className: 'border-r border-[var(--border)]',
      },
      {
        id: 'quantity',
        header: t('columns.quantity') || 'Quantity',
        align: 'right',
      },
      {
        id: 'uom',
        header: t('columns.uom') || 'UoM',
        align: 'left',
        width: '80px',
        className: 'border-r border-[var(--border)]',
      },
      {
        id: 'unitCost',
        header: t('columns.unitCost') || 'Unit Cost',
        align: 'right',
      },
      {
        id: 'budgetCost',
        header: t('columns.budgetCost') || 'Budget Cost',
        align: 'right',
      },
      {
        id: 'actualCost',
        header: t('columns.actualCost') || 'Actual Cost',
        align: 'right',
        className: 'border-r border-[var(--border)]',
      },
      {
        id: 'unitPrice',
        header: t('columns.unitPrice') || 'Unit Price',
        align: 'right',
      },
      {
        id: 'discountPercentage',
        header: 'Disc %',
        align: 'right',
      },
      {
        id: 'budgetRevenue',
        header: t('columns.budgetRevenue') || 'Budget Revenue',
        align: 'right',
      },
      {
        id: 'actualRevenue',
        header: t('columns.actualRevenue') || 'Actual Revenue',
        align: 'right',
        className: 'border-r border-[var(--border)]',
      },
    ];

    if (isEditable) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        align: 'right',
        width: '120px',
      });
    }

    return cols;
  }, [isEditable, t]);

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="section-heading !mb-0">
          <span className="material-symbols-outlined">calculate</span>
          {t('tabs.budget')}
        </h3>
        {isEditable && (
          <div className="self-start sm:self-auto">
            <Button size="sm" variant="primary" onClick={() => setShowCreateSlideOver(true)}>
              {t('buttons.addBudgetLine')}
            </Button>
          </div>
        )}
      </div>

      <DataTable<TaskBudgetGroup>
        columns={columns}
        data={taskGroups}
        keyExtractor={(group) => group.key}
        emptyMessage="No budget lines recorded. Click &quot;Add Budget Line&quot; to define budget estimates."
        renderCustomRow={(group, _idx, visibleCols) => {
          const formattedActualCost = formatAmount(group.actualCost, currency);
          const formattedBudgetCost = formatAmount(group.totalBudgetCost, currency);
          const formattedActualRevenue = formatAmount(group.actualRevenue, currency);
          const formattedBudgetRevenue = formatAmount(group.totalBudgetRevenue, currency);

          return (
            <React.Fragment key={group.key}>
              {/* Task Roll-up Summary Row */}
              <tr className="bg-[var(--bg-secondary)]/50 font-semibold border-t border-b border-[var(--border)]">
                <td className="text-left py-2.5 px-3">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {getTaskDisplayName(group.task)}
                  </span>
                </td>
                <td className="text-left py-2.5 px-3">
                  <span className="text-xs text-[var(--text-muted)] font-normal">
                    {formatLineCount(group.budgetLines.length)}
                  </span>
                </td>
                <td className="text-left py-2.5 px-3 border-r border-[var(--border)]">
                  <span className="text-xs text-[var(--text-muted)] font-normal truncate max-w-xs block">
                    {group.taskDescription || '—'}
                  </span>
                </td>
                <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">—</td>
                <td className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal border-r border-[var(--border)]">—</td>
                <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">—</td>
                <td className="text-right py-2.5 px-3">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {formattedBudgetCost}
                  </span>
                </td>
                <td className="text-right py-2.5 px-3 border-r border-[var(--border)]">
                  <span
                    className={`font-mono text-xs ${
                      group.isOverBudget
                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {formattedActualCost}
                  </span>
                </td>
                <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">—</td>
                <td className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal">—</td>
                <td className="text-right py-2.5 px-3">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {formattedBudgetRevenue}
                  </span>
                </td>
                <td className="text-right py-2.5 px-3 border-r border-[var(--border)]">
                  <span className="font-mono text-xs text-[var(--text-primary)]">
                    {formattedActualRevenue}
                  </span>
                </td>
                {isEditable && <td className="text-right py-2.5 px-3"></td>}
              </tr>

              {/* Budget Lines Belonging to This Task */}
              {group.budgetLines.map((line) => {
                const isUnbudgeted = Boolean(line.isUnbudgeted);
                const qty = Number(line.plannedQuantity || 0);
                const cost = Number(line.unitCost || 0);
                const price = Number(line.unitPrice || 0);
                const totalCost = Number(line.totalCost || qty * cost);
                const lineDisc = line.discountPercentage != null && line.discountPercentage !== '' && !isNaN(Number(line.discountPercentage))
                  ? Number(line.discountPercentage)
                  : Number(discountPercentage || 0);
                const totalPrice = Number(line.totalPrice != null ? line.totalPrice : computeLinePrice({ quantity: qty, pricePerUnit: price, discountPercentage: lineDisc, taxRate: 0 }).amount);
                const lineUom =
                  (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).uom ||
                  (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).baseUom ||
                  (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).product?.baseUom ||
                  (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).resource?.baseUom ||
                  (line.lineType === 'resource' ? 'HR' : line.lineType === 'item' ? 'EA' : '—');

                const formattedActualCost = formatAmount(line.actualCost, currency);
                const formattedActualRevenue = formatAmount(line.actualRevenue, currency);

                return (
                  <tr
                    key={line.budgetLineId}
                    className={`border-b border-[var(--border)]/40 ${
                      isUnbudgeted
                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-[var(--bg-secondary)]/30'
                    }`}
                  >
                    <td className="text-left py-2 px-3">
                      <span className="material-symbols-outlined text-[13px] text-[var(--text-muted)] pl-4">subdirectory_arrow_right</span>
                    </td>
                    <td className="text-left py-2 px-3">
                      {isUnbudgeted ? (
                        <span className="badge badge-secondary text-xs uppercase font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          {t('labels.other')}
                        </span>
                      ) : (
                        <span className="badge badge-secondary text-xs uppercase font-medium">
                          {getLineTypeBadgeLabel(line.lineType)}
                        </span>
                      )}
                    </td>
                    <td className="text-left py-2 px-3 border-r border-[var(--border)]">
                      <span
                        className={`text-xs ${
                          isUnbudgeted
                            ? 'font-medium text-amber-800 dark:text-amber-300 italic'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {line.description || '—'}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs">
                        {isUnbudgeted ? '—' : qty.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-left py-2 px-3 border-r border-[var(--border)]">
                      <span className="text-xs text-[var(--text-muted)] font-mono uppercase">
                        {isUnbudgeted ? '—' : lineUom}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs">
                        {isUnbudgeted ? '—' : formatAmount(cost, currency)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs text-[var(--text-primary)]">
                        {isUnbudgeted ? '—' : formatAmount(totalCost, currency)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 border-r border-[var(--border)]">
                      <span
                        className={`font-mono text-xs ${
                          line.isOverBudget
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {formattedActualCost}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs">
                        {isUnbudgeted ? '—' : formatAmount(price, currency)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs">
                        {isUnbudgeted ? '—' : `${lineDisc}%`}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className="font-mono text-xs text-[var(--text-primary)]">
                        {isUnbudgeted ? '—' : formatAmount(totalPrice, currency)}
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 border-r border-[var(--border)]">
                      <span className="font-mono text-xs text-[var(--text-primary)]">
                        {formattedActualRevenue}
                      </span>
                    </td>
                    {isEditable && (
                      <td className="text-right py-2 px-3">
                        {renderActionButtons(line)}
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* If Task Has No Budget Lines */}
              {group.budgetLines.length === 0 && (
                <tr key={`${group.key}-empty`}>
                  <td colSpan={visibleCols.length} className="text-xs text-[var(--text-muted)] italic pl-8 py-2 bg-[var(--bg-secondary)]/10">
                    No budget lines allocated to this task
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        }}
        footer={
          taskGroups.length > 0 ? (
            <tr className="border-t-2 border-[var(--border)] font-bold bg-[var(--bg-secondary)]/40">
              <td className="text-left py-3 px-3 text-xs font-bold text-[var(--text-primary)]">
                {t('columns.total')}
              </td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)]">—</td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] border-r border-[var(--border)]">—</td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-left border-r border-[var(--border)]">—</td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
              <td className="py-3 px-3 text-right">
                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  {formatAmount(grandTotals.totalBudgetCost, currency)}
                </span>
              </td>
              <td className="py-3 px-3 text-right border-r border-[var(--border)]">
                <span
                  className={`font-mono text-xs ${
                    grandTotals.isOverBudget
                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {formatAmount(grandTotals.totalActualCost, currency)}
                </span>
              </td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
              <td className="py-3 px-3 text-xs text-[var(--text-muted)] text-right">—</td>
              <td className="py-3 px-3 text-right">
                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  {formatAmount(grandTotals.totalBudgetRevenue, currency)}
                </span>
              </td>
              <td className="py-3 px-3 text-right border-r border-[var(--border)]">
                <span className="font-mono text-xs text-[var(--text-primary)]">
                  {formatAmount(grandTotals.totalActualRevenue, currency)}
                </span>
              </td>
              {isEditable && <td className="py-3 px-3 text-right"></td>}
            </tr>
          ) : undefined
        }
        mobileCard={(group) => {
          const formattedActualCost = formatAmount(group.actualCost, currency);
          const formattedBudgetCost = formatAmount(group.totalBudgetCost, currency);
          const formattedActualRevenue = formatAmount(group.actualRevenue, currency);
          const formattedBudgetRevenue = formatAmount(group.totalBudgetRevenue, currency);

          return (
            <div key={group.key} className="card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="font-bold text-sm text-[var(--text-primary)]">
                  {getTaskDisplayName(group.task)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatLineCount(group.budgetLines.length)}
                </span>
              </div>

              {/* Task Roll-up Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--bg-secondary)]/40 p-2.5 rounded-lg">
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.budgetCost')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {formattedBudgetCost}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.actualCost')}</span>
                  <span className={`font-mono ${group.isOverBudget ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-[var(--text-primary)]'}`}>
                    {formattedActualCost}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.budgetRevenue')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {formattedBudgetRevenue}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.actualRevenue')}</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {formattedActualRevenue}
                  </span>
                </div>
              </div>

              {/* Lines */}
              {group.budgetLines.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {group.budgetLines.map((line) => {
                    const isUnbudgeted = Boolean(line.isUnbudgeted);
                    const qty = Number(line.plannedQuantity || 0);
                    const cost = Number(line.unitCost || 0);
                    const price = Number(line.unitPrice || 0);
                    const totalCost = Number(line.totalCost || qty * cost);
                    const lineDisc = line.discountPercentage != null && line.discountPercentage !== '' && !isNaN(Number(line.discountPercentage))
                      ? Number(line.discountPercentage)
                      : Number(discountPercentage || 0);
                    const totalPrice = Number(line.totalPrice != null ? line.totalPrice : computeLinePrice({ quantity: qty, pricePerUnit: price, discountPercentage: lineDisc, taxRate: 0 }).amount);
                    const lineUom =
                      (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).uom ||
                      (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).baseUom ||
                      (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).product?.baseUom ||
                      (line as { uom?: string; baseUom?: string; product?: { baseUom?: string }; resource?: { baseUom?: string } }).resource?.baseUom ||
                      (line.lineType === 'resource' ? 'HR' : line.lineType === 'item' ? 'EA' : '—');

                    const details = isUnbudgeted
                      ? [
                          {
                            label: t('columns.actualCost'),
                            value: formatAmount(line.actualCost, currency),
                          },
                          {
                            label: t('columns.actualRevenue'),
                            value: formatAmount(line.actualRevenue, currency),
                          },
                        ]
                      : [
                          { label: t('columns.quantity'), value: qty.toLocaleString() },
                          { label: t('columns.uom'), value: lineUom },
                          { label: t('columns.unitCost'), value: formatAmount(cost, currency) },
                          {
                            label: t('columns.budgetCost'),
                            value: formatAmount(totalCost, currency),
                          },
                          {
                            label: t('columns.actualCost'),
                            value: formatAmount(line.actualCost, currency),
                          },
                          { label: t('columns.unitPrice'), value: formatAmount(price, currency) },
                          { label: 'Disc %', value: isUnbudgeted ? '—' : `${lineDisc}%` },
                          {
                            label: t('columns.budgetRevenue'),
                            value: formatAmount(totalPrice, currency),
                          },
                          {
                            label: t('columns.actualRevenue'),
                            value: formatAmount(line.actualRevenue, currency),
                          },
                        ];

                    return (
                      <MobileLineItemCard
                        key={line.budgetLineId}
                        title={line.description || '—'}
                        topRightBadge={
                          isUnbudgeted ? (
                            <span className="badge badge-secondary text-xs uppercase font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                              {t('labels.other')}
                            </span>
                          ) : (
                            <span className="badge badge-secondary text-xs uppercase font-medium">
                              {getLineTypeBadgeLabel(line.lineType)}
                            </span>
                          )
                        }
                        details={details}
                        actions={renderActionButtons(line)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic py-1">No budget lines defined for this task</p>
              )}
            </div>
          );
        }}
      />

      {/* SlideOver: Add / Edit Budget Line */}
      <BudgetLineSlideOver
        isOpen={showCreateSlideOver || editingLine !== null}
        onClose={() => {
          setShowCreateSlideOver(false);
          setEditingLine(null);
        }}
        line={editingLine}
        tasks={tasks}
        currency={currency}
        discountPercentage={discountPercentage}
        onSubmit={async (dto, lineId) => {
          if (lineId && updateBudgetLine) {
            await updateBudgetLine(lineId, dto);
          } else {
            await createBudgetLine(dto);
          }
        }}
      />
    </div>
  );
}
