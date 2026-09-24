'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import Tabs from '@/components/shared/Tabs';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { RESOURCE_TYPE, ResourceType, PROJECT_TASK_STATE, getErrorMessage } from '@herobm/shared';
import ResourceSearchInput from '@/components/shared/ResourceSearchInput';
import type { ProjectResource } from '../useProject';

export interface ConsumeProjectResourceSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  tasks: api.ProjectTaskResponseDto[];
  resources: ProjectResource[];
  assignedResourceIds?: string[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency: string;
  defaultResourceId?: string | null;
  discountPercentage?: number;
  consumeResource: (dto: api.ConsumeResourceDto) => Promise<void>;
  onSuccess: () => Promise<void>;
}

export function ConsumeProjectResourceSlideOver({
  isOpen,
  onClose,
  projectId: _projectId,
  projectNumber,
  tasks = [],
  resources = [],
  assignedResourceIds = [],
  budgetLines = [],
  ledgerEntries = [],
  currency = 'USD',
  defaultResourceId,
  discountPercentage = 0,
  consumeResource,
  onSuccess,
}: ConsumeProjectResourceSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [projectTaskId, setProjectTaskId] = useState('');
  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [unitPrice, setUnitPrice] = useState('0');
  const [discountPercentageState, setDiscountPercentageState] = useState(String(discountPercentage || 0));
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Separate resources into assigned and unassigned pools
  const { assignedPool, unassignedPool } = useMemo(() => {
    const assigned: ProjectResource[] = [];
    const unassigned: ProjectResource[] = [];
    const assignedSet = new Set(assignedResourceIds || []);

    for (const r of resources) {
      if (assignedSet.has(r.resourceId)) {
        assigned.push(r);
      } else {
        if (r.isActive !== false) {
          unassigned.push(r);
        }
      }
    }
    return { assignedPool: assigned, unassignedPool: unassigned };
  }, [resources, assignedResourceIds]);

  // Initialize/reset when opening
  useEffect(() => {
    if (isOpen) {
      if (tasks.length > 0) {
        const initialTask = tasks.find((tk) => tk.stateCode !== PROJECT_TASK_STATE.COMPLETED) || tasks[0];
        setProjectTaskId(initialTask.projectTaskId);
      }
      if (defaultResourceId) {
        const matched = resources.find((r) => r.resourceId === defaultResourceId) || null;
        setSelectedResource(matched);
        setUnitCost(String(matched?.directUnitCost ?? '0'));
        setUnitPrice(String(matched?.unitPrice ?? '0'));
      } else {
        setSelectedResource(null);
        setUnitCost('0');
        setUnitPrice('0');
      }
      setSelectedTypeFilter('all');
      setSearchQuery('');
      setSelectedBudgetLineId('');
      setQuantity('1');
      setDiscountPercentageState(String(discountPercentage || 0));
      setPostingDate(new Date().toISOString().slice(0, 10));
      setDescription('');
    }
  }, [isOpen, tasks, defaultResourceId, resources, discountPercentage]);

  // Filter assigned resources by Type and Search Query
  const filteredAssignedResources = useMemo(() => {
    let list = assignedPool;
    if (selectedTypeFilter !== 'all') {
      list = list.filter((r) => r.resourceType === selectedTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.resourceCode && r.resourceCode.toLowerCase().includes(q))
      );
    }
    return list;
  }, [assignedPool, selectedTypeFilter, searchQuery]);

  const isSelectedResourceUnassigned = useMemo(() => {
    if (!selectedResource) return false;
    const assignedSet = new Set(assignedResourceIds || []);
    return !assignedSet.has(selectedResource.resourceId);
  }, [selectedResource, assignedResourceIds]);

  const handleSelectResource = (res: ProjectResource) => {
    setSelectedResource(res);
    setUnitCost(String(res.directUnitCost ?? '0'));
    setUnitPrice(String(res.unitPrice ?? '0'));
  };

  const formatResourceType = (type: string) => {
    switch (type) {
      case RESOURCE_TYPE.PERSON:
        return t('resources.typePerson');
      case RESOURCE_TYPE.CONTRACTOR:
        return t('resources.typeContractor');
      case RESOURCE_TYPE.EQUIPMENT:
        return t('resources.typeEquipment');
      default:
        return type;
    }
  };

  const availableBudgetLines = useMemo(() => {
    if (!projectTaskId) return [];
    return (budgetLines || []).filter(
      (b) => b.projectTaskId === projectTaskId && (b.lineType === 'resource' || b.lineType === 'expense'),
    );
  }, [budgetLines, projectTaskId]);

  // Auto-select matching budget line on task or resource change
  useEffect(() => {
    if (!selectedResource || !projectTaskId) {
      setSelectedBudgetLineId('');
      return;
    }
    const exactMatch = (budgetLines || []).find(
      (b) => b.projectTaskId === projectTaskId && b.resourceId === selectedResource.resourceId,
    );
    if (exactMatch) {
      setSelectedBudgetLineId(exactMatch.budgetLineId);
      return;
    }
    const productMatch = (budgetLines || []).find(
      (b) =>
        b.projectTaskId === projectTaskId &&
        (selectedResource as { serviceProductId?: string }).serviceProductId &&
        b.productId === (selectedResource as { serviceProductId?: string }).serviceProductId,
    );
    if (productMatch) {
      setSelectedBudgetLineId(productMatch.budgetLineId);
      return;
    }
    const firstResourceLine = (budgetLines || []).find(
      (b) => b.projectTaskId === projectTaskId && b.lineType === 'resource',
    );
    if (firstResourceLine) {
      setSelectedBudgetLineId(firstResourceLine.budgetLineId);
      return;
    }
    setSelectedBudgetLineId('__unbudgeted__');
  }, [selectedResource, projectTaskId, budgetLines]);

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

  const currentUom = selectedResource?.baseUom || 'Hours';

  const { plannedQty, consumedQty, remainingQty, projectedRemaining, isOverBudget } = useMemo(() => {
    if (!activeBudgetLine) {
      return { plannedQty: 0, consumedQty: 0, remainingQty: 0, projectedRemaining: 0, isOverBudget: false };
    }
    const planned = parseFloat(activeBudgetLine.plannedQuantity || '0');
    const consumed = (ledgerEntries || [])
      .filter((l) => {
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
  }, [activeBudgetLine, ledgerEntries, quantity]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!projectTaskId) {
      toast.error(t('errors.selectTask') || 'Please select a target WBS task.');
      return;
    }
    if (!selectedResource) {
      toast.error('Please select a resource profile.');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('errors.quantityMustBePositive') || 'Quantity must be greater than 0.');
      return;
    }

    setLoading(true);
    try {
      await consumeResource({
        projectTaskId,
        resourceId: selectedResource.resourceId,
        budgetLineId:
          selectedBudgetLineId && selectedBudgetLineId !== '__unbudgeted__'
            ? selectedBudgetLineId
            : undefined,
        quantity: qty,
        unitCost: parseFloat(unitCost) || 0,
        unitPrice: parseFloat(unitPrice) || 0,
        discountPercentage: discountPercentageState !== '' ? parseFloat(discountPercentageState) : (discountPercentage || 0),
        postingDate: postingDate ? new Date(postingDate).toISOString() : undefined,
        description:
          description.trim() ||
          `Resource usage: ${selectedResource.name} on ${projectNumber || 'Project'}`,
      });

      toast.success(t('toasts.resourceConsumed') || 'Resource usage recorded successfully');
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to record resource usage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('buttons.consumeResource')}
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
            disabled={loading || !selectedResource || !projectTaskId}
            onClick={handleSubmit}
          >
            {loading ? t('buttons.saving') : t('buttons.consumeResource')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Target Task */}
        <div>
          <label htmlFor="resource-target-task" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.task')} <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            id="resource-target-task"
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

        {/* Resource Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              {t('resources.assignedResourcesTitle')} <span className="text-[var(--danger)]">*</span>
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              {assignedPool.length} {t('resources.filterActive').toLowerCase()}
            </span>
          </div>

          <Tabs
            tabs={[
              { id: 'all', label: t('resources.filterAllTypes') },
              { id: RESOURCE_TYPE.PERSON, label: t('resources.typePerson') },
              { id: RESOURCE_TYPE.CONTRACTOR, label: t('resources.typeContractor') },
              { id: RESOURCE_TYPE.EQUIPMENT, label: t('resources.typeEquipment') },
            ]}
            activeTab={selectedTypeFilter}
            onChange={(tabId) => setSelectedTypeFilter(tabId as 'all' | ResourceType)}
            size="sm"
          />

          {/* Search Box for Assigned Resources (shown when > 3 assigned) */}
          {assignedPool.length > 3 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none">
                search
              </span>
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors"
                placeholder={t('placeholders.searchResources')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Assigned Resources Card List */}
          <div className="max-h-56 overflow-y-auto space-y-2 border border-[var(--border)] p-2 rounded-lg">
            {filteredAssignedResources.length === 0 ? (
              <div className="text-center py-5 text-xs text-[var(--text-muted)]">
                {assignedPool.length === 0
                  ? t('resources.noAssignedResources')
                  : t('resources.noAssignedResourcesFound')}
              </div>
            ) : (
              filteredAssignedResources.map((res) => {
                const isSelected = selectedResource?.resourceId === res.resourceId;
                return (
                  <LinkedEntityCard
                    key={res.resourceId}
                    icon={
                      res.resourceType === RESOURCE_TYPE.PERSON
                        ? 'person'
                        : res.resourceType === RESOURCE_TYPE.CONTRACTOR
                        ? 'engineering'
                        : 'precision_manufacturing'
                    }
                    title={res.name}
                    subtitle={[
                      res.resourceCode || null,
                      (res as { serviceProduct?: { name?: string } }).serviceProduct?.name || null,
                      res.baseUom ? `${res.baseUom}` : null,
                    ]}
                    amount={
                      <span className="font-mono text-xs font-normal text-[var(--text-primary)]">
                        Bill: {formatAmount(Number(res.unitPrice || 0), currency)}
                      </span>
                    }
                    amountSubtext={
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        Cost: {formatAmount(Number(res.directUnitCost || 0), currency)}
                      </span>
                    }
                    status={
                      <span className="badge badge-secondary text-[10px] uppercase font-medium">
                        {formatResourceType(res.resourceType)}
                      </span>
                    }
                    onClick={() => handleSelectResource(res)}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? '!border-[var(--accent)] !bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]'
                        : 'hover:border-[var(--border-hover)]'
                    }`}
                  />
                );
              })
            )}
          </div>

          {/* Unassigned Resource Search Select */}
          {unassignedPool.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                {t('resources.selectUnassignedPrompt')}
              </label>
              <ResourceSearchInput
                onSelect={(res) => handleSelectResource(res)}
                placeholder={t('resources.selectUnassignedPlaceholder')}
                excludeResourceIds={assignedResourceIds}
                resources={resources}
                currency={currency}
              />
            </div>
          )}
        </div>

        {/* Selected Resource Details, Budget Allocation & Rates */}
        {selectedResource && (
          <div className="space-y-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {selectedResource.name} ({formatResourceType(selectedResource.resourceType)})
              </h4>
              {isSelectedResourceUnassigned && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedResource(null)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors h-auto p-0"
                >
                  {tCommon('clear')}
                </Button>
              )}
            </div>

            {/* Budget Allocation Selector */}
            <div>
              <label htmlFor="resource-budget-line" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.budgetAllocation')}
              </label>
              <select
                id="resource-budget-line"
                className="input w-full text-xs"
                value={selectedBudgetLineId}
                onChange={(e) => setSelectedBudgetLineId(e.target.value)}
              >
                <option value="__unbudgeted__">
                  {t('labels.unbudgetedOption')}
                </option>
                {availableBudgetLines.map((b) => {
                  const uom = b.lineType === 'resource' ? 'HR' : 'EA';
                  const qty = Number(b.plannedQuantity || 0).toLocaleString();
                  const cost = formatAmount(Number(b.unitCost || 0), currency);
                  const label = `${b.description ?? ''} (${qty} ${uom} planned @ ${cost})`;
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
                      <span className="text-[var(--text-muted)] block">After entry:</span>
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

            {/* Row 1: Date & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="resource-consume-date" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.date')}
                </label>
                <input
                  id="resource-consume-date"
                  type="date"
                  className="input w-full text-xs"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="resource-consume-desc" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.description')}
                </label>
                <input
                  id="resource-consume-desc"
                  type="text"
                  className="input w-full text-xs"
                  placeholder={t('placeholders.budgetDescription')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Quantity (UOM), Unit Cost, Unit Price, Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor="resource-consume-qty" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.quantity')} <span className="font-normal text-[var(--text-muted)]">({currentUom})</span> <span className="text-[var(--danger)]">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="resource-consume-qty"
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    className="input w-full pr-14 text-xs"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <span className="absolute right-3 text-xs text-[var(--text-muted)] font-medium pointer-events-none select-none">
                    {currentUom}
                  </span>
                </div>
                {activeBudgetLine && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {t('labels.budget')}: <span className="font-mono font-medium">{Number(activeBudgetLine.plannedQuantity || 0)} {currentUom}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="resource-consume-cost" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.unitCost')}
                </label>
                <input
                  id="resource-consume-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input w-full text-xs"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
                {activeBudgetLine && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {t('labels.budget')}: <span className="font-mono font-medium">{formatAmount(Number(activeBudgetLine.unitCost || 0), currency)}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="resource-consume-price" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  {t('columns.unitPrice')}
                </label>
                <input
                  id="resource-consume-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input w-full text-xs"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
                {activeBudgetLine && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {t('labels.budget')}: <span className="font-mono font-medium">{formatAmount(Number(activeBudgetLine.unitPrice || 0), currency)}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="resource-discount-percentage" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  Discount %
                </label>
                <input
                  id="resource-discount-percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="input w-full text-xs"
                  placeholder="Inherit"
                  value={discountPercentageState}
                  onChange={(e) => setDiscountPercentageState(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </SlideOver>
  );
}
