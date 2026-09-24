'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { RESOURCE_TYPE } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import type { ProjectResource } from '../useProject';

interface EditResourceUsageSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  entry: api.ProjectLedgerEntryResponseDto | null;
  tasks: api.ProjectTaskResponseDto[];
  resources: ProjectResource[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency?: string;
  onSubmit: (ledgerId: string, dto: api.UpdateProjectLedgerEntryDto) => Promise<void>;
  onSuccess?: () => Promise<unknown>;
}

export function EditResourceUsageSlideOver({
  isOpen,
  onClose,
  entry,
  tasks = [],
  resources = [],
  budgetLines = [],
  ledgerEntries = [],
  currency = 'USD',
  onSubmit,
  onSuccess,
}: EditResourceUsageSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [submitting, setSubmitting] = useState(false);
  const [projectTaskId, setProjectTaskId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [unitPrice, setUnitPrice] = useState('0');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  // Find matched resource
  const matchedResource = useMemo(() => {
    const rId = resourceId || entry?.resourceId;
    return resources.find((r) => r.resourceId === rId) || null;
  }, [resourceId, entry, resources]);

  useEffect(() => {
    if (isOpen && entry) {
      const initialTaskId = entry.projectTaskId || (tasks.length > 0 ? tasks[0].projectTaskId : '');
      const initialResourceId = entry.resourceId || '';
      setProjectTaskId(initialTaskId);
      setResourceId(initialResourceId);
      setQuantity(String(entry.quantity ?? '1'));
      setUnitCost(String(entry.unitCostBase ?? '0'));
      setUnitPrice(String(entry.unitPriceBase ?? '0'));
      setDiscountPercentage(entry.discountPercentage ? String(entry.discountPercentage) : '');
      setPostingDate(
        entry.postingDate ? new Date(entry.postingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      );
      setDescription(entry.description || '');
      setSubmitting(false);

      if (entry.budgetLineId) {
        setSelectedBudgetLineId(entry.budgetLineId);
      } else if (initialTaskId && initialResourceId) {
        const exactMatch = (budgetLines || []).find(
          (b) => b.projectTaskId === initialTaskId && b.resourceId === initialResourceId,
        );
        if (exactMatch) {
          setSelectedBudgetLineId(exactMatch.budgetLineId);
        } else {
          const productMatch = (budgetLines || []).find(
            (b) =>
              b.projectTaskId === initialTaskId &&
              (matchedResource as { serviceProductId?: string })?.serviceProductId &&
              b.productId === (matchedResource as { serviceProductId?: string })?.serviceProductId,
          );
          if (productMatch) {
            setSelectedBudgetLineId(productMatch.budgetLineId);
          } else {
            const firstResourceLine = (budgetLines || []).find(
              (b) => b.projectTaskId === initialTaskId && b.lineType === 'resource',
            );
            if (firstResourceLine) {
              setSelectedBudgetLineId(firstResourceLine.budgetLineId);
            } else {
              setSelectedBudgetLineId('__unbudgeted__');
            }
          }
        }
      } else {
        setSelectedBudgetLineId('__unbudgeted__');
      }
    }
  }, [isOpen, entry, tasks, budgetLines, matchedResource]);

  const availableBudgetLines = useMemo(() => {
    if (!projectTaskId) return [];
    return (budgetLines || []).filter(
      (b) => b.projectTaskId === projectTaskId && (b.lineType === 'resource' || b.lineType === 'expense'),
    );
  }, [budgetLines, projectTaskId]);

  const activeBudgetLine = useMemo(() => {
    if (!selectedBudgetLineId || selectedBudgetLineId === '__unbudgeted__') return null;
    return (budgetLines || []).find((b) => b.budgetLineId === selectedBudgetLineId) || null;
  }, [budgetLines, selectedBudgetLineId]);

  const currentUom = matchedResource?.baseUom || 'Hours';

  // Headroom calculation (excluding currently edited entry to prevent double-counting)
  const { plannedQty, consumedQty, remainingQty, projectedRemaining, isOverBudget } = useMemo(() => {
    if (!activeBudgetLine) {
      return { plannedQty: 0, consumedQty: 0, remainingQty: 0, projectedRemaining: 0, isOverBudget: false };
    }
    const planned = parseFloat(activeBudgetLine.plannedQuantity || '0');
    const consumed = (ledgerEntries || [])
      .filter((l) => {
        if (entry && l.ledgerId === entry.ledgerId) return false;
        if (l.budgetLineId) return l.budgetLineId === activeBudgetLine.budgetLineId;
        if (l.projectTaskId !== activeBudgetLine.projectTaskId) return false;
        if (activeBudgetLine.resourceId && l.resourceId === activeBudgetLine.resourceId) return true;
        if (activeBudgetLine.productId && l.productId === activeBudgetLine.productId) return true;
        return false;
      })
      .reduce((sum, l) => sum + Number(l.quantity || 0), 0);

    const remaining = Math.max(0, planned - consumed);
    const entryQty = parseFloat(quantity) || 0;
    const projRem = planned - (consumed + entryQty);

    return {
      plannedQty: planned,
      consumedQty: consumed,
      remainingQty: remaining,
      projectedRemaining: projRem,
      isOverBudget: projRem < 0,
    };
  }, [activeBudgetLine, ledgerEntries, entry, quantity]);

  // Live calculations
  const { totalCost, totalPrice } = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const cost = parseFloat(unitCost) || 0;
    const price = parseFloat(unitPrice) || 0;
    return {
      totalCost: qty * cost,
      totalPrice: qty * price,
    };
  }, [quantity, unitCost, unitPrice]);

  const formatResourceType = (type?: string) => {
    switch (type) {
      case RESOURCE_TYPE.PERSON:
        return t('resources.typePerson');
      case RESOURCE_TYPE.CONTRACTOR:
        return t('resources.typeContractor');
      case RESOURCE_TYPE.EQUIPMENT:
        return t('resources.typeEquipment');
      default:
        return type || 'Resource';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    if (!projectTaskId) {
      toast.error(t('placeholders.selectTaskPlaceholder') || 'Please select a target WBS task.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('errors.invalidQuantity') || 'Quantity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(entry.ledgerId, {
        projectTaskId,
        resourceId: resourceId || undefined,
        budgetLineId:
          selectedBudgetLineId && selectedBudgetLineId !== '__unbudgeted__'
            ? selectedBudgetLineId
            : null,
        quantity: qty,
        unitCost: parseFloat(unitCost) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        discountPercentage: discountPercentage ? parseFloat(discountPercentage) : undefined,
        postingDate: postingDate ? new Date(postingDate).toISOString() : undefined,
        description: description.trim() || undefined,
      });

      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('sections.timeLog') ? `Edit ${t('sections.timeLog')}` : 'Edit Resource Usage'}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-resource-usage-form"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={submitting || !projectTaskId}
          >
            {submitting ? t('buttons.saving') : t('buttons.saveChanges')}
          </Button>
        </div>
      }
    >
      <form id="edit-resource-usage-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        {/* Resource Information Header */}
        <div className="pb-3 border-b border-[var(--border)] flex items-baseline justify-between gap-2 text-xs">
          <div>
            <span className="text-sm font-medium text-[var(--text-primary)] block">
              {matchedResource?.name || entry?.description || t('labels.resource')}
            </span>
            {matchedResource?.serviceProduct?.name && (
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                {matchedResource.serviceProduct.name}
              </span>
            )}
          </div>
          {matchedResource && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatResourceType(matchedResource.resourceType)}
            </span>
          )}
        </div>

        {/* Target Task */}
        <div>
          <label htmlFor="edit-usage-task" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.task')} <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            id="edit-usage-task"
            required
            className="input w-full text-xs"
            value={projectTaskId}
            onChange={(e) => setProjectTaskId(e.target.value)}
          >
            <option value="">{t('placeholders.selectTask')}</option>
            {tasks.map((tk) => (
              <option key={tk.projectTaskId} value={tk.projectTaskId}>
                {tk.taskCode ? `${tk.taskCode} — ` : ''}{tk.name}
              </option>
            ))}
          </select>
        </div>

        {/* Budget Allocation Selector */}
        <div>
          <label htmlFor="edit-usage-budget-line" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.budgetAllocation')}
          </label>
          <select
            id="edit-usage-budget-line"
            className="input w-full text-xs"
            value={selectedBudgetLineId}
            onChange={(e) => setSelectedBudgetLineId(e.target.value)}
          >
            <option value="__unbudgeted__">
              {t('labels.unbudgetedOption')}
            </option>
            {availableBudgetLines.map((b) => {
              const uom = b.lineType === 'resource' ? 'HR' : 'EA';
              const label = `${b.description ?? ''} (${Number(b.plannedQuantity || 0).toLocaleString()} ${uom} planned @ ${formatAmount(Number(b.unitCost || 0), currency)})`;
              return (
                <option key={b.budgetLineId} value={b.budgetLineId}>
                  {label}
                </option>
              );
            })}
          </select>

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
                <span className="font-mono">
                  {remainingQty.toFixed(1)} {currentUom}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-[var(--border)]/40 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)] block">Planned:</span>
                  <span className="font-mono font-medium">
                    {plannedQty.toFixed(1)} {currentUom}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Consumed:</span>
                  <span className="font-mono font-medium">
                    {consumedQty.toFixed(1)} {currentUom}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">After edit:</span>
                  <span
                    className={`font-mono font-medium ${
                      projectedRemaining < 0
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : ''
                    }`}
                  >
                    {projectedRemaining >= 0
                      ? `${projectedRemaining.toFixed(1)} ${currentUom}`
                      : `+${Math.abs(projectedRemaining).toFixed(1)} ${currentUom} over`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date & Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-usage-date" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.date')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="edit-usage-date"
              type="date"
              required
              className="input w-full text-xs"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edit-usage-desc" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.notes')}
            </label>
            <input
              id="edit-usage-desc"
              type="text"
              className="input w-full text-xs"
              placeholder={t('placeholders.budgetDescription') || 'Work notes...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Quantity (UOM), Unit Cost, Unit Price, Discount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label htmlFor="edit-usage-qty" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.quantity')} <span className="font-normal text-[var(--text-muted)]">({currentUom})</span> <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="edit-usage-qty"
                type="number"
                step="0.1"
                min="0.1"
                required
                className="input w-full pr-14 text-xs"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <span className="absolute right-3 text-xs text-[var(--text-muted)] pointer-events-none select-none">
                {currentUom}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="edit-usage-cost" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.unitCost')} {currentUom ? `(${currentUom})` : ''}
            </label>
            <input
              id="edit-usage-cost"
              type="number"
              step="0.01"
              min="0"
              className="input w-full text-xs"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="edit-usage-price" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.unitPrice')} {currentUom ? `(${currentUom})` : ''}
            </label>
            <input
              id="edit-usage-price"
              type="number"
              step="0.01"
              min="0"
              className="input w-full text-xs"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="edit-usage-discount" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              Discount %
            </label>
            <input
              id="edit-usage-discount"
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

        {/* Live Calculation Summary */}
        <div className="pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[var(--text-muted)]">{t('columns.actualCost')}</div>
            <div className="text-[var(--text-primary)] font-medium mt-0.5">
              {formatAmount(totalCost, currency)}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">{t('columns.actualRevenue')}</div>
            <div className="text-[var(--text-primary)] font-medium mt-0.5">
              {formatAmount(totalPrice, currency)}
            </div>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}
