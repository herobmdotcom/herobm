'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import ProductSearchInput, { Product } from '@/components/shared/ProductSearchInput';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { PROJECT_TASK_STATE } from '@herobm/shared';

export interface StagedMaterialOption {
  productId: string;
  productNumber: string;
  productDescription: string;
  availableQty: number;
}

interface ConsumeProjectMaterialSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  stagingLocationId?: string | null;
  stagingBinId?: string | null;
  tasks: api.ProjectTaskResponseDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency?: string;
  availableMaterials: StagedMaterialOption[];
  discountPercentage?: number;
  issueInventory: (dto: api.IssueInventoryDto) => Promise<void>;
  onSuccess: () => Promise<void>;
}

export function ConsumeProjectMaterialSlideOver({
  isOpen,
  onClose,
  projectId: _projectId,
  projectNumber,
  stagingLocationId,
  stagingBinId,
  tasks = [],
  budgetLines = [],
  ledgerEntries = [],
  currency = 'USD',
  availableMaterials = [],
  discountPercentage = 0,
  issueInventory,
  onSuccess,
}: ConsumeProjectMaterialSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [projectTaskId, setProjectTaskId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [discountPercentageState, setDiscountPercentageState] = useState<string>(String(discountPercentage || 0));
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  // Default to first non-completed task if available
  useEffect(() => {
    if (tasks.length > 0 && !projectTaskId) {
      const initialTask = tasks.find((tk) => tk.stateCode !== PROJECT_TASK_STATE.COMPLETED) || tasks[0];
      setProjectTaskId(initialTask.projectTaskId);
    }
  }, [tasks, projectTaskId]);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      if (tasks.length > 0) {
        const initialTask = tasks.find((tk) => tk.stateCode !== PROJECT_TASK_STATE.COMPLETED) || tasks[0];
        setProjectTaskId(initialTask.projectTaskId);
      }
      setSelectedProduct(null);
      setSelectedBudgetLineId('');
      setQuantity('1');
      setDiscountPercentageState(String(discountPercentage || 0));
      setMemo('');
    }
  }, [isOpen, tasks, discountPercentage]);

  const availableBudgetLines = useMemo(() => {
    if (!projectTaskId) return [];
    return (budgetLines || []).filter(
      (b) => b.projectTaskId === projectTaskId && b.lineType === 'item',
    );
  }, [budgetLines, projectTaskId]);

  // Auto-select matching budget line when product or task changes
  useEffect(() => {
    if (!selectedProduct || !projectTaskId) {
      setSelectedBudgetLineId('');
      return;
    }
    const productMatch = (budgetLines || []).find(
      (b) => b.projectTaskId === projectTaskId && b.lineType === 'item' && b.productId === selectedProduct.productId,
    );
    if (productMatch) {
      setSelectedBudgetLineId(productMatch.budgetLineId);
      return;
    }
    const firstItemLine = (budgetLines || []).find(
      (b) => b.projectTaskId === projectTaskId && b.lineType === 'item',
    );
    if (firstItemLine) {
      setSelectedBudgetLineId(firstItemLine.budgetLineId);
      return;
    }
    setSelectedBudgetLineId('__unbudgeted__');
  }, [selectedProduct, projectTaskId, budgetLines]);

  const activeBudgetLine = useMemo(() => {
    if (!selectedBudgetLineId || selectedBudgetLineId === '__unbudgeted__') return null;
    return (budgetLines || []).find((b) => b.budgetLineId === selectedBudgetLineId) || null;
  }, [budgetLines, selectedBudgetLineId]);

  // When activeBudgetLine changes, auto-populate discount percentage if available
  useEffect(() => {
    if (activeBudgetLine?.discountPercentage !== undefined && activeBudgetLine?.discountPercentage !== null) {
      setDiscountPercentageState(String(activeBudgetLine.discountPercentage));
    } else {
      setDiscountPercentageState(String(discountPercentage || 0));
    }
  }, [activeBudgetLine, discountPercentage]);

  const { plannedQty, consumedQty, remainingQty, projectedRemaining, isOverBudget } = useMemo(() => {
    if (!activeBudgetLine) {
      return { plannedQty: 0, consumedQty: 0, remainingQty: 0, projectedRemaining: 0, isOverBudget: false };
    }
    const planned = parseFloat(activeBudgetLine.plannedQuantity || '0');
    const consumed = (ledgerEntries || [])
      .filter((l) => {
        if (l.budgetLineId) return l.budgetLineId === activeBudgetLine.budgetLineId;
        if (l.projectTaskId !== activeBudgetLine.projectTaskId) return false;
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
  }, [activeBudgetLine, ledgerEntries, quantity]);

  // Find available stock for the currently selected product
  const currentAvailable = useMemo(() => {
    if (!selectedProduct) return null;
    const found = availableMaterials.find(
      (m) =>
        m.productId === selectedProduct.productId ||
        m.productNumber === selectedProduct.productNumber,
    );
    return found ? found.availableQty : 0;
  }, [selectedProduct, availableMaterials]);

  const handleSelectFromStaged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prodId = e.target.value;
    if (!prodId) {
      setSelectedProduct(null);
      return;
    }
    const found = availableMaterials.find((m) => m.productId === prodId);
    if (found) {
      setSelectedProduct({
        productId: found.productId,
        productNumber: found.productNumber,
        name: found.productDescription,
        listPrice: '0',
        tradePrice: '0',
      });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!projectTaskId) {
      toast.error(t('errors.selectTask') || 'Please select a project task.');
      return;
    }
    if (!selectedProduct) {
      toast.error('Please select a product to consume.');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error(t('errors.quantityMustBePositive') || 'Quantity must be greater than 0.');
      return;
    }

    const isExceeded = currentAvailable !== null && currentAvailable > 0 && parseFloat(quantity) > currentAvailable;
    if (isExceeded) {
      toast.error(t('errors.quantityExceedsAvailable', { max: currentAvailable }));
      return;
    }

    setLoading(true);
    try {
      await issueInventory({
        productId: selectedProduct.productId,
        projectTaskId,
        budgetLineId:
          selectedBudgetLineId && selectedBudgetLineId !== '__unbudgeted__'
            ? selectedBudgetLineId
            : undefined,
        quantity: qty,
        locationId: stagingLocationId || undefined,
        binId: stagingBinId || undefined,
        memo: memo.trim() || `Material consumed on task for ${projectNumber || 'Project'}`,
      });

      setSelectedProduct(null);
      setSelectedBudgetLineId('');
      setQuantity('1');
      setDiscountPercentageState(String(discountPercentage || 0));
      setMemo('');
      await onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isExceeded = currentAvailable !== null && currentAvailable > 0 && parseFloat(quantity) > currentAvailable;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('consumeMaterialTitle')}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading || !selectedProduct || !projectTaskId || isExceeded}
            onClick={handleSubmit}
          >
            {loading ? t('buttons.saving') : t('buttons.consumeMaterial')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Target Task */}
        <div>
          <label htmlFor="material-target-task" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.task')} <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            id="material-target-task"
            required
            className="input w-full text-xs"
            value={projectTaskId}
            onChange={(e) => setProjectTaskId(e.target.value)}
          >
            <option value="">{t('placeholders.selectTask')}</option>
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

        {/* Source Material: Select from Staged Materials or Search Product */}
        <div className="space-y-3">
          {availableMaterials.length > 0 && (
            <div>
              <label htmlFor="select-staged-material" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.stagedMaterials')}
              </label>
              <select
                id="select-staged-material"
                className="input w-full text-xs"
                value={selectedProduct?.productId || ''}
                onChange={handleSelectFromStaged}
              >
                <option value="">{t('placeholders.selectStagedStock')}</option>
                {availableMaterials.map((m) => (
                  <option key={m.productId} value={m.productId}>
                    {m.productNumber} — {m.productDescription} ({m.availableQty} Available)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {availableMaterials.length > 0
                ? t('labels.searchWarehouseSku')
                : `${t('labels.product')} *`}
            </label>
            <ProductSearchInput
              onSelect={(p) => setSelectedProduct(p)}
              placeholder={t('placeholders.selectProduct')}
            />
          </div>
        </div>

        {/* Selected Product Card & Budget Allocation */}
        {selectedProduct && (
          <div className="space-y-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]">
              <div>
                <div className="font-medium text-xs text-[var(--text-primary)]">
                  {selectedProduct.productNumber}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {selectedProduct.name}
                </div>
              </div>
              {currentAvailable !== null && (
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">
                    {t('columns.available')}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {currentAvailable}
                  </span>
                </div>
              )}
            </div>

            {/* Budget Allocation Selector */}
            <div>
              <label htmlFor="material-budget-line" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.budgetAllocation')}
              </label>
              <select
                id="material-budget-line"
                className="input w-full text-xs"
                value={selectedBudgetLineId}
                onChange={(e) => setSelectedBudgetLineId(e.target.value)}
              >
                <option value="__unbudgeted__">
                  {t('labels.unbudgetedOption')}
                </option>
                {availableBudgetLines.map((b) => (
                  <option key={b.budgetLineId} value={b.budgetLineId}>
                    {b.description ?? ''} ({Number(b.plannedQuantity || 0).toLocaleString()} EA planned @ {formatAmount(Number(b.unitCost || 0), currency)})
                  </option>
                ))}
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
                    <span className="font-mono">
                      {remainingQty.toFixed(1)} EA
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-[var(--border)]/40 text-[11px]">
                    <div>
                      <span className="text-[var(--text-muted)] block">Planned:</span>
                      <span className="font-mono font-medium">
                        {plannedQty.toFixed(1)} EA
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">Consumed:</span>
                      <span className="font-mono font-medium">
                        {consumedQty.toFixed(1)} EA
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">After entry:</span>
                      <span
                        className={`font-mono font-medium ${
                          projectedRemaining < 0
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : ''
                        }`}
                      >
                        {projectedRemaining >= 0
                          ? `${projectedRemaining.toFixed(1)} EA`
                          : `+${Math.abs(projectedRemaining).toFixed(1)} EA over`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity & Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="material-quantity" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.quantity')} <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  id="material-quantity"
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  className="input w-full text-xs font-mono"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                {isExceeded && (
                  <p className="text-[11px] text-[var(--danger)] mt-1">
                    {t('errors.quantityExceedsAvailable', { max: currentAvailable })}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="material-discount" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  Discount %
                </label>
                <input
                  id="material-discount"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  className="input w-full text-xs font-mono"
                  value={discountPercentageState}
                  onChange={(e) => setDiscountPercentageState(e.target.value)}
                />
              </div>
            </div>

            {/* Memo / Notes */}
            <div>
              <label htmlFor="material-memo" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('labels.reference')}
              </label>
              <input
                id="material-memo"
                type="text"
                className="input w-full text-xs"
                placeholder={t('placeholders.reference')}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>
        )}
      </form>
    </SlideOver>
  );
}
