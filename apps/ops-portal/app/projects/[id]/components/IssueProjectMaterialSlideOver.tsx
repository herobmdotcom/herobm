'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import ProductSearchInput, { Product } from '@/components/shared/ProductSearchInput';
import LocationSelect from '@/components/shared/LocationSelect';
import { AvailabilityTab, AvailabilityLineItem, AvailabilityInventoryLevel } from '@/components/shared/AvailabilityTab';
import { OrderLinesTable, type OrderLineItem, type TaxCategory } from '@/components/shared/OrderLinesTable';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { computeLinePrice, getErrorMessage, calculateAvailableQuantity, LineType, type InventoryGap } from '@herobm/shared';

export interface ProjectMaterialIssueLine extends OrderLineItem {
  id: string;
  productId: string;
  productNumber: string;
  productDescription: string;
  unitOfMeasure: string;
  quantity: number | string;
  unitCost: number | string;
  pricePerUnit: number | string;
  discountPercentage: number | string;
  taxCategoryId: string;
  taxRate: number;
  projectTaskId: string;
}

interface IssueProjectMaterialSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  projectName?: string;
  stagingLocationId?: string | null;
  tasks?: api.ProjectTaskResponseDto[];
  currency: string;
  onSuccess: () => Promise<void>;
}

export function IssueProjectMaterialSlideOver({
  isOpen,
  onClose,
  projectId,
  projectNumber,
  projectName: _projectName,
  stagingLocationId,
  tasks: _tasks,
  currency,
  onSuccess,
}: IssueProjectMaterialSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tSales = useTranslations('salesOrders');

  const [activeTab, setActiveTab] = useState<'lines' | 'availability'>('lines');
  const [sourceLocationId, setSourceLocationId] = useState<string>('');
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Default destination location to project staging location
  useEffect(() => {
    if (stagingLocationId && !destinationLocationId) {
      setDestinationLocationId(stagingLocationId);
    }
  }, [stagingLocationId, destinationLocationId]);

  const [lines, setLines] = useState<ProjectMaterialIssueLine[]>([]);
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<AvailabilityInventoryLevel[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load tax categories
  useEffect(() => {
    api.taxCategoriesControllerFindAll()
      .then((res) => {
        const raw = res.data as unknown;
        const list = (Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data || []) as api.TaxCategoryResponseDto[];
        setTaxCategories(list);
      })
      .catch(() => {
        setTaxCategories([]);
      });
  }, []);

  // Fetch inventory levels eagerly for product lines to compute onHand & gap warnings
  const productIdsKey = useMemo(() => {
    return Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))).sort().join(',');
  }, [lines]);

  useEffect(() => {
    if (!productIdsKey) {
      setInventoryLevels([]);
      return;
    }

    let isCancelled = false;
    setInventoryLoading(true);
    const productIds = productIdsKey.split(',');

    api.inventoryControllerFindByProductIdsBulk({ productIds })
      .then((res) => {
        if (!isCancelled) {
          setInventoryLevels(
            (Array.isArray(res.data) ? res.data : []) as unknown as AvailabilityInventoryLevel[],
          );
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setInventoryLevels([]);
          toast.error(getErrorMessage(err) || 'Failed to load inventory availability');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setInventoryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [productIdsKey]);

  // Add product to lines
  const handleAddProduct = (product: Product) => {
    if (!product || !product.productId) return;

    const defaultTax = taxCategories.find((t) => (t as unknown as { isDefault?: boolean }).isDefault) || taxCategories[0];
    const taxRate = defaultTax?.rate ? Number(defaultTax.rate) : 0;

    const unitCost = Number(
      (product as unknown as { standardCost?: string | number }).standardCost ||
        (product as unknown as { weightedAverageCost?: string | number }).weightedAverageCost ||
        (product as unknown as { tradePrice?: string | number }).tradePrice ||
        0
    );
    const unitPrice = Number(
      (product as unknown as { listPrice?: string | number }).listPrice ||
        (product as unknown as { price?: string | number }).price ||
        (unitCost > 0 ? unitCost * 1.3 : 0)
    );

    const newLine: ProjectMaterialIssueLine = {
      id: `${product.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: product.productId,
      productNumber: product.productNumber || '',
      productDescription: product.name || '',
      unitOfMeasure: product.baseUom || 'EA',
      baseUom: product.baseUom || 'EA',
      quantity: 1,
      unitCost: unitCost || 0,
      pricePerUnit: unitPrice || 0,
      discountPercentage: 0,
      taxCategoryId: defaultTax ? defaultTax.taxCategoryId : '',
      taxRate,
      projectTaskId: '',
    };

    setLines((prev) => [...prev, newLine]);
  };

  // Update single line field
  const handleUpdateLine = (indexOrId: string | number, field: string, value: unknown) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        const lineId = l.id || idx;
        if (lineId !== indexOrId && idx !== Number(indexOrId) && l.id !== String(indexOrId)) return l;

        const updated = { ...l, [field]: value };
        if (field === 'taxCategoryId') {
          const cat = taxCategories.find((c) => (c as unknown as { taxCategoryId: string }).taxCategoryId === value);
          updated.taxRate = cat ? Number((cat as unknown as { rate?: string | number }).rate || 0) : 0;
        }
        return updated;
      })
    );
  };

  // Update multiple line fields
  const handleUpdateLineFields = (indexOrId: string | number, fields: Record<string, unknown>) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        const lineId = l.id || idx;
        if (lineId !== indexOrId && idx !== Number(indexOrId) && l.id !== String(indexOrId)) return l;

        const updated = { ...l, ...fields };
        if ('taxCategoryId' in fields) {
          const cat = taxCategories.find((c) => (c as unknown as { taxCategoryId: string }).taxCategoryId === fields.taxCategoryId);
          updated.taxRate = cat ? Number((cat as unknown as { rate?: string | number }).rate || 0) : 0;
        }
        return updated;
      })
    );
  };

  // Remove line
  const handleRemoveLine = (indexOrId: string | number) => {
    setLines((prev) =>
      prev.filter((l, idx) => {
        const lineId = l.id || idx;
        return lineId !== indexOrId && idx !== Number(indexOrId) && l.id !== String(indexOrId);
      })
    );
  };

  // Compute Totals
  const { totalActualCost, subtotalBilling, totalDiscount, totalTax, grandTotal } = useMemo(() => {
    let cost = 0;
    let sub = 0;
    let disc = 0;
    let tax = 0;

    lines.forEach((line) => {
      const qty = parseFloat(String(line.quantity || '0')) || 0;
      const uCost = parseFloat(String(line.unitCost || '0')) || 0;
      const uPrice = parseFloat(String(line.pricePerUnit || '0')) || 0;
      const discPct = parseFloat(String(line.discountPercentage || '0')) || 0;
      const tRate = line.taxRate || 0;

      const lineCost = qty * uCost;
      const rawSub = qty * uPrice;

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: uPrice,
        discountPercentage: discPct,
        taxRate: tRate,
      });

      const discAmount = rawSub - pricing.amount;

      cost += lineCost;
      sub += rawSub;
      disc += discAmount;
      tax += pricing.tax;
    });

    return {
      totalActualCost: cost,
      subtotalBilling: sub,
      totalDiscount: disc,
      totalTax: tax,
      grandTotal: sub - disc + tax,
    };
  }, [lines]);

  // Format lines for AvailabilityTab
  const availabilityLines: AvailabilityLineItem[] = useMemo(() => {
    return lines.map((l, idx) => ({
      id: l.id,
      lineNumber: idx + 1,
      productId: l.productId,
      productNumber: l.productNumber,
      productDescription: l.productDescription,
      quantity: l.quantity,
      unitOfMeasure: l.unitOfMeasure,
      fulfillmentLocationId: sourceLocationId || undefined,
    }));
  }, [lines, sourceLocationId]);

  // Compute onHand quantities and inventory gap shortages for source location
  const { linesWithOnHand, gapMap } = useMemo(() => {
    const gaps: Record<string, InventoryGap> = {};
    const mapped = lines.map((l) => {
      if (!l.productId || l.lineType === LineType.COMMENT) return l;

      const locInv = inventoryLevels.find(
        (inv) => inv.productId === l.productId && inv.locationId === sourceLocationId,
      );

      const onHand =
        locInv?.quantityAvailable != null
          ? parseFloat(String(locInv.quantityAvailable || '0'))
          : locInv
          ? calculateAvailableQuantity(
              locInv.quantityOnHand,
              locInv.quantityCommitted,
              locInv.quantityReserved,
            )
          : inventoryLevels.length > 0
          ? 0
          : undefined;

      const qty = parseFloat(String(l.quantity || '0'));
      if (onHand !== undefined && qty > onHand) {
        gaps[l.id] = {
          salesOrderLineId: l.id,
          productId: l.productId,
          productDescription: l.productDescription,
          orderedQuantity: qty,
          availableQuantity: onHand,
          shortage: qty - onHand,
          locationId: sourceLocationId,
        };
      }

      return {
        ...l,
        onHand,
      };
    });

    return { linesWithOnHand: mapped, gapMap: gaps };
  }, [lines, inventoryLevels, sourceLocationId]);

  // Handle submit Transfer Order
  const handleSubmit = async () => {
    if (!sourceLocationId) {
      toast.error('Source warehouse location is required.');
      return;
    }

    if (!destinationLocationId) {
      toast.error('Destination location is required.');
      return;
    }

    if (lines.length === 0) {
      toast.error('Please add at least one line item.');
      return;
    }

    // Validate quantities
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(String(l.quantity || '0'));
      if (!qty || qty <= 0) {
        toast.error(`Line ${i + 1} (${l.productNumber}): Quantity must be greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const transferLines = lines.map((l) => ({
        productId: l.productId,
        quantity: String(l.quantity),
      }));

      const defaultNote = projectNumber
        ? `Project ${projectNumber} - Material Transfer`
        : 'Project Material Transfer';
      const transferNotes = notes.trim() || defaultNote;

      const res = await api.transfersControllerCreate({
        sourceLocationId,
        destinationLocationId,
        projectId,
        notes: transferNotes,
        lines: transferLines,
      });

      const orderNumber = res?.data?.orderNumber || '';
      toast.success(
        orderNumber
          ? `Transfer Order ${orderNumber} created successfully`
          : 'Transfer Order created successfully'
      );

      setLines([]);
      setNotes('');
      await onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create transfer order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('buttons.stageStock')}
      width="max-w-6xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
            <span>
              Total Lines: <strong className="text-[var(--text-primary)] font-medium">{lines.length}</strong>
            </span>
            <span>
              Total Cost: <strong className="text-[var(--text-primary)] font-medium">{formatAmount(totalActualCost, currency)}</strong>
            </span>
            <span>
              Total Billable: <strong className="text-[var(--text-primary)] font-medium">{formatAmount(grandTotal, currency)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              {tCommon('buttons.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || lines.length === 0 || !sourceLocationId || !destinationLocationId}
            >
              {submitting
                ? t('buttons.saving')
                : lines.length > 0
                ? `Create Transfer Order (${lines.length} Line${lines.length > 1 ? 's' : ''})`
                : t('buttons.stageStock')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header Defaults Control Card */}
        <div className="space-y-3 pb-4 border-b border-[var(--border)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Source Warehouse Location *</label>
              <LocationSelect
                value={sourceLocationId}
                onChange={(locId) => {
                  const nextLoc = locId || '';
                  setSourceLocationId(nextLoc);
                }}
                placeholder="Select source warehouse..."
                className="input w-full text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Destination Location (Site Staging) *</label>
              <LocationSelect
                value={destinationLocationId}
                onChange={(locId) => setDestinationLocationId(locId || '')}
                placeholder="Select destination / site..."
                className="input w-full text-xs"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('columns.notes')}</label>
            <input
              type="text"
              className="input w-full text-xs"
              placeholder={projectNumber ? `e.g. Material transfer for Project ${projectNumber}` : 'Transfer notes / project reference...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Navigation Tabs with Search Action (Single Clean Border) */}
        <Tabs<'lines' | 'availability'>
          tabs={[
            { id: 'lines', label: tSales('lineItems') },
            { id: 'availability', label: tSales('availability') },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          actions={
            activeTab === 'lines' ? (
              <div className="w-full sm:w-80">
                <ProductSearchInput
                  onSelect={handleAddProduct}
                  placeholder={tSales('placeholders.searchProduct')}
                  fulfillmentLocationId={sourceLocationId || undefined}
                  className="w-full text-xs"
                />
              </div>
            ) : undefined
          }
        />

        {/* Tab 1: Line Items Table */}
        {activeTab === 'lines' && (
          <div className="space-y-4">
            <OrderLinesTable
              lines={linesWithOnHand}
              currencyCode={currency}
              taxCategories={taxCategories as unknown as TaxCategory[]}
              isEditable={true}
              showUnitCost={true}
              mode="sales"
              gapMap={gapMap}
              isPreConfirmation={true}
              subtotal={subtotalBilling}
              totalTax={totalTax}
              totalDiscount={totalDiscount}
              grandTotal={grandTotal}
              customEmptyMessage="No materials added yet. Use the product search bar above to select components from inventory."
              onUpdateLine={handleUpdateLine}
              onUpdateLineFields={handleUpdateLineFields}
              onRemoveLine={handleRemoveLine}
            />
          </div>
        )}

        {/* Tab 2: Stock Availability Grid */}
        {activeTab === 'availability' && (
          <div className="space-y-4">
            <AvailabilityTab
              lines={availabilityLines}
              inventoryData={inventoryLevels}
              inventoryLoading={inventoryLoading}
              targetLocationId={sourceLocationId}
              gapMap={gapMap}
              context="sales"
              isPreConfirmation={true}
              isShipped={false}
              emptyMessage="Add materials in the Line Items tab to inspect warehouse stock availability."
            />
          </div>
        )}
      </div>
    </SlideOver>
  );
}
