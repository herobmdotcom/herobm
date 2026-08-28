'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import LocationSelect from '@/components/shared/LocationSelect';
import { MobileCardField } from '@/components/shared/DataTable';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  workOrdersControllerCreate,
  productsControllerGetComponents,
  inventoryControllerFindBinsByLocation,
  inventoryControllerFindByProductIdsBulk,
} from '@herobm/sdk';
import type { CreateWorkOrderDto } from '@herobm/sdk';
import { compareBinNumbers, BIN_TYPE, getErrorMessage } from '@herobm/shared';
import { WorkOrderAvailabilityTab, getComponentStockWarning, type InventoryItem } from '../components/WorkOrderAvailabilityTab';

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
  const [outputBinId, setOutputBinId] = useState('');
  const [assemblyCostPerUnit, setAssemblyCostPerUnit] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');
  const [availableBins, setAvailableBins] = useState<InventoryBin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // Component line items & availability state
  const [lines, setLines] = useState<ComponentLine[]>([]);
  const [activeTab, setActiveTab] = useState<'lines' | 'availability'>('lines');
  const [inventoryLevels, setInventoryLevels] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // State flags
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch bins when location changes
  useEffect(() => {
    setSelectedZone('all');
    if (!locationId) {
      setAvailableBins([]);
      setWipBinId('');
      setOutputBinId('');
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
        const wipBin = binList.find((b) => b.binType === BIN_TYPE.WIP) || binList[0];
        setWipBinId(wipBin ? wipBin.binId : '');
        const outputBin = binList.find((b) => b.binType === BIN_TYPE.STORAGE || b.binType === BIN_TYPE.PICK) || wipBin;
        setOutputBinId(outputBin ? outputBin.binId : '');
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

  // Filter and naturally sort bins based on selected zone
  const filteredBins = useMemo(() => {
    const list = selectedZone === 'all'
      ? [...availableBins]
      : availableBins.filter((b) => b.zoneCode === selectedZone);
    return list.sort((a, b) => compareBinNumbers(a.binNumber, b.binNumber));
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

  // Fetch stock availability for component line items
  useEffect(() => {
    const productIds = lines
      .map((l) => l.productId)
      .filter((id) => id && id !== '00000000-0000-0000-0000-000000000000');

    if (productIds.length === 0) {
      setInventoryLevels([]);
      return;
    }

    setInventoryLoading(true);
    inventoryControllerFindByProductIdsBulk({ productIds, locationId: locationId || undefined })
      .then((res) => {
        setInventoryLevels((res?.data || []) as unknown as InventoryItem[]);
      })
      .catch((err) => {
        reportError(err, 'NewWorkOrderPage_fetchInventory');
        setInventoryLevels([]);
      })
      .finally(() => setInventoryLoading(false));
  }, [lines, locationId]);

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
      toast.error('Failed to load BOM components: ' + getErrorMessage(err));
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
        outputBinId: outputBinId || undefined,
        assemblyCostPerUnit: assemblyCostPerUnit ? String(assemblyCostPerUnit) : undefined,
        additionalCost: additionalCost ? String(additionalCost) : undefined,
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
        return;
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err) || t('errors.failedToCreate');
      setError(msg);
      toast.error(msg);
      reportError(err, 'NewWorkOrderPage_Create');
      setSubmitting(false);
    }
  };

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('createTitle')}
          isSaving={submitting}
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
                {submitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1.5" />
                    {t('buttons.saving')}
                  </>
                ) : (
                  t('buttons.createWorkOrder')
                )}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400"
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
                className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]"
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
                />
              )}
            </div>

            {/* Target Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
                        {bin.binNumber} {bin.binType ? `(${bin.binType === BIN_TYPE.WIP ? 'Work in Progress' : bin.binType.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Output Bin Select */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t('labels.outputBin')}
              </label>
              <select
                className="input w-full"
                value={outputBinId}
                onChange={(e) => setOutputBinId(e.target.value)}
                disabled={!locationId || loadingBins}
              >
                <option value="">{t('placeholders.selectOutputBin')}</option>
                {Array.from(binsByZone.entries()).map(([zoneName, binGroup]) => (
                  <optgroup key={zoneName} label={`Zone: ${zoneName}`}>
                    {binGroup.map((bin) => (
                      <option key={bin.binId} value={bin.binId}>
                        {bin.binNumber} {bin.binType ? `(${bin.binType === BIN_TYPE.WIP ? 'Work in Progress' : bin.binType.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Unit Assembly Cost (Optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t('labels.assemblyCostPerUnit')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                placeholder={t('placeholders.assemblyCostPerUnit')}
                value={assemblyCostPerUnit}
                onChange={(e) => setAssemblyCostPerUnit(e.target.value)}
              />
            </div>

            {/* Additional Cost (Optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t('labels.additionalCost')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                placeholder={t('placeholders.additionalCost')}
                value={additionalCost}
                onChange={(e) => setAdditionalCost(e.target.value)}
              />
            </div>

            {/* Order Number (Optional) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
          <h3 className="section-heading mb-4">
            <span className="material-symbols-outlined">inventory_2</span>
            {t('lineItems')}
          </h3>
          <div className="mb-4">
            <Tabs<'lines' | 'availability'>
              tabs={[
                { id: 'lines', label: 'Component Lines' },
                { id: 'availability', label: 'Stock Availability' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              actions={
                activeTab === 'lines' ? (
                  <>
                    <div className="flex-1 min-w-[200px] max-w-sm">
                      <ProductSearchInput
                        onSelect={addLineFromProduct}
                        placeholder={t('placeholders.searchComponent')}
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
                  </>
                ) : undefined
              }
            />
          </div>

          {activeTab === 'lines' ? (
            <>
              {/* Mobile view */}
              <div className="lg:hidden flex flex-col gap-3 w-full mt-4">
                {lines.length === 0 ? (
                  <div className="text-center text-slate-500 py-4 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    {t('noLineItems')}
                  </div>
                ) : (
                  lines.map((line, idx) => {
                    const stockWarn = getComponentStockWarning(line.productId, locationId, line.expectedQuantity, inventoryLevels);
                    return (
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
                              <div className="flex items-center gap-1 justify-end">
                                {stockWarn && (
                                  <span
                                    className={`material-symbols-outlined cursor-help text-[15px] ${stockWarn.type === 'shortage' ? 'text-red-600' : 'text-amber-600'}`}
                                    title={stockWarn.title}
                                  >
                                    {stockWarn.icon}
                                  </span>
                                )}
                                <input
                                  className={`input text-right w-24 h-8 text-sm !py-1 ${stockWarn ? (stockWarn.type === 'shortage' ? '!border-red-600' : '!border-amber-600') : ''}`}
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={line.expectedQuantity}
                                  onChange={(e) =>
                                    updateLine(idx, 'expectedQuantity', e.target.value)
                                  }
                                />
                              </div>
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
                    );
                  })
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto w-full">
                <table className="table-lines w-full">
                  <thead>
                    <tr>
                      <th className="w-10">{t('columns.lineNumber')}</th>
                      <th>{t('columns.product')}</th>
                      <th>{tCommon('columns.description')}</th>
                      <th className="w-[140px] text-right">
                        {t('columns.expectedQty')}
                      </th>
                      <th className="w-[120px] text-right">
                        {t('columns.unitCost')}
                      </th>
                      <th className="w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const stockWarn = getComponentStockWarning(line.productId, locationId, line.expectedQuantity, inventoryLevels);
                      return (
                        <tr key={line.key}>
                          <td className="text-[var(--text-muted)]">{idx + 1}</td>
                          <td className="text-[var(--accent)] font-semibold text-xs">
                            {line.productNumber}
                          </td>
                          <td>
                            {line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                              line.productDescription || '—'
                            ) : (
                              <input
                                className="input w-full text-[13px]"
                                value={line.productDescription}
                                onChange={(e) =>
                                  updateLine(idx, 'productDescription', e.target.value)
                                }
                                placeholder={t('placeholders.customDescription')}
                              />
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {stockWarn && (
                                <span
                                  className={`material-symbols-outlined cursor-help text-[15px] ${stockWarn.type === 'shortage' ? 'text-red-600' : 'text-amber-600'}`}
                                  title={stockWarn.title}
                                >
                                  {stockWarn.icon}
                                </span>
                              )}
                              <input
                                className={`input w-full text-right ${stockWarn ? (stockWarn.type === 'shortage' ? '!border-red-600' : '!border-amber-600') : ''}`}
                                type="number"
                                min="0.01"
                                step="any"
                                value={line.expectedQuantity}
                                onChange={(e) =>
                                  updateLine(idx, 'expectedQuantity', e.target.value)
                                }
                              />
                            </div>
                          </td>
                          <td className="text-right">
                            <input
                              className="input w-full text-right"
                              type="number"
                              min="0"
                              step="0.01"
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
                      );
                    })}
                    {lines.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-[var(--text-muted)] py-5"
                        >
                          {t('noLineItems')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <WorkOrderAvailabilityTab
              locationId={locationId}
              components={lines}
              inventoryData={inventoryLevels}
              loading={inventoryLoading}
            />
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
