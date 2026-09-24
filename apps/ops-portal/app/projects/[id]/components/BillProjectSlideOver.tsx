'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import Tabs, { TabItem } from '@/components/shared/Tabs';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { getErrorMessage, PROJECT_BILLING_TYPE, PROJECT_LINE_TYPE, computeLinePrice, getTaxLabel } from '@herobm/shared';
import { toast } from 'react-hot-toast';

export type BillingMode = 'time_and_materials' | 'cost_plus' | 'milestone' | 'fixed_price';

export interface EditableInvoiceLine {
  id: string;
  projectTaskId: string;
  projectLedgerEntryId?: string;
  productId?: string;
  description: string;
  quantity: number;
  pricePerUnit: number;
  discountPercentage: number;
  taxCategoryId?: string;
  amount: number;
}

export interface BillProjectSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  projectName?: string;
  currency?: string;
  projectBillingType?: string;
  customerPaymentTerms?: string;
  tasks?: api.ProjectTaskResponseDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  unbilledEntries?: api.ProjectLedgerEntryResponseDto[];
  discountPercentage?: number;
  defaultBillingMode?: BillingMode;
  billProject?: (dto: api.BillProjectDto) => Promise<api.ProjectBillingResponseDto | unknown>;
  onSuccess?: () => Promise<void>;
}

