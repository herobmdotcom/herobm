'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { PROJECT_TASK_STATE, getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';

interface ConsumeProjectExpenseSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  tasks: api.ProjectTaskResponseDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency?: string;
  defaultTaskId?: string;
  consumeExpense?: (dto: api.ConsumeExpenseDto) => Promise<unknown>;
  onSubmit?: (dto: api.ConsumeExpenseDto) => Promise<void>;
  onSuccess?: () => Promise<void>;
}

export function ConsumeProjectExpenseSlideOver({
  isOpen,
  onClose,
  projectId: _projectId,
  tasks = [],
  budgetLines = [],
  ledgerEntries = [],
  currency = 'USD',
  defaultTaskId,
  consumeExpense,
  onSubmit,
  onSuccess,
}: ConsumeProjectExpenseSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(false);
  const [projectTaskId, setProjectTaskId] = useState('');
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('__unbudgeted__');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [unitPrice, setUnitPrice] = useState('0');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      const initTaskId =
        (defaultTaskId && tasks.some((t) => t.projectTaskId === defaultTaskId) && defaultTaskId) ||
        (tasks.find((t) => t.stateCode !== PROJECT_TASK_STATE.COMPLETED)?.projectTaskId || (tasks.length > 0 ? tasks[0].projectTaskId : ''));

      setProjectTaskId(initTaskId);

      const matchingBudgetLines = budgetLines.filter(
        (b) => b.projectTaskId === initTaskId && b.lineType === 'expense'
      );
      setSelectedBudgetLineId(
        matchingBudgetLines.length > 0 ? matchingBudgetLines[0].budgetLineId : '__unbudgeted__'
      );

      setDescription('');
      setQuantity('1');
      setUnitCost('0');
      setUnitPrice('0');
      setDiscountPercentage('');
      setPostingDate(new Date().toISOString().slice(0, 10));
      setReferenceNumber('');
      setLoading(false);
    }
  }, [isOpen, defaultTaskId, tasks, budgetLines]);

  // Filter available expense budget lines for the selected task
  const availableBudgetLines = useMemo(() => {
    if (!projectTaskId) return [];
    return budgetLines.filter(
      (b) => b.projectTaskId === projectTaskId && b.lineType === 'expense'
    );
  }, [budgetLines, projectTaskId]);

  // Active selected budget line
  const activeBudgetLine = useMemo(() => {
    if (!selectedBudgetLineId || selectedBudgetLineId === '__unbudgeted__') return null;
    return budgetLines.find((b) => b.budgetLineId === selectedBudgetLineId) || null;
  }, [budgetLines, selectedBudgetLineId]);

  // Live Calculations for live financial banner
  const { totalCost, totalRevenue, marginPercent } = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const cost = parseFloat(unitCost) || 0;
    const price = parseFloat(unitPrice) || 0;
    const tCost = qty * cost;
    const tRev = qty * price;
    const margin = tRev > 0 ? ((tRev - tCost) / tRev) * 100 : 0;
    return { totalCost: tCost, totalRevenue: tRev, marginPercent: margin };
  }, [quantity, unitCost, unitPrice]);

  // Budget Headroom calculations
  const { plannedCost, consumedCost, remainingCost, projectedRemainingCost, isOverBudget } =
    useMemo(() => {
      if (!activeBudgetLine) {
        return {
          plannedCost: 0,
          consumedCost: 0,
          remainingCost: 0,
          projectedRemainingCost: 0,
          isOverBudget: false,
        };
      }
      const planned =
        Number(activeBudgetLine.totalCost ?? 0) ||
        Number(activeBudgetLine.plannedQuantity ?? 0) * Number(activeBudgetLine.unitCost ?? 0);

      const consumed = ledgerEntries
        .filter((e) => e.budgetLineId === activeBudgetLine.budgetLineId)
        .reduce((sum, e) => sum + Number(e.totalCostBase || 0), 0);

      const remaining = planned - consumed;
      const thisEntryCost = (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0);
      const projected = remaining - thisEntryCost;

      return {
        plannedCost: planned,
        consumedCost: consumed,
        remainingCost: remaining,
        projectedRemainingCost: projected,
        isOverBudget: projected < 0,
      };
    }, [activeBudgetLine, ledgerEntries, quantity, unitCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectTaskId) {
      toast.error(t('placeholders.selectTaskPlaceholder') || 'Please select a target task.');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('errors.invalidQuantity') || 'Quantity must be greater than 0.');
      return;
    }

    const costNum = parseFloat(unitCost);
    if (isNaN(costNum) || costNum < 0) {
      toast.error('Unit cost must be valid.');
      return;
    }

    const priceNum = parseFloat(unitPrice) || 0;

    const dto: api.ConsumeExpenseDto = {
      projectTaskId,
      budgetLineId:
        selectedBudgetLineId && selectedBudgetLineId !== '__unbudgeted__'
          ? selectedBudgetLineId
          : undefined,
      description: description.trim(),
      quantity: qty,
      unitCost: costNum,
      unitPrice: priceNum,
      discountPercentage: discountPercentage ? parseFloat(discountPercentage) : undefined,
      postingDate: postingDate ? new Date(postingDate).toISOString() : new Date().toISOString(),
      referenceNumber: referenceNumber.trim() || undefined,
      sourceType: 'manual_journal',
    };

    setLoading(true);
    try {
      if (consumeExpense) {
        await consumeExpense(dto);
      } else if (onSubmit) {
        await onSubmit(dto);
      }

      toast.success(t('toasts.expenseRecorded') || 'Project expense recorded successfully');
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to record project expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('recordExpenseTitle') || 'Record Project Expense'}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={loading || !projectTaskId || !description.trim()}
            onClick={handleSubmit}
          >
            {loading
              ? t('buttons.recording') || 'Recording...'
              : t('buttons.recordExpense') || 'Record Expense'}
          </Button>
        </div>
      }
    >
      <form
        id="record-project-expense-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 py-2"
      >
        {/* Target Task */}
        <div>
          <label htmlFor="expense-target-task" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.task')} <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            id="expense-target-task"
            required
            className="input w-full text-xs"
            value={projectTaskId}
            onChange={(e) => {
              const newTaskId = e.target.value;
              setProjectTaskId(newTaskId);
              const matching = budgetLines.filter(
                (b) => b.projectTaskId === newTaskId && b.lineType === 'expense'
              );
              setSelectedBudgetLineId(
                matching.length > 0 ? matching[0].budgetLineId : '__unbudgeted__'
              );
            }}
          >
            <option value="">{t('placeholders.selectTaskPlaceholder')}</option>
            {tasks.map((tk) => {
              const isCompleted = tk.stateCode === PROJECT_TASK_STATE.COMPLETED;
              const completedTag = isCompleted ? ` (${tCommon('states.completed')})` : '';
              return (
                <option key={tk.projectTaskId} value={tk.projectTaskId}>
                  {tk.taskCode ? `${tk.taskCode} — ` : ''}{tk.name}{completedTag}
                </option>
              );
            })}
          </select>
        </div>

        {/* Budget Allocation Selector */}
        <div>
          <label htmlFor="expense-budget-line" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.budgetAllocation')}
          </label>
          <select
            id="expense-budget-line"
            className="input w-full text-xs"
            value={selectedBudgetLineId}
            onChange={(e) => setSelectedBudgetLineId(e.target.value)}
          >
            <option value="__unbudgeted__">
              {t('labels.unbudgetedOption')}
            </option>
            {availableBudgetLines.map((b) => {
              const desc = b.description || 'Expense Line';
              const total = Number(b.totalCost ?? 0) || (Number(b.plannedQuantity ?? 0) * Number(b.unitCost ?? 0));
              const label = `${desc} (Planned: ${formatAmount(total, currency)})`;
              return (
                <option key={b.budgetLineId} value={b.budgetLineId}>
                  {label}
                </option>
              );
            })}
          </select>

          {/* Budget Line Headroom Banner */}
          {activeBudgetLine && (
            <div
              className={`mt-2 p-2.5 rounded-lg border text-xs ${
                isOverBudget
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1">
                  {isOverBudget ? (
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">info</span>
                  )}
                  {t('labels.budgetHeadroom')}
                </span>
                <span>
                  {formatAmount(remainingCost, currency)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-[var(--border)]/40 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.plannedCost')}</span>
                  <span className="font-medium">
                    {formatAmount(plannedCost, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">{t('columns.consumed')}</span>
                  <span className="font-medium">
                    {formatAmount(consumedCost, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">{t('labels.budgetHeadroom')}</span>
                  <span
                    className={`font-semibold ${
                      isOverBudget
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {formatAmount(projectedRemainingCost, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="expense-description" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.description')} <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            id="expense-description"
            type="text"
            required
            className="input w-full text-xs"
            placeholder={
              t('placeholders.expenseDescription') ||
              'e.g. Travel & Lodging, Site Permit, Crane Hire'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Quantities & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="expense-quantity" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.quantity')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="expense-quantity"
              type="number"
              step="any"
              min="0.0001"
              required
              className="input w-full text-xs"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="expense-unit-cost" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.unitCost')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="expense-unit-cost"
              type="number"
              step="any"
              min="0"
              required
              className="input w-full text-xs"
              value={unitCost}
              onChange={(e) => {
                const val = e.target.value;
                setUnitCost(val);
                // If price wasn't modified or matches previous cost, keep in sync
                if (unitPrice === '0' || unitPrice === unitCost) {
                  setUnitPrice(val);
                }
              }}
            />
          </div>

          <div>
            <label htmlFor="expense-unit-price" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.unitPrice')}
            </label>
            <input
              id="expense-unit-price"
              type="number"
              step="any"
              min="0"
              className="input w-full text-xs"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="expense-discount-percentage" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Discount %
            </label>
            <input
              id="expense-discount-percentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input w-full text-xs"
              placeholder="Inherit"
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
            />
          </div>
        </div>

        {/* Posting Date & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="expense-entry-date" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.entryDate')}
            </label>
            <input
              id="expense-entry-date"
              type="date"
              className="input w-full text-xs"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="expense-reference-number" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.referenceNumber')}
            </label>
            <input
              id="expense-reference-number"
              type="text"
              className="input w-full text-xs"
              placeholder="e.g. INV-98742, RCP-001"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Live Financial Summary */}
        <div className="pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">{t('columns.actualCost')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {formatAmount(totalCost, currency)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">{t('columns.actualRevenue')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {formatAmount(totalRevenue, currency)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">{t('columns.margin')}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {marginPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
