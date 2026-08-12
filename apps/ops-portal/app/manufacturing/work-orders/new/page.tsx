'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import LocationSelect from '@/components/shared/LocationSelect';
import { MobileCardField } from '@/components/shared/DataTable';
import { reportError } from '@/lib/api';
import {
  workOrdersControllerCreate,
  productsControllerGetComponents,
  inventoryControllerFindBinsByLocation,
} from '@herobm/sdk';
import type { CreateWorkOrderDto } from '@herobm/sdk';

export const dynamic = 'force-dynamic';

interface ComponentLine {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  expectedQuantity: string;
  unitCost: string;
  baseRatio?: number; // ratio per 1 target unit from BOM
}

interface InventoryBin {
  binId: string;
  binNumber: string;
  binType: string;
  zoneId?: string;
  zoneCode?: string;
}

let lineKeySequence = 0;

export default function NewWorkOrderPage() {
  const t = useTranslations('workOrders');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('createTitle'));
  const router = useRouter();

  // Master fields
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetQuantity, setTargetQuantity] = useState('1');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState('all');
  const [wipBinId, setWipBinId] = useState('');
  const [availableBins, setAvailableBins] = useState<InventoryBin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // Component line items
  const [lines, setLines] = useState<ComponentLine[]>([]);

  // State flags
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch bins when location changes
  useEffect(() => {
    setSelectedZone('all');
    if (!locationId) {
      setAvailableBins([]);
      setWipBinId('');
      return;
    }
    setLoadingBins(true);
    inventoryControllerFindBinsByLocation(locationId)
      .then((res) => {
        const rawBins = res?.data as unknown;
        const binList = (
          Array.isArray(rawBins)
            ? rawBins
            : Array.isArray((rawBins as { data?: unknown[] })?.data)
            ? (rawBins as { data: unknown[] }).data
            : []
        ) as InventoryBin[];
        setAvailableBins(binList);
        const wipBin = binList.find((b) => b.binType === 'wip') || binList[0];
        setWipBinId(wipBin ? wipBin.binId : '');
      })
      .catch((err) => {
        reportError(err, 'NewWorkOrderPage_Bins');
        setAvailableBins([]);
      })
      .finally(() => setLoadingBins(false));
  }, [locationId]);

  // Extract unique zones for the selected location
  const availableZones = useMemo(() => {
    const zonesSet = new Set<string>();
    availableBins.forEach((b) => {
      if (b.zoneCode) zonesSet.add(b.zoneCode);
    });
    return Array.from(zonesSet).sort();
  }, [availableBins]);

  // Filter bins based on selected zone
  const filteredBins = useMemo(() => {
    if (selectedZone === 'all') return availableBins;
    return availableBins.filter((b) => b.zoneCode === selectedZone);
  }, [availableBins, selectedZone]);

  // Group filtered bins by zone for optgroups
  const binsByZone = useMemo(() => {
    const map = new Map<string, InventoryBin[]>();
    filteredBins.forEach((bin) => {
      const zCode = bin.zoneCode || 'General';
      if (!map.has(zCode)) map.set(zCode, []);
      map.get(zCode)!.push(bin);
    });
    return map;
  }, [filteredBins]);

  // When output product changes, fetch its BOM components
  const handleProductSelect = async (p: Product) => {
    setSelectedProduct(p);
    setError('');

    try {
      const res = await productsControllerGetComponents(p.productId);
      const rawBomData = res?.data as unknown;
      const bomList = (
        Array.isArray(rawBomData)
          ? rawBomData
          : Array.isArray((rawBomData as { data?: unknown[] })?.data)
          ? (rawBomData as { data: unknown[] }).data
          : []
      ) as {
        childProductId: string;
        productNumber: string;
        name: string;
        quantity: number;
      }[];
      const targetQtyNum = parseFloat(targetQuantity) || 1;

      const newLines: ComponentLine[] = bomList.map((comp) => ({
        key: ++lineKeySequence,
        productId: comp.childProductId,
        productNumber: comp.productNumber,
        productDescription: comp.name,
        expectedQuantity: (comp.quantity * targetQtyNum).toString(),
        unitCost: '0.00',
        baseRatio: comp.quantity,
      }));

      setLines(newLines);
    } catch (err) {
      reportError(err, 'NewWorkOrderPage_BOM');
      setLines([]);
    }
  };

  // Recalculate BOM quantities when target quantity changes
  const handleTargetQuantityChange = (newQtyStr: string) => {
    setTargetQuantity(newQtyStr);
    const newQtyNum = parseFloat(newQtyStr) || 0;

    setLines((prev) =>
      prev.map((line) => {
        if (line.baseRatio !== undefined) {
          return {
            ...line,
            expectedQuantity: (line.baseRatio * newQtyNum).toString(),
          };
        }
        return line;
      }),
    );
  };

  const addLineFromProduct = (p: Product) => {
    if (lines.some((l) => l.productId === p.productId)) {
      setError(`Product ${p.productNumber} is already in the components list.`);
      return;
    }
    setError('');
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKeySequence,
        productId: p.productId,
        productNumber: p.productNumber,
        productDescription: p.name,
        expectedQuantity: '1',
        unitCost: parseFloat(p.standardCost || '0').toFixed(2),
      },
    ]);
  };

  const addCustomLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKeySequence,
        productId: '00000000-0000-0000-0000-000000000000',
        productNumber: 'CUSTOM',
        productDescription: '',
        expectedQuantity: '1',
        unitCost: '0.00',
      },
    ]);
  };

  const updateLine = (idx: number, field: keyof ComponentLine, val: string) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError(t('errors.pleaseSelectProduct'));
      return;
    }
    const targetQtyNum = parseFloat(targetQuantity);
    if (isNaN(targetQtyNum) || targetQtyNum <= 0) {
      setError(t('errors.targetQtyPositive'));
      return;
    }
    if (!locationId) {
      setError(t('errors.pleaseSelectLocation'));
      return;
    }

    const validLines = lines.filter(
      (l) => l.productId && l.productId !== '00000000-0000-0000-0000-000000000000',
    );

    setSubmitting(true);
    setError('');

    try {
      const payload: CreateWorkOrderDto = {
        orderNumber: orderNumber || undefined,
        productId: selectedProduct.productId,
        targetQuantity: String(targetQuantity),
        locationId,
        wipBinId: wipBinId || undefined,
        components:
          validLines.length > 0
            ? validLines.map((l) => ({
                productId: l.productId,
                expectedQuantity: String(l.expectedQuantity),
                unitCost: parseFloat(l.unitCost) > 0 ? String(l.unitCost) : undefined,
              }))
            : undefined,
      };

      const res = await workOrdersControllerCreate(payload);
      const workOrderId = res?.data?.workOrderId;
      if (workOrderId) {
        router.push(`/manufacturing/work-orders/${workOrderId}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('errors.failedToCreate'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('createTitle')}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/manufacturing/work-orders')}
                disabled={submitting}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? t('buttons.saving') : t('buttons.createWorkOrder')}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Work Order Header Info */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">precision_manufacturing</span>
            {t('detailsHeading')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output Product Selector */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.product')} *
              </label>
              {selectedProduct ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]">
                  <div>
                    <div className="font-semibold text-sm text-[var(--accent)]">
                      {selectedProduct.productNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedProduct.name}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(null);
                      setLines([]);
                    }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                  </Button>
                </div>
              ) : (
                <ProductSearchInput
                  structureType="kit"
                  onSelect={handleProductSelect}
                  placeholder={t('placeholders.searchProduct')}
                  style={{ width: '100%' }}
                />
              )}
            </div>

            {/* Target Quantity */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.targetQuantity')} *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="input w-full"
                value={targetQuantity}
                onChange={(e) => handleTargetQuantityChange(e.target.value)}
              />
            </div>

            {/* Location Select */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.location')} *
              </label>
              <LocationSelect
                value={locationId}
                onChange={setLocationId}
                placeholder={tCommon('selectEllipsis')}
                required
              />
            </div>

            {/* Storage Zone Filter */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.zone')}
              </label>
              <select
                className="input w-full"
                value={selectedZone}
                onChange={(e) => {
                  setSelectedZone(e.target.value);
                  setWipBinId('');
                }}
                disabled={!locationId || loadingBins || availableZones.length === 0}
              >
                <option value="all">{t('placeholders.allZones')}</option>
                {availableZones.map((zCode) => (
                  <option key={zCode} value={zCode}>
                    Zone: {zCode}
                  </option>
                ))}
              </select>
            </div>

            {/* WIP Bin Select */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.wipBin')}
              </label>
              <select
                className="input w-full"
                value={wipBinId}
                onChange={(e) => setWipBinId(e.target.value)}
                disabled={!locationId || loadingBins}
              >
                <option value="">{t('placeholders.selectWipBin')}</option>
                {Array.from(binsByZone.entries()).map(([zoneName, binGroup]) => (
                  <optgroup key={zoneName} label={`Zone: ${zoneName}`}>
                    {binGroup.map((bin) => (
                      <option key={bin.binId} value={bin.binId}>
                        {bin.binNumber} {bin.binType ? `(${bin.binType === 'wip' ? 'Work in Progress' : bin.binType.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Order Number (Optional) */}
            <div className="md:col-span-2">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('labels.orderNumber')}
              </label>
              <input
                className="input w-full"
                placeholder={t('placeholders.orderNumber')}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Component Line Items (BOM) */}
        <div className="card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <h3 className="section-heading !mb-0 shrink-0">
              <span className="material-symbols-outlined">inventory_2</span>
              {t('lineItems')}
            </h3>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <ProductSearchInput
                  onSelect={addLineFromProduct}
                  placeholder={t('placeholders.searchComponent')}
                  style={{ width: '100%' }}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
                onClick={addCustomLine}
              >
                {t('buttons.customLine')}
              </Button>
            </div>
          </div>

          {/* Mobile view */}
          <div className="lg:hidden flex flex-col gap-3 w-full mt-4">
            {lines.length === 0 ? (
              <div className="text-center text-slate-500 py-4 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                {t('noLineItems')}
              </div>
            ) : (
              lines.map((line, idx) => (
                <div
                  key={line.key}
                  className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-semibold text-sm text-[var(--accent)]">
                      {line.productNumber}
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                      #{idx + 1}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 font-medium mb-3">
                    {line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      line.productDescription || '—'
                    ) : (
                      <input
                        className="input w-full text-sm h-8 !py-1"
                        value={line.productDescription}
                        onChange={(e) =>
                          updateLine(idx, 'productDescription', e.target.value)
                        }
                        placeholder={t('placeholders.customDescription')}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                    <MobileCardField
                      label={t('columns.expectedQty')}
                      value={
                        <input
                          className="input text-right w-24 h-8 text-sm !py-1"
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.expectedQuantity}
                          onChange={(e) =>
                            updateLine(idx, 'expectedQuantity', e.target.value)
                          }
                        />
                      }
                    />
                    <MobileCardField
                      label={t('columns.unitCost')}
                      value={
                        <input
                          className="input text-right w-24 h-8 text-sm !py-1"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) =>
                            updateLine(idx, 'unitCost', e.target.value)
                          }
                        />
                      }
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(idx)}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />{' '}
                        {tCommon('buttons.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>{t('columns.lineNumber')}</th>
                  <th>{t('columns.product')}</th>
                  <th>{tCommon('columns.description')}</th>
                  <th style={{ width: 120, textAlign: 'right' }}>
                    {t('columns.expectedQty')}
                  </th>
                  <th style={{ width: 120, textAlign: 'right' }}>
                    {t('columns.unitCost')}
                  </th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td
                      style={{
                        color: 'var(--accent)',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {line.productNumber}
                    </td>
                    <td>
                      {line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                        line.productDescription || '—'
                      ) : (
                        <input
                          className="input"
                          style={{ width: '100%', fontSize: 13 }}
                          value={line.productDescription}
                          onChange={(e) =>
                            updateLine(idx, 'productDescription', e.target.value)
                          }
                          placeholder={t('placeholders.customDescription')}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="0.01"
                        step="any"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={line.expectedQuantity}
                        onChange={(e) =>
                          updateLine(idx, 'expectedQuantity', e.target.value)
                        }
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ width: '100%', textAlign: 'right' }}
                        value={line.unitCost}
                        onChange={(e) =>
                          updateLine(idx, 'unitCost', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(idx)}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        padding: '20px 0',
                      }}
                    >
                      {t('noLineItems')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