export function formatBillingType(type?: string): string {
  if (!type) return '';
  const lower = type.toLowerCase();
  if (lower === 'time_and_materials' || lower === PROJECT_BILLING_TYPE.TIME_AND_MATERIALS) {
    return 'Time & Materials';
  }
  if (lower === 'cost_plus' || lower === PROJECT_BILLING_TYPE.COST_PLUS) {
    return 'Cost Plus';
  }
  if (lower === 'milestone' || lower === PROJECT_BILLING_TYPE.MILESTONE) {
    return 'Milestone';
  }
  if (lower === 'fixed_price' || lower === PROJECT_BILLING_TYPE.FIXED_PRICE) {
    return 'Fixed Price';
  }
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLineType(lineType?: string): string {
  if (!lineType) return '';
  const raw = lineType.toLowerCase();
  if (raw === PROJECT_LINE_TYPE.ITEM || raw === 'item') return 'Material';
  if (raw === PROJECT_LINE_TYPE.RESOURCE || raw === 'resource') return 'Labor';
  if (raw === PROJECT_LINE_TYPE.EXPENSE || raw === 'expense') return 'Expense';
  return lineType.charAt(0).toUpperCase() + lineType.slice(1).toLowerCase();
}

function computeLineNetAmount(qty: number, unitPrice: number, discountPercentage: number): number {
  return computeLinePrice({
    quantity: qty,
    pricePerUnit: unitPrice,
    discountPercentage,
  }).amount;
}

export function BillProjectSlideOver({
  isOpen,
  onClose,
  projectId: _projectId,
  projectNumber,
  projectName,
  currency = 'USD',
  projectBillingType,
  customerPaymentTerms,
  tasks = [],
  budgetLines = [],
  unbilledEntries = [],
  discountPercentage = 0,
  defaultBillingMode,
  billProject,
  onSuccess,
}: BillProjectSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  // Resolve initial mode from projectBillingType or defaultBillingMode
  const initialMode: BillingMode = useMemo(() => {
    if (projectBillingType) {
      if (projectBillingType === PROJECT_BILLING_TYPE.COST_PLUS || projectBillingType === 'cost_plus') {
        return 'cost_plus';
      }
      if (projectBillingType === PROJECT_BILLING_TYPE.MILESTONE || projectBillingType === 'milestone') {
        return 'milestone';
      }
      if (projectBillingType === PROJECT_BILLING_TYPE.FIXED_PRICE || projectBillingType === 'fixed_price') {
        return 'fixed_price';
      }
      return 'time_and_materials';
    }
    return defaultBillingMode || 'time_and_materials';
  }, [projectBillingType, defaultBillingMode]);

  const [billingMode, setBillingMode] = useState<BillingMode>(initialMode);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [selectedTaxCategoryId, setSelectedTaxCategoryId] = useState<string>('');
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Source selection states
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [markupPercent, setMarkupPercent] = useState<string>('15');
  const [selectedCostPlusEntryIds, setSelectedCostPlusEntryIds] = useState<Set<string>>(new Set());

  // Fixed Price / Progress Mode state
  const [progressTaskId, setProgressTaskId] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<string>('20');
  const [progressDescription, setProgressDescription] = useState<string>('');
  const [progressAmount, setProgressAmount] = useState<string>('0');

  // Editable Output Invoice Lines
  const [invoiceLines, setInvoiceLines] = useState<EditableInvoiceLine[]>([]);

  // Load Tax Categories
  useEffect(() => {
    if (!isOpen) return;
    api.taxCategoriesControllerFindAll()
      .then((res) => {
        const raw = res.data as unknown;
        const list = (Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data || []) as api.TaxCategoryResponseDto[];
        const normalized = list.map((tc) => ({
          ...tc,
          taxCategoryId: tc.taxCategoryId || (tc as unknown as { id?: string }).id || '',
          rate: tc.rate ?? (tc as unknown as { taxRate?: string }).taxRate ?? '0',
        }));
        setTaxCategories(normalized);
      })
      .catch(() => {
        setTaxCategories([]);
      });
  }, [isOpen]);

  // Clean eligible unbilled entries (exclude staging putaway lines & non-billable lines)
  const eligibleUnbilledEntries = useMemo(() => {
    return unbilledEntries.filter((e) => {
      if (e.isBilled || e.isBillable === false) return false;
      const desc = (e.description || '').toLowerCase();
      if (desc.startsWith('staged ') || desc.startsWith('reallocated from staging')) {
        return false;
      }
      return true;
    });
  }, [unbilledEntries]);

  // Total project budget revenue
  const totalBudgetRevenue = useMemo(() => {
    return budgetLines.reduce((sum, b) => {
      const price = Number(b.totalPrice ?? 0) || Number(b.plannedQuantity ?? 0) * Number(b.unitPrice ?? 0);
      return sum + price;
    }, 0);
  }, [budgetLines]);

  // Group unbilled entries by task for source checklists and guarantee consistent ordering
  const unbilledTaskGroups = useMemo(() => {
    const map = new Map<string, { task?: api.ProjectTaskResponseDto; entries: api.ProjectLedgerEntryResponseDto[] }>();

    for (const entry of eligibleUnbilledEntries) {
      const taskId = entry.projectTaskId || '__unassigned__';
      if (!map.has(taskId)) {
        const task = tasks.find((t) => t.projectTaskId === entry.projectTaskId);
        map.set(taskId, { task, entries: [] });
      }
      map.get(taskId)!.entries.push(entry);
    }

    return Array.from(map.entries()).map(([key, group]) => ({
      key,
      task: group.task,
      taskName: group.task ? (group.task.taskCode ? `${group.task.taskCode} - ${group.task.name}` : group.task.name) : 'General / Unassigned',
      entries: group.entries,
    }));
  }, [eligibleUnbilledEntries, tasks]);

  // Flattened entries in the exact visual sequence of the selection table above
  const orderedSelectionEntries = useMemo(() => {
    return unbilledTaskGroups.flatMap((group) => group.entries);
  }, [unbilledTaskGroups]);

  const prevOpenRef = useRef(false);

  // Sync / Build lines for Time & Materials mode
  const buildTMLines = useCallback(
    (selectedIds: Set<string>, existingLines: EditableInvoiceLine[] = [], fallbackTaxCat?: string): EditableInvoiceLine[] => {
      const existingMap = new Map(existingLines.map((l) => [l.projectLedgerEntryId || l.id, l]));
      const selected = orderedSelectionEntries.filter((e) => selectedIds.has(e.ledgerId));

      const mappedLines: EditableInvoiceLine[] = selected.map((entry) => {
        const existing = existingMap.get(entry.ledgerId);
        if (existing) {
          return existing;
        }

        const qty = parseFloat(String(entry.quantity || 1)) || 1;
        const unitPrice = parseFloat(String(entry.unitPriceBase || 0)) || 0;
        const entryDisc = entry.discountPercentage != null && entry.discountPercentage !== ''
          ? parseFloat(String(entry.discountPercentage))
          : (parseFloat(String(discountPercentage || 0)) || 0);
        const lineDisc = isNaN(entryDisc) ? (parseFloat(String(discountPercentage || 0)) || 0) : entryDisc;
        const amt = computeLineNetAmount(qty, unitPrice, lineDisc);

        const prodId = entry.productId || (entry as unknown as { resource?: { serviceProductId?: string } }).resource?.serviceProductId || undefined;
        return {
          id: `line-${entry.ledgerId}`,
          projectTaskId: entry.projectTaskId || (tasks[0]?.projectTaskId ?? ''),
          projectLedgerEntryId: entry.ledgerId,
          productId: prodId,
          description: entry.description || 'Project WIP Actual',
          quantity: qty,
          pricePerUnit: unitPrice,
          discountPercentage: lineDisc,
          taxCategoryId: fallbackTaxCat || undefined,
          amount: amt,
        };
      });

      // Preserve any custom lines (lines not tied to a project ledger entry)
      const customLines = existingLines.filter((l) => !l.projectLedgerEntryId);
      return [...mappedLines, ...customLines];
    },
    [orderedSelectionEntries, tasks, discountPercentage]
  );

  // Sync / Build lines for Cost Plus mode
  const buildCostPlusLines = useCallback(
    (selectedIds: Set<string>, markupStr: string, existingLines: EditableInvoiceLine[] = [], fallbackTaxCat?: string): EditableInvoiceLine[] => {
      const existingMap = new Map(existingLines.map((l) => [l.projectLedgerEntryId || l.id, l]));
      const markupNum = parseFloat(markupStr) || 0;
      const multiplier = 1 + markupNum / 100;
      const selected = orderedSelectionEntries.filter((e) => selectedIds.has(e.ledgerId));

      const mappedLines: EditableInvoiceLine[] = selected.map((entry) => {
        const qty = parseFloat(String(entry.quantity || 1)) || 1;
        const unitCost = parseFloat(String(entry.unitCostBase || 0)) || 0;
        const markedUpUnitPrice = Math.round(unitCost * multiplier * 100) / 100;

        const existing = existingMap.get(entry.ledgerId);
        if (existing) {
          const disc = existing.discountPercentage || 0;
          return {
            ...existing,
            pricePerUnit: markedUpUnitPrice,
            amount: computeLineNetAmount(existing.quantity, markedUpUnitPrice, disc),
          };
        }

        const entryDisc = entry.discountPercentage != null && entry.discountPercentage !== ''
          ? parseFloat(String(entry.discountPercentage))
          : (parseFloat(String(discountPercentage || 0)) || 0);
        const lineDisc = isNaN(entryDisc) ? (parseFloat(String(discountPercentage || 0)) || 0) : entryDisc;
        const amt = computeLineNetAmount(qty, markedUpUnitPrice, lineDisc);

        const prodId = entry.productId || (entry as unknown as { resource?: { serviceProductId?: string } }).resource?.serviceProductId || undefined;
        return {
          id: `line-cp-${entry.ledgerId}`,
          projectTaskId: entry.projectTaskId || (tasks[0]?.projectTaskId ?? ''),
          projectLedgerEntryId: entry.ledgerId,
          productId: prodId,
          description: `${entry.description || 'Actual Cost'} (+${markupNum}% Markup)`,
          quantity: qty,
          pricePerUnit: markedUpUnitPrice,
          discountPercentage: lineDisc,
          taxCategoryId: fallbackTaxCat || undefined,
          amount: amt,
        };
      });

      // Preserve any custom lines (lines not tied to a project ledger entry)
      const customLines = existingLines.filter((l) => !l.projectLedgerEntryId);
      return [...mappedLines, ...customLines];
    },
    [orderedSelectionEntries, tasks, discountPercentage]
  );

  // Reset/initialize on open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setBillingMode(initialMode);
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setSelectedTaxCategoryId('');
      setLoading(false);

      const allIds = new Set(eligibleUnbilledEntries.map((e) => e.ledgerId));
      setSelectedEntryIds(allIds);
      setSelectedCostPlusEntryIds(allIds);
      setMarkupPercent('15');

      const initTaskId = tasks.length > 0 ? tasks[0].projectTaskId : '';
      const firstTask = tasks[0];
      const taskName = firstTask ? (firstTask.taskCode ? `${firstTask.taskCode} - ${firstTask.name}` : firstTask.name) : 'Milestone Delivery';

      setProgressTaskId(initTaskId);
      setProgressPercent('20');
      setProgressDescription(`Progress Billing (20% of Project Total)`);
      const initialProgressAmt = (totalBudgetRevenue * 0.2).toFixed(2);
      setProgressAmount(initialProgressAmt);

      if (initialMode === 'cost_plus') {
        setInvoiceLines(buildCostPlusLines(allIds, '15'));
      } else if (initialMode === 'milestone') {
        const discount = parseFloat(String(discountPercentage || 0)) || 0;
        setInvoiceLines([
          {
            id: 'line-m1',
            projectTaskId: initTaskId,
            description: `Milestone: ${taskName}`,
            quantity: 1,
            pricePerUnit: 0,
            discountPercentage: discount,
            taxCategoryId: '',
            amount: 0,
          },
        ]);
      } else if (initialMode === 'fixed_price') {
        const pAmt = parseFloat(initialProgressAmt) || 0;
        const discount = parseFloat(String(discountPercentage || 0)) || 0;
        setInvoiceLines([
          {
            id: 'line-prog-1',
            projectTaskId: initTaskId,
            description: `Progress Billing (20% of Project Total)`,
            quantity: 1,
            pricePerUnit: pAmt,
            discountPercentage: discount,
            taxCategoryId: '',
            amount: computeLineNetAmount(1, pAmt, discount),
          },
        ]);
      } else {
        setInvoiceLines(buildTMLines(allIds));
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialMode, eligibleUnbilledEntries, tasks, totalBudgetRevenue, buildTMLines, buildCostPlusLines, discountPercentage]);

  // Handle Mode Change Tab Switching
  const handleModeChange = useCallback(
    (mode: BillingMode) => {
      setBillingMode(mode);
      const initTaskId = tasks.length > 0 ? tasks[0].projectTaskId : '';
      const firstTask = tasks[0];
      const taskName = firstTask ? (firstTask.taskCode ? `${firstTask.taskCode} - ${firstTask.name}` : firstTask.name) : 'Milestone Delivery';

      if (mode === 'time_and_materials') {
        setInvoiceLines((prev) => buildTMLines(selectedEntryIds, prev));
      } else if (mode === 'cost_plus') {
        setInvoiceLines((prev) => buildCostPlusLines(selectedCostPlusEntryIds, markupPercent, prev));
      } else if (mode === 'milestone') {
        const discount = parseFloat(String(discountPercentage || 0)) || 0;
        setInvoiceLines([
          {
            id: `line-m-${Date.now()}`,
            projectTaskId: initTaskId,
            description: `Milestone: ${taskName}`,
            quantity: 1,
            pricePerUnit: 0,
            discountPercentage: discount,
            taxCategoryId: selectedTaxCategoryId || undefined,
            amount: 0,
          },
        ]);
      } else if (mode === 'fixed_price') {
        const numAmt = parseFloat(progressAmount) || 0;
        const discount = parseFloat(String(discountPercentage || 0)) || 0;
        setInvoiceLines([
          {
            id: `line-prog-${Date.now()}`,
            projectTaskId: progressTaskId || initTaskId,
            description: progressDescription || `Progress Billing (${progressPercent}% of Project Total)`,
            quantity: 1,
            pricePerUnit: numAmt,
            discountPercentage: discount,
            taxCategoryId: selectedTaxCategoryId || undefined,
            amount: computeLineNetAmount(1, numAmt, discount),
          },
        ]);
      }
    },
    [
      buildTMLines,
      buildCostPlusLines,
      selectedEntryIds,
      selectedCostPlusEntryIds,
      markupPercent,
      tasks,
      selectedTaxCategoryId,
      progressAmount,
      progressTaskId,
      progressDescription,
      progressPercent,
      discountPercentage,
    ]
  );

  // Handle T&M selection toggles
  const handleToggleTMEntry = useCallback(
    (ledgerId: string) => {
      setSelectedEntryIds((prev) => {
        const next = new Set(prev);
        if (next.has(ledgerId)) {
          next.delete(ledgerId);
        } else {
          next.add(ledgerId);
        }
        setInvoiceLines((curLines) => buildTMLines(next, curLines));
        return next;
      });
    },
    [buildTMLines]
  );

  const handleSelectAllTM = useCallback(() => {
    setSelectedEntryIds((prev) => {
      const next =
        prev.size === eligibleUnbilledEntries.length
          ? new Set<string>()
          : new Set(eligibleUnbilledEntries.map((e) => e.ledgerId));
      setInvoiceLines((curLines) => buildTMLines(next, curLines));
      return next;
    });
  }, [eligibleUnbilledEntries, buildTMLines]);

  // Handle Cost Plus selection toggles
  const handleToggleCostPlusEntry = useCallback(
    (ledgerId: string) => {
      setSelectedCostPlusEntryIds((prev) => {
        const next = new Set(prev);
        if (next.has(ledgerId)) {
          next.delete(ledgerId);
        } else {
          next.add(ledgerId);
        }
        setInvoiceLines((curLines) => buildCostPlusLines(next, markupPercent, curLines));
        return next;
      });
    },
    [buildCostPlusLines, markupPercent]
  );

  const handleSelectAllCostPlus = useCallback(() => {
    setSelectedCostPlusEntryIds((prev) => {
      const next =
        prev.size === eligibleUnbilledEntries.length
          ? new Set<string>()
          : new Set(eligibleUnbilledEntries.map((e) => e.ledgerId));
      setInvoiceLines((curLines) => buildCostPlusLines(next, markupPercent, curLines));
      return next;
    });
  }, [eligibleUnbilledEntries, buildCostPlusLines, markupPercent]);

  // Handle Markup % change in Cost Plus
  const handleMarkupChange = (newMarkup: string) => {
    setMarkupPercent(newMarkup);
    setInvoiceLines((curLines) => buildCostPlusLines(selectedCostPlusEntryIds, newMarkup, curLines));
  };

  // Line Editing Operations
  const handleUpdateLine = (id: string, updates: Partial<EditableInvoiceLine>) => {
    setInvoiceLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...updates };
        const q = Number(next.quantity) || 0;
        const p = Number(next.pricePerUnit) || 0;
        const d = Number(next.discountPercentage) || 0;
        const net = computeLineNetAmount(q, p, d);
        return {
          ...next,
          amount: net,
        };
      })
    );
  };

  const handleRemoveInvoiceLine = (id: string) => {
    setInvoiceLines((prev) => {
      const target = prev.find((l) => l.id === id);
      if (target?.projectLedgerEntryId) {
        setSelectedEntryIds((ids) => {
          const next = new Set(ids);
          next.delete(target.projectLedgerEntryId!);
          return next;
        });
        setSelectedCostPlusEntryIds((ids) => {
          const next = new Set(ids);
          next.delete(target.projectLedgerEntryId!);
          return next;
        });
      }
      return prev.filter((l) => l.id !== id);
    });
  };

  const handleAddCustomLine = () => {
    const initTaskId = tasks[0]?.projectTaskId || '';
    setInvoiceLines((prev) => [
      ...prev,
      {
        id: `custom-line-${Date.now()}`,
        projectTaskId: initTaskId,
        description: 'Project Service Line Item',
        quantity: 1,
        pricePerUnit: 0,
        discountPercentage: 0,
        taxCategoryId: selectedTaxCategoryId || undefined,
        amount: 0,
      },
    ]);
  };

  // Real-time financial totals computed across invoiceLines using centralised computeLinePrice
  const { grossSubtotal, totalDiscount, netSubtotal, totalTax, grandTotal } = useMemo(() => {
    let gross = 0;
    let net = 0;
    let taxSum = 0;

    for (const line of invoiceLines) {
      const q = Number(line.quantity) || 0;
      const p = Number(line.pricePerUnit) || 0;
      const d = Number(line.discountPercentage) || 0;
      const lineGross = q * p;

      const catId = line.taxCategoryId || selectedTaxCategoryId;
      const cat = taxCategories.find((c) => (c.taxCategoryId || (c as unknown as { id?: string }).id) === catId);
      const rawRate = cat?.rate ?? (cat as unknown as { taxRate?: string | number } | undefined)?.taxRate ?? 0;
      const taxRate = parseFloat(String(rawRate)) || 0;

      const pricing = computeLinePrice({
        quantity: q,
        pricePerUnit: p,
        discountPercentage: d,
        taxRate,
      });

      gross += lineGross;
      net += pricing.amount;
      taxSum += pricing.tax;
    }

    const discSum = Math.round((gross - net) * 100) / 100;
    const finalGrand = Math.round((net + taxSum) * 100) / 100;

    return {
      grossSubtotal: Math.round(gross * 100) / 100,
      totalDiscount: discSum,
      netSubtotal: Math.round(net * 100) / 100,
      totalTax: Math.round(taxSum * 100) / 100,
      grandTotal: finalGrand,
    };
  }, [invoiceLines, selectedTaxCategoryId, taxCategories]);

  // Mode Tabs definition (standard Tabs styling)
  const modeTabs: TabItem<BillingMode>[] = useMemo(
    () => [
      {
        id: 'time_and_materials',
        label: 'Time & Materials (WIP)',
        badge: `(${eligibleUnbilledEntries.length})`,
      },
      {
        id: 'cost_plus',
        label: 'Cost Plus',
        badge: `(${eligibleUnbilledEntries.length})`,
      },
      {
        id: 'milestone',
        label: 'Milestone Task',
      },
      {
        id: 'fixed_price',
        label: 'Progress Drawdown',
      },
    ],
    [eligibleUnbilledEntries.length]
  );

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (invoiceLines.length === 0) {
      toast.error('Please select or specify at least one line item to bill.');
      return;
    }

    if (netSubtotal <= 0) {
      toast.error('Invoice total amount must be greater than zero.');
      return;
    }

    const linesToSubmit: api.BillProjectLineDto[] = invoiceLines.map((l) => ({
      projectTaskId: l.projectTaskId || (tasks[0]?.projectTaskId ?? ''),
      description: l.description.trim() || 'Project Service Item',
      quantity: Number(l.quantity) || 1,
      pricePerUnit: Number(l.pricePerUnit) || 0,
      amount: Number(l.amount) || 0,
      discountPercentage: Number(l.discountPercentage) || undefined,
      taxCategoryId: l.taxCategoryId || selectedTaxCategoryId || undefined,
      productId: l.productId || undefined,
      projectLedgerEntryId: l.projectLedgerEntryId,
    }));

    const payload: api.BillProjectDto = {
      invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
      notes: notes.trim() || undefined,
      lines: linesToSubmit,
    };

    setLoading(true);
    try {
      if (billProject) {
        const result = (await billProject(payload)) as api.ProjectBillingResponseDto | undefined;
        if (result?.invoiceNumber) {
          toast.success(`Sales invoice ${result.invoiceNumber} created successfully`);
        } else {
          toast.success('Sales invoice created successfully');
        }
      }
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to create sales invoice');
    } finally {
      setLoading(false);
    }
  };

  const formattedSubtitle = useMemo(() => {
    if (!projectNumber) return undefined;
    const namePart = projectName ? ` — ${projectName}` : '';
    const billingTypePart = projectBillingType ? ` (${formatBillingType(projectBillingType)})` : '';
    return `${projectNumber}${namePart}${billingTypePart}`;
  }, [projectNumber, projectName, projectBillingType]);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('createInvoiceTitle') || 'Create Sales Invoice'}
      subtitle={formattedSubtitle}
      width="max-w-5xl"
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
            disabled={loading || invoiceLines.length === 0 || netSubtotal <= 0}
            onClick={() => handleSubmit()}
          >
            {loading ? t('buttons.creatingInvoice') : t('buttons.createInvoice')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
        {/* Top: Billing Mode Tabs (The very first element in the body) */}
        <Tabs<BillingMode>
          tabs={modeTabs}
          activeTab={billingMode}
          onChange={handleModeChange}
        />

        {/* Invoice Header Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="invoice-date" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('columns.entryDate')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="invoice-date"
              type="date"
              required
              className="input w-full text-sm"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="invoice-tax-category" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              Default Tax Category
            </label>
            <select
              id="invoice-tax-category"
              className="input w-full text-sm"
              value={selectedTaxCategoryId}
              onChange={(e) => {
                const newCat = e.target.value;
                const oldDefault = selectedTaxCategoryId;
                setSelectedTaxCategoryId(newCat);
                setInvoiceLines((prev) =>
                  prev.map((l) =>
                    !l.taxCategoryId || l.taxCategoryId === oldDefault
                      ? { ...l, taxCategoryId: newCat }
                      : l
                  )
                );
              }}
            >
              <option value="">Default / Standard Tax</option>
              {taxCategories.map((tc) => (
                <option key={tc.taxCategoryId} value={tc.taxCategoryId}>
                  {getTaxLabel(tc)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
              {t('labels.paymentTerms')}
            </label>
            <div className="input w-full text-sm flex items-center bg-[var(--bg-secondary)]/50 text-[var(--text-primary)] font-medium truncate">
              {customerPaymentTerms || t('labels.defaultPaymentTerms')}
            </div>
          </div>
        </div>

        {/* Mode 1: Time & Materials WIP Selection */}
        {billingMode === 'time_and_materials' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Unbilled WIP Transactions ({eligibleUnbilledEntries.length})
              </span>
              {eligibleUnbilledEntries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[var(--accent)] hover:underline p-0 h-auto"
                  onClick={handleSelectAllTM}
                >
                  {selectedEntryIds.size === eligibleUnbilledEntries.length
                    ? t('buttons.deselectAll')
                    : t('buttons.selectAll')}
                </Button>
              )}
            </div>

            {eligibleUnbilledEntries.length === 0 ? (
              <div className="p-3 border border-[var(--border)] rounded-lg text-center text-sm text-[var(--text-muted)] bg-[var(--bg-card)]">
                No unbilled WIP transactions found on this project. All actuals are already invoiced.
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)] max-h-56 overflow-y-auto bg-[var(--bg-card)]">
                {unbilledTaskGroups.map((group) => (
                  <div key={group.key}>
                    <div className="px-3 py-1.5 bg-[var(--bg-muted)]/50 font-medium text-xs text-[var(--text-secondary)]">
                      {group.taskName} ({group.entries.length})
                    </div>
                    <div className="divide-y divide-[var(--border)]/40">
                      {group.entries.map((entry) => {
                        const isChecked = selectedEntryIds.has(entry.ledgerId);
                        const qty = parseFloat(String(entry.quantity || 1)) || 1;
                        const price = parseFloat(String(entry.unitPriceBase || 0)) || 0;
                        const entryDisc = entry.discountPercentage != null && entry.discountPercentage !== ''
                          ? parseFloat(String(entry.discountPercentage))
                          : (parseFloat(String(discountPercentage || 0)) || 0);
                        const lineDisc = isNaN(entryDisc) ? (parseFloat(String(discountPercentage || 0)) || 0) : entryDisc;
                        const amt = computeLineNetAmount(qty, price, lineDisc);
                        const entryTitle = entry.description || t('labels.unassignedTask');

                        return (
                          <label
                            key={entry.ledgerId}
                            className={`flex items-start gap-3 p-2.5 text-sm cursor-pointer hover:bg-[var(--bg-muted)]/30 transition-colors ${
                              isChecked ? 'bg-[var(--bg-muted)]/20' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-[var(--border)] text-[var(--accent)] focus:ring-0"
                              checked={isChecked}
                              onChange={() => handleToggleTMEntry(entry.ledgerId)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                                  {entryTitle}
                                </span>
                                <span className="font-semibold text-sm text-[var(--text-primary)] whitespace-nowrap tabular-nums">
                                  {formatAmount(amt, currency)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                                <span>{formatLocalDate(entry.postingDate || entry.createdOn)}</span>
                                <span>•</span>
                                <span>
                                  Qty: {qty} @ {formatAmount(price, currency)}{lineDisc > 0 ? ` (-${lineDisc}%)` : ''}
                                </span>
                                <span>• {formatLineType(entry.lineType)}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Cost Plus Mode Selection */}
        {billingMode === 'cost_plus' && (
          <div className="flex flex-col gap-2">
            <div className="p-3 border border-[var(--border)] rounded-lg bg-[var(--bg-muted)]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] block">
                  Cost Plus Pricing Engine
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  Billed Price = Actual Cost + Markup %
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="cost-plus-markup" className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
                  {t('labels.markupPercentage')}:
                </label>
                <div className="flex items-center gap-1 w-24">
                  <input
                    id="cost-plus-markup"
                    type="number"
                    step="0.5"
                    min="0"
                    max="500"
                    className="input w-full text-sm font-bold text-right py-1 px-2 tabular-nums"
                    value={markupPercent}
                    onChange={(e) => handleMarkupChange(e.target.value)}
                  />
                  <span className="text-sm font-bold text-[var(--text-muted)]">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Unbilled Actual Costs ({eligibleUnbilledEntries.length})
              </span>
              {eligibleUnbilledEntries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[var(--accent)] hover:underline p-0 h-auto"
                  onClick={handleSelectAllCostPlus}
                >
                  {selectedCostPlusEntryIds.size === eligibleUnbilledEntries.length
                    ? t('buttons.deselectAll')
                    : t('buttons.selectAll')}
                </Button>
              )}
            </div>

            {eligibleUnbilledEntries.length === 0 ? (
              <div className="p-3 border border-[var(--border)] rounded-lg text-center text-sm text-[var(--text-muted)] bg-[var(--bg-card)]">
                No unbilled actual costs found on this project. All costs are already invoiced.
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)] max-h-56 overflow-y-auto bg-[var(--bg-card)]">
                {unbilledTaskGroups.map((group) => (
                  <div key={group.key}>
                    <div className="px-3 py-1.5 bg-[var(--bg-muted)]/50 font-medium text-xs text-[var(--text-secondary)]">
                      {group.taskName} ({group.entries.length})
                    </div>
                    <div className="divide-y divide-[var(--border)]/40">
                      {group.entries.map((entry) => {
                        const isChecked = selectedCostPlusEntryIds.has(entry.ledgerId);
                        const qty = parseFloat(String(entry.quantity || 1)) || 1;
                        const unitCost = parseFloat(String(entry.unitCostBase || 0)) || 0;
                        const totalCost = parseFloat(String(entry.totalCostBase || qty * unitCost)) || qty * unitCost;
                        const markupNum = parseFloat(markupPercent) || 0;
                        const markedUpUnitPrice = Math.round(unitCost * (1 + markupNum / 100) * 100) / 100;
                        const markedUpAmt = Math.round(qty * markedUpUnitPrice * 100) / 100;
                        const entryTitle = entry.description || t('labels.unassignedTask');

                        return (
                          <label
                            key={entry.ledgerId}
                            className={`flex items-start gap-3 p-2.5 text-sm cursor-pointer hover:bg-[var(--bg-muted)]/30 transition-colors ${
                              isChecked ? 'bg-[var(--bg-muted)]/20' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-[var(--border)] text-[var(--accent)] focus:ring-0"
                              checked={isChecked}
                              onChange={() => handleToggleCostPlusEntry(entry.ledgerId)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                                  {entryTitle}
                                </span>
                                <div className="text-right">
                                  <span className="font-semibold text-sm text-[var(--text-primary)] whitespace-nowrap block tabular-nums">
                                    {formatAmount(markedUpAmt, currency)}
                                  </span>
                                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                                    Cost: {formatAmount(totalCost, currency)} (+{markupNum}%)
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                                <span>{formatLocalDate(entry.postingDate || entry.createdOn)}</span>
                                <span>•</span>
                                <span>
                                  Qty: {qty} @ Cost {formatAmount(unitCost, currency)} {'→'} Billed {formatAmount(markedUpUnitPrice, currency)}
                                </span>
                                <span>• {formatLineType(entry.lineType)}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode 4: Progress Drawdown Quick Claim Generator */}
        {billingMode === 'fixed_price' && (
          <div className="p-3 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] flex flex-col gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Progress Claim Setup
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  Target Task
                </label>
                <select
                  className="input w-full text-sm"
                  value={progressTaskId}
                  onChange={(e) => {
                    const newTaskId = e.target.value;
                    setProgressTaskId(newTaskId);
                    setInvoiceLines((prev) =>
                      prev.map((l, idx) => (idx === 0 ? { ...l, projectTaskId: newTaskId } : l))
                    );
                  }}
                >
                  <option value="">Select Task...</option>
                  {tasks.map((tk) => (
                    <option key={tk.projectTaskId} value={tk.projectTaskId}>
                      {tk.taskCode ? `${tk.taskCode} — ` : ''}{tk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  Claim Percentage (%)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="100"
                  className="input w-full text-sm tabular-nums"
                  value={progressPercent}
                  onChange={(e) => {
                    const pct = e.target.value;
                    setProgressPercent(pct);
                    const numPct = parseFloat(pct) || 0;
                    const calculated = ((totalBudgetRevenue * numPct) / 100).toFixed(2);
                    setProgressAmount(calculated);
                    const desc = `Progress Billing (${numPct}% of Project Total)`;
                    setProgressDescription(desc);
                    const numAmt = parseFloat(calculated) || 0;
                    setInvoiceLines((prev) =>
                      prev.map((l, idx) =>
                        idx === 0
                          ? {
                              ...l,
                              description: desc,
                              pricePerUnit: numAmt,
                              amount: computeLineNetAmount(1, numAmt, l.discountPercentage),
                            }
                          : l
                      )
                    );
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                  Drawdown Amount ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="input w-full text-sm font-medium tabular-nums"
                  value={progressAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProgressAmount(val);
                    const numAmt = parseFloat(val) || 0;
                    setInvoiceLines((prev) =>
                      prev.map((l, idx) =>
                        idx === 0
                          ? {
                              ...l,
                              pricePerUnit: numAmt,
                              amount: computeLineNetAmount(1, numAmt, l.discountPercentage),
                            }
                          : l
                      )
                    );
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              Project Budget Revenue: {formatAmount(totalBudgetRevenue, currency)}
            </div>
          </div>
        )}

        {/* Section: Editable Invoice Lines Table with Attached Totals Footer */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Invoice Lines ({invoiceLines.length})
            </span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="text-xs"
              onClick={handleAddCustomLine}
            >
              + Add Line
            </Button>
          </div>

          {invoiceLines.length === 0 ? (
            <div className="p-6 border border-[var(--border)] rounded-lg text-center text-sm text-[var(--text-muted)] bg-[var(--bg-card)]">
              No line items selected for billing. Select transactions above or click &quot;+ Add Line&quot;.
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-x-auto bg-[var(--bg-card)]">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/50 text-[var(--text-secondary)] font-medium text-xs">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[150px] max-w-[200px]">Task</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Description</th>
                    <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-24 text-right">Price</th>
                    <th className="py-2.5 px-3 w-20 text-right">{tCommon('columns.discount')}</th>
                    <th className="py-2.5 px-3 w-40">Tax Category</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {invoiceLines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-[var(--bg-muted)]/20 transition-colors">
                      {/* Line Number */}
                      <td className="py-2 px-3 text-center text-[var(--text-muted)] text-xs">
                        {idx + 1}
                      </td>

                      {/* Target Task */}
                      <td className="py-2 px-3">
                        <select
                          className="input w-full text-sm py-1 px-2 truncate"
                          value={line.projectTaskId}
                          onChange={(e) => handleUpdateLine(line.id, { projectTaskId: e.target.value })}
                        >
                          <option value="">General / None</option>
                          {tasks.map((tk) => (
                            <option key={tk.projectTaskId} value={tk.projectTaskId}>
                              {tk.taskCode ? `${tk.taskCode} ` : ''}{tk.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Description */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          className="input w-full text-sm py-1 px-2"
                          value={line.description}
                          onChange={(e) => handleUpdateLine(line.id, { description: e.target.value })}
                          placeholder="Line item description"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          required
                          className="input w-full text-sm py-1 px-2 text-right tabular-nums"
                          value={line.quantity}
                          onChange={(e) =>
                            handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </td>

                      {/* Price Per Unit */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          className="input w-full text-sm py-1 px-2 text-right tabular-nums"
                          value={line.pricePerUnit}
                          onChange={(e) =>
                            handleUpdateLine(line.id, { pricePerUnit: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </td>

                      {/* Discount % */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="input w-full text-sm py-1 px-2 text-right tabular-nums"
                          value={line.discountPercentage || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleUpdateLine(line.id, {
                              discountPercentage: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </td>

                      {/* Tax Category */}
                      <td className="py-2 px-3">
                        <select
                          className="input w-full text-sm py-1 px-2 truncate"
                          value={line.taxCategoryId || ''}
                          onChange={(e) => handleUpdateLine(line.id, { taxCategoryId: e.target.value })}
                        >
                          <option value="">Default Tax</option>
                          {taxCategories.map((tc) => (
                            <option key={tc.taxCategoryId} value={tc.taxCategoryId}>
                              {getTaxLabel(tc)}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-3 text-right font-medium text-sm text-[var(--text-primary)] tabular-nums">
                        {formatAmount(line.amount, currency)}
                      </td>

                      {/* Remove Line Action */}
                      <td className="py-2 px-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="!p-1 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                          title={tCommon('buttons.remove')}
                          onClick={() => handleRemoveInvoiceLine(line.id)}
                        >
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Attached Totals Table Footer */}
                <tfoot className="border-t-2 border-[var(--border)] bg-[var(--bg-muted)]/20 text-sm">
                  <tr>
                    <td colSpan={7} className="py-2 px-3 text-right font-medium text-[var(--text-muted)]">
                      {tCommon('subtotal')}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)] tabular-nums">
                      {formatAmount(grossSubtotal, currency)}
                    </td>
                    <td></td>
                  </tr>

                  {totalDiscount > 0 && (
                    <tr className="text-[var(--danger)]">
                      <td colSpan={7} className="py-1.5 px-3 text-right font-medium">
                        {tCommon('columns.discount')}
                      </td>
                      <td className="py-1.5 px-3 text-right font-medium tabular-nums">
                        -{formatAmount(totalDiscount, currency)}
                      </td>
                      <td></td>
                    </tr>
                  )}

                  <tr>
                    <td colSpan={7} className="py-1.5 px-3 text-right font-medium text-[var(--text-muted)]">
                      {tCommon('tax')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-medium text-[var(--text-primary)] tabular-nums">
                      {formatAmount(totalTax, currency)}
                    </td>
                    <td></td>
                  </tr>

                  <tr className="border-t border-[var(--border)] bg-[var(--bg-muted)]/40 font-bold">
                    <td colSpan={7} className="py-2.5 px-3 text-right text-sm text-[var(--text-primary)]">
                      {tCommon('total')}
                    </td>
                    <td className="py-2.5 px-3 text-right text-base text-[var(--accent)] font-bold tabular-nums">
                      {formatAmount(grandTotal, currency)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Notes / Remarks */}
        <div>
          <label htmlFor="invoice-notes" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
            Invoice Notes / Remarks
          </label>
          <textarea
            id="invoice-notes"
            rows={2}
            className="input w-full text-sm py-2"
            placeholder="e.g. Payment due within 30 days. Reference Project Milestone 1."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </SlideOver>
  );
}
