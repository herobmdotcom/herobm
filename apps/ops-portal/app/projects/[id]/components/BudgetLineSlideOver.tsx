'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { PROJECT_LINE_TYPE, ProjectLineType, PROJECT_TASK_STATE, computeLinePrice } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import ProductSelect, { Product as ProductOption } from '@/components/shared/ProductSelect';

export interface BudgetLineSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  line?: api.ProjectBudgetLineResponseDto | null;
  tasks: api.ProjectTaskResponseDto[];
  currency: string;
  defaultTaskId?: string;
  discountPercentage?: number;
  onSubmit: (dto: api.CreateProjectBudgetLineDto, lineId?: string) => Promise<void>;
}

export function BudgetLineSlideOver({
  isOpen,
  onClose,
  line,
  tasks,
  currency,
  defaultTaskId,
  discountPercentage = 0,
  onSubmit,
}: BudgetLineSlideOverProps) {
  const isEdit = Boolean(line);
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [submitting, setSubmitting] = useState(false);
  const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string>('');

  const [form, setForm] = useState({
    projectTaskId: '',
    lineType: PROJECT_LINE_TYPE.ITEM as ProjectLineType,
    description: '',
    plannedQuantity: '1',
    uom: 'EA',
    unitCost: '0',
    unitPrice: '0',
    discountPercentage: discountPercentage ? String(discountPercentage) : '',
    resourceId: '',
    productId: '',
  });

  // Reset or populate form when opened
  useEffect(() => {
    if (isOpen) {
      if (line) {
        const lineType = (line.lineType as ProjectLineType) || PROJECT_LINE_TYPE.ITEM;
        const defaultUom = lineType === PROJECT_LINE_TYPE.RESOURCE ? 'HR' : 'EA';
        setForm({
          projectTaskId: line.projectTaskId || (tasks.length > 0 ? tasks[0].projectTaskId : ''),
          lineType,
          description: line.description || '',
          plannedQuantity: String(line.plannedQuantity ?? '1'),
          uom: defaultUom,
          unitCost: String(line.unitCost ?? '0'),
          unitPrice: String(line.unitPrice ?? '0'),
          discountPercentage: line.discountPercentage ? String(line.discountPercentage) : '',
          resourceId: line.resourceId || '',
          productId: line.productId || '',
        });
      } else {
        const activeTasks = tasks.filter((tk) => tk.stateCode !== PROJECT_TASK_STATE.COMPLETED);
        const initialTaskId =
          (lastSelectedTaskId && activeTasks.some((tk) => tk.projectTaskId === lastSelectedTaskId) && lastSelectedTaskId) ||
          (defaultTaskId && activeTasks.some((tk) => tk.projectTaskId === defaultTaskId) && defaultTaskId) ||
          (activeTasks.length > 0 ? activeTasks[0].projectTaskId : tasks.length > 0 ? tasks[0].projectTaskId : '');

        if (initialTaskId && !lastSelectedTaskId) {
          setLastSelectedTaskId(initialTaskId);
        }

        setForm({
          projectTaskId: initialTaskId,
          lineType: PROJECT_LINE_TYPE.ITEM as ProjectLineType,
          description: '',
          plannedQuantity: '1',
          uom: 'EA',
          unitCost: '0',
          unitPrice: '0',
          discountPercentage: discountPercentage ? String(discountPercentage) : '',
          resourceId: '',
          productId: '',
        });
      }
      setSubmitting(false);
    }
  }, [isOpen, line, defaultTaskId, tasks, lastSelectedTaskId, discountPercentage]);

  const handleProductSelect = (product: ProductOption | null) => {
    if (product) {
      setForm((p) => ({
        ...p,
        productId: product.productId,
        resourceId: '',
        description: product.name || p.description,
        uom: product.baseUom || (p.lineType === PROJECT_LINE_TYPE.RESOURCE ? 'HR' : 'EA'),
        unitCost: product.standardCost != null ? String(product.standardCost) : p.unitCost,
        unitPrice: product.listPrice != null ? String(product.listPrice) : p.unitPrice,
      }));
    } else {
      setForm((p) => ({
        ...p,
        productId: '',
      }));
    }
  };

  // Live financial calculation
  const { totalPlannedCost, totalPlannedRevenue, marginPercent } = useMemo(() => {
    const qty = parseFloat(form.plannedQuantity) || 0;
    const cost = parseFloat(form.unitCost) || 0;
    const price = parseFloat(form.unitPrice) || 0;
    const disc = form.discountPercentage !== '' ? (parseFloat(form.discountPercentage) || 0) : (discountPercentage || 0);
    const totalCost = qty * cost;
    const pricing = computeLinePrice({
      quantity: qty,
      pricePerUnit: price,
      discountPercentage: disc,
      taxRate: 0,
    });
    const totalRev = pricing.amount;
    const margin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
    return {
      totalPlannedCost: totalCost,
      totalPlannedRevenue: totalRev,
      marginPercent: margin,
    };
  }, [form.plannedQuantity, form.unitCost, form.unitPrice, form.discountPercentage, discountPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.projectTaskId) {
      toast.error(t('errors.selectTask') || 'Target task is required');
      return;
    }

    const qty = parseFloat(form.plannedQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('errors.invalidQuantity') || 'Planned quantity must be greater than 0');
      return;
    }

    const cost = parseFloat(form.unitCost) || 0;
    const price = parseFloat(form.unitPrice) || 0;

    setSubmitting(true);
    try {
      const payload: api.CreateProjectBudgetLineDto = {
        projectTaskId: form.projectTaskId,
        lineType: form.lineType,
        description: form.description.trim() || undefined,
        plannedQuantity: qty,
        unitCost: cost,
        unitPrice: price,
        discountPercentage: form.discountPercentage !== '' ? parseFloat(form.discountPercentage) : (discountPercentage !== undefined ? discountPercentage : undefined),
        resourceId: form.resourceId || undefined,
        productId: form.productId || undefined,
      };

      if (line?.budgetLineId) {
        await onSubmit(payload, line.budgetLineId);
      } else {
        await onSubmit(payload);
      }
      if (!isEdit) {
        setLastSelectedTaskId(form.projectTaskId);
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
      title={isEdit ? t('editBudgetLineTitle') : t('createBudgetLineTitle')}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="budget-line-form"
            variant="primary"
            loading={submitting}
            disabled={submitting || !form.projectTaskId}
          >
            {submitting
              ? t('buttons.saving')
              : isEdit
              ? t('buttons.saveChanges')
              : t('buttons.addBudgetLine')}
          </Button>
        </div>
      }
    >
      <form id="budget-line-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        {/* Target Task */}
        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.task')} <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            required
            className="input w-full text-xs"
            value={form.projectTaskId}
            onChange={(e) => {
              const selectedId = e.target.value;
              if (!isEdit) setLastSelectedTaskId(selectedId);
              setForm((p) => ({ ...p, projectTaskId: selectedId }));
            }}
          >
            <option value="">{t('placeholders.selectTaskPlaceholder')}</option>
            {tasks.map((tk) => {
              const isCompleted = tk.stateCode === PROJECT_TASK_STATE.COMPLETED;
              const completedTag = isCompleted ? ` (${tCommon('states.completed')})` : '';
              return (
                <option
                  key={tk.projectTaskId}
                  value={tk.projectTaskId}
                  disabled={!isEdit && isCompleted}
                >
                  {tk.taskCode ? `${tk.taskCode} — ` : ''}{tk.name}{completedTag}
                </option>
              );
            })}
          </select>
        </div>

        {/* Line Type and Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.lineType')} <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              className="input w-full text-xs"
              value={form.lineType}
              onChange={(e) => {
                const nextType = e.target.value as ProjectLineType;
                setForm((p) => ({
                  ...p,
                  lineType: nextType,
                  uom: nextType === PROJECT_LINE_TYPE.RESOURCE ? 'HR' : 'EA',
                  resourceId: '',
                  productId: '',
                }));
              }}
            >
              <option value={PROJECT_LINE_TYPE.ITEM}>Material</option>
              <option value={PROJECT_LINE_TYPE.RESOURCE}>Service</option>
              <option value={PROJECT_LINE_TYPE.EXPENSE}>Expense</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.description')}
            </label>
            <input
              type="text"
              className="input w-full text-xs"
              placeholder={t('placeholders.budgetDescription')}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>

        {/* Product Search-Select filtered by line type */}
        {form.lineType === PROJECT_LINE_TYPE.ITEM && (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.prefillProduct')}
            </label>
            <ProductSelect
              key="material-product-select"
              value={form.productId || null}
              onChange={handleProductSelect}
              productType="inventory,non-stock"
              placeholder={t('placeholders.selectProductSku')}
              className="w-full text-xs"
            />
          </div>
        )}

        {form.lineType === PROJECT_LINE_TYPE.RESOURCE && (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.prefillService')}
            </label>
            <ProductSelect
              key="service-product-select"
              value={form.productId || null}
              onChange={handleProductSelect}
              productType="service"
              placeholder={t('placeholders.selectRateCard') || t('placeholders.selectServiceRateCard')}
              className="w-full text-xs"
            />
          </div>
        )}

        {form.lineType === PROJECT_LINE_TYPE.EXPENSE && (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.prefillProduct')}
            </label>
            <ProductSelect
              key="expense-product-select"
              value={form.productId || null}
              onChange={handleProductSelect}
              productType="non-stock,service"
              placeholder={t('placeholders.selectProductSku')}
              className="w-full text-xs"
            />
          </div>
        )}

        {/* Quantities & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.quantity')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              required
              className="input w-full text-xs"
              value={form.plannedQuantity}
              onChange={(e) => setForm((p) => ({ ...p, plannedQuantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.uom')}
            </label>
            <input
              type="text"
              className="input w-full text-xs uppercase"
              placeholder="e.g. HR, EA"
              value={form.uom}
              onChange={(e) => setForm((p) => ({ ...p, uom: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.unitCost')}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              className="input w-full text-xs"
              value={form.unitCost}
              onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('columns.unitPrice')}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              className="input w-full text-xs"
              value={form.unitPrice}
              onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Discount %
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input w-full text-xs"
              placeholder="Inherit"
              value={form.discountPercentage}
              onChange={(e) => setForm((p) => ({ ...p, discountPercentage: e.target.value }))}
            />
          </div>
        </div>

        {/* Live Financial Summary */}
        <div className="pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">
              {t('labels.totalBudgetCost')}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {formatAmount(totalPlannedCost, currency)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">
              {t('labels.totalBudgetRevenue')}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {formatAmount(totalPlannedRevenue, currency)}
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block mb-0.5">
              {t('columns.margin')}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {marginPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}

export const CreateBudgetLineSlideOver = BudgetLineSlideOver;
export const EditBudgetLineSlideOver = BudgetLineSlideOver;
