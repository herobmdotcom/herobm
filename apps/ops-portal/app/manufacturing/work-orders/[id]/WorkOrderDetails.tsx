'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import EntityBanner from '@/components/shared/EntityBanner';
import LocationSelect from '@/components/shared/LocationSelect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ValidState } from '@/types/states';
import { WORK_ORDER_STATE, PUTAWAY_STATUS, compareBinNumbers } from '@herobm/shared';
import { reportError } from '@/lib/api';
import {
  workOrdersControllerFindOne,
  workOrdersControllerRelease,
  workOrdersControllerCompleteBuild,
  workOrdersControllerPutawayFinishedGoods,
  workOrdersControllerCancel,
  workOrdersControllerUpdate,
  workOrdersControllerUpdateComponent,
  inventoryControllerFindBinsByLocation,
  inventoryControllerFindByProductIdsBulk,
} from '@herobm/sdk';
import { WorkOrderAvailabilityTab, getComponentStockWarning, type InventoryItem } from '../components/WorkOrderAvailabilityTab';

import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';

interface WorkOrderComponent {
  workOrderComponentId: string;
  productId: string;
  productName: string;
  productNumber: string;
  expectedQuantity: string;
  unitCost?: string | null;
}

interface WorkOrderDetail {
  workOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productNumber: string;
  targetQuantity: string;
  completedQuantity: string;
  locationId: string;
  locationName: string;
  wipBinId?: string | null;
  wipBinName?: string | null;
  outputBinId?: string | null;
  outputBinName?: string | null;
  stateCode: string;
  putawayStatus?: string | null;
  totalCost?: string | null;
  createdBy?: string | null;
  createdOn?: string | Date | null;
  components: WorkOrderComponent[];
  events?: TimelineEvent[];
}

interface InventoryBin {
  binId: string;
  binNumber: string;
  binType: string;
  zoneId?: string;
  zoneCode?: string;
}

export default function WorkOrderDetails({ workOrderId }: { workOrderId: string }) {
  const tCommon = useTranslations('common');
  const tWork = useTranslations('workOrders');
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit State
  const [dto, setDto] = useState<Partial<WorkOrderDetail>>({});
  const [selectedZone, setSelectedZone] = useState('all');
  const [availableBins, setAvailableBins] = useState<InventoryBin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // Availability state
  const [activeTab, setActiveTab] = useState<'lines' | 'availability'>('lines');
  const [inventoryLevels, setInventoryLevels] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useDocumentTitle(data ? `${data.orderNumber} - Work Order` : null);

  const fetchWorkOrder = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await workOrdersControllerFindOne(workOrderId);
      if (res && res.data) {
        setData(res.data as unknown as WorkOrderDetail);
      } else {
        setError('Work Order not found');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch work order details';
      setError(msg);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (workOrderId) {
      fetchWorkOrder();
    }
  }, [workOrderId, fetchWorkOrder]);

  useEffect(() => {
    if (data) {
      setDto({
        targetQuantity: data.targetQuantity,
        locationId: data.locationId,
        wipBinId: data.wipBinId || '',
        outputBinId: data.outputBinId || '',
      });
    }
  }, [data]);

  useEffect(() => {
    setSelectedZone('all');
    if (!dto.locationId) {
      setAvailableBins([]);
      return;
    }
    setLoadingBins(true);
    inventoryControllerFindBinsByLocation(dto.locationId)
      .then((res) => {
        setAvailableBins((res?.data || []) as unknown as InventoryBin[]);
      })
      .catch((err) => {
        reportError(err, 'WorkOrderDetails_fetchBins');
        setAvailableBins([]);
      })
      .finally(() => setLoadingBins(false));
  }, [dto.locationId]);

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

  // Fetch stock availability for Work Order component lines
  useEffect(() => {
    if (!data?.components || data.components.length === 0) {
      setInventoryLevels([]);
      return;
    }
    const productIds = data.components
      .map((c) => c.productId)
      .filter((id) => id && id !== '00000000-0000-0000-0000-000000000000');

    if (productIds.length === 0) {
      setInventoryLevels([]);
      return;
    }

    setInventoryLoading(true);
    inventoryControllerFindByProductIdsBulk({ productIds, locationId: data.locationId || undefined })
      .then((res) => {
        setInventoryLevels((res?.data || []) as unknown as InventoryItem[]);
      })
      .catch((err) => {
        reportError(err, 'WorkOrderDetails_fetchInventory');
        setInventoryLevels([]);
      })
      .finally(() => setInventoryLoading(false));
  }, [data?.components, data?.locationId]);

  const updateField = (field: keyof WorkOrderDetail, value: string | null) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const saveField = async (field: keyof WorkOrderDetail, value: string | null) => {
    if (!workOrderId || data?.[field] === value) return;
    try {
      setActionLoading(true);
      const payload: Record<string, unknown> = { [field]: value === '' || value === null ? null : value };
      
      // If changing location, clear out the wip bin & output bin if no longer valid
      if (field === 'locationId') {
        payload.wipBinId = null;
        payload.outputBinId = null;
        updateField('wipBinId', '');
        updateField('outputBinId', '');
      }
      
      await workOrdersControllerUpdate(workOrderId, payload);
      toast.success('Work Order updated');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update field');
      if (data) {
        setDto((prev) => ({ ...prev, [field]: data[field] || '' }));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const saveComponentField = useCallback(async (componentId: string, field: string, value: string) => {
    if (!workOrderId) return;
    try {
      setActionLoading(true);
      const payload: Record<string, unknown> = { [field]: value === '' || value === null ? null : value };
      await workOrdersControllerUpdateComponent(workOrderId, componentId, payload);
      toast.success('Component updated');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update component');
    } finally {
      setActionLoading(false);
    }
  }, [workOrderId, fetchWorkOrder]);

  const handleRelease = async () => {
    if (!data?.wipBinId || !data?.outputBinId) {
      toast.error(tWork('errors.binsRequired'));
      return;
    }
    try {
      setActionLoading(true);
      await workOrdersControllerRelease(workOrderId, {});
      toast.success('Work Order released for production.');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to release Work Order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setActionLoading(true);
      await workOrdersControllerCompleteBuild(workOrderId, {});
      toast.success('Production build completed. Output credited to Production/QA Bin.');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete production');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePutaway = async () => {
    try {
      setActionLoading(true);
      await workOrdersControllerPutawayFinishedGoods(workOrderId, {});
      toast.success('Finished goods putaway completed & linked backorders fulfilled!');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to putaway finished goods');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await workOrdersControllerCancel(workOrderId, {});
      toast.success('Work Order cancelled.');
      await fetchWorkOrder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel Work Order');
    } finally {
      setActionLoading(false);
    }
  };

  const componentColumns: DataTableColumn<WorkOrderComponent>[] = useMemo(
    () => [
      {
        id: 'index',
        header: '#',
        width: 40,
        render: (_, i) => <span style={{ color: 'var(--text-muted)', fontWeight: 400, position: 'relative' }}>{i + 1}</span>,
      },
      {
        id: 'sku',
        header: 'Product SKU',
        width: 160,
        render: (comp) => (
          <span style={{ fontWeight: 600, fontSize: 12 }}>
            <Link
              href={`/products/${comp.productId}`}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
              className="hover:underline"
            >
              {comp.productNumber}
            </Link>
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Component Name',
        render: (comp) => <span style={{ fontSize: 12 }}>{comp.productName}</span>,
      },
      {
        id: 'expectedQty',
        header: 'Expected Qty',
        width: 130,
        align: 'right',
        render: (comp) => {
          const stockWarn = getComponentStockWarning(comp.productId, data?.locationId, comp.expectedQuantity, inventoryLevels);
          return (
            <div className="flex items-center justify-end gap-1">
              {stockWarn && (
                <span
                  className="material-symbols-outlined cursor-help"
                  style={{ fontSize: 15, color: stockWarn.color }}
                  title={stockWarn.title}
                >
                  {stockWarn.icon}
                </span>
              )}
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: stockWarn ? stockWarn.color : undefined }}>
                {comp.expectedQuantity}
              </span>
            </div>
          );
        },
      },
      {
        id: 'unitCost',
        header: 'Unit Cost',
        width: 130,
        align: 'right',
        render: (comp) => {
          if (data?.stateCode === WORK_ORDER_STATE.DRAFT) {
            return (
              <input
                className="input w-full text-right h-8 text-sm !py-1"
                type="number"
                min="0"
                step="0.01"
                defaultValue={comp.unitCost || ''}
                placeholder="Auto"
                onBlur={(e) => {
                  if (e.target.value !== (comp.unitCost || '')) {
                    saveComponentField(comp.workOrderComponentId, 'unitCost', e.target.value);
                  }
                }}
                disabled={actionLoading}
              />
            );
          }
          const cost = comp.unitCost ? `$${parseFloat(comp.unitCost).toFixed(2)}` : 'Auto';
          return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{cost}</span>;
        },
      },
    ],
    [data?.stateCode, data?.locationId, inventoryLevels, actionLoading, saveComponentField]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 max-w-xl mx-auto">
        <EntityBanner type="error" title={error || 'Work Order not found'} />
        <Link href="/manufacturing/work-orders">
          <Button variant="secondary">
            <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>arrow_back</span>
            Back to Work Orders
          </Button>
        </Link>
      </div>
    );
  }

  const isEditable = data.stateCode === WORK_ORDER_STATE.DRAFT;
  const wipBinValue = data.wipBinName ? data.wipBinName : 'Unassigned';
  const outputBinValue = data.outputBinName
    ? data.outputBinName
    : data.wipBinName
    ? `${data.wipBinName} (Same as WIP)`
    : 'Unassigned';

  const isDraftOrPlanned =
    data.stateCode === WORK_ORDER_STATE.DRAFT || data.stateCode === WORK_ORDER_STATE.PLANNED;
  const isInProgress = data.stateCode === WORK_ORDER_STATE.IN_PROGRESS;
  const isCompleted = data.stateCode === WORK_ORDER_STATE.COMPLETED;
  const isCancelled = data.stateCode === WORK_ORDER_STATE.CANCELLED;

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={data.orderNumber}
          subtitle={`Output: ${data.productName} (${data.productNumber}) · Target Qty: ${data.targetQuantity}`}
          badges={<StateBadge state={data.stateCode as ValidState} />}
          actions={
            <div className="flex items-center gap-2">
              {isDraftOrPlanned && (
                <Button variant="primary" size="sm" onClick={handleRelease} disabled={actionLoading}>
                  Release Order
                </Button>
              )}

              {isInProgress && (
                <div className="flex items-center gap-2">
                  <Link href="/inventory/picking">
                    <Button variant="secondary" size="sm">
                      {/* eslint-disable-next-line i18next/no-literal-string -- Material Symbol icon name */}
                      <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>inventory</span>
                      Go to Picking Queue
                    </Button>
                  </Link>
                  <Button variant="primary" size="sm" onClick={handleComplete} disabled={actionLoading}>
                    Complete Production
                  </Button>
                </div>
              )}

              {isCompleted && (
                <div className="flex items-center gap-2">
                  {data?.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY && (
                    <Link href="/inventory/putaway">
                      <Button variant="primary" size="sm">
                        {/* eslint-disable-next-line i18next/no-literal-string -- Material Symbol icon name */}
                        <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>pallet</span>
                        Go to Putaway Queue
                      </Button>
                    </Link>
                  )}
                  {data?.putawayStatus !== PUTAWAY_STATUS.COMPLETED && (
                    <Button variant="secondary" size="sm" onClick={handlePutaway} disabled={actionLoading}>
                      Direct Putaway
                    </Button>
                  )}
                </div>
              )}

              {!isCompleted && !isCancelled && (
                <Button variant="danger" size="sm" onClick={handleCancel} disabled={actionLoading}>
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material Symbol icon name */}
                  <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                  Cancel Order
                </Button>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Primary Order Information Card */}
        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="section-heading mb-0">
              <span className="material-symbols-outlined">
                receipt_long
              </span>
              Work Order Details
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Output Product
              </label>
              <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                <Link href={`/products/${data.productId}`} className="hover:underline" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  {data.productName} ({data.productNumber})
                </Link>
              </p>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Target Quantity
              </label>
              {isEditable ? (
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input w-full"
                  disabled={actionLoading}
                  value={dto.targetQuantity || ''}
                  onChange={(e) => updateField('targetQuantity', e.target.value)}
                  onBlur={(e) => saveField('targetQuantity', e.target.value)}
                />
              ) : (
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  {data.targetQuantity}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Completed Quantity
              </label>
              <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                {data.completedQuantity}
              </p>
            </div>

            {data.putawayStatus && (
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Putaway Status
                </label>
                <div style={{ paddingTop: 4 }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                    data.putawayStatus === PUTAWAY_STATUS.COMPLETED
                      ? 'bg-emerald-100 text-emerald-800'
                      : data.putawayStatus === PUTAWAY_STATUS.QUARANTINED
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}>
                    {data.putawayStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Fulfillment Location
              </label>
              {isEditable ? (
                <LocationSelect
                  value={dto.locationId || ''}
                  disabled={actionLoading}
                  onChange={(val) => {
                    const nextVal = val || '';
                    updateField('locationId', nextVal);
                    saveField('locationId', nextVal);
                  }}
                  placeholder={tCommon('selectEllipsis')}
                />
              ) : (
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  {data.locationName}
                </p>
              )}
            </div>

            {isEditable && (
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Storage Zone
                </label>
                <select
                  className="input w-full"
                  value={selectedZone}
                  onChange={(e) => {
                    setSelectedZone(e.target.value);
                  }}
                  disabled={!dto.locationId || loadingBins || actionLoading || availableZones.length === 0}
                >
                  <option value="all">All Zones</option>
                  {availableZones.map((zCode) => (
                    <option key={zCode} value={zCode}>
                      Zone: {zCode}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                WIP Bin
              </label>
              {isEditable ? (
                <select
                  className="input w-full"
                  value={dto.wipBinId || ''}
                  onChange={(e) => {
                    updateField('wipBinId', e.target.value);
                    saveField('wipBinId', e.target.value);
                  }}
                  disabled={!dto.locationId || loadingBins || actionLoading}
                >
                  <option value="">{tWork('placeholders.unassigned')}</option>
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
              ) : (
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  {wipBinValue}
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tWork('labels.outputBin')}
              </label>
              {isEditable ? (
                <select
                  className="input w-full"
                  value={dto.outputBinId || ''}
                  onChange={(e) => {
                    updateField('outputBinId', e.target.value);
                    saveField('outputBinId', e.target.value);
                  }}
                  disabled={!dto.locationId || loadingBins || actionLoading}
                >
                  <option value="">{tWork('placeholders.unassigned')}</option>
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
              ) : (
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  {outputBinValue}
                </p>
              )}
            </div>

            {data.totalCost && (
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Total Cost
                </label>
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  ${parseFloat(data.totalCost).toFixed(2)}
                </p>
              </div>
            )}
            
            {data.createdOn && (
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Created On
                </label>
                <p className="text-sm truncate" style={{ fontWeight: 500, paddingTop: 6 }}>
                  {new Date(data.createdOn).toLocaleString()} {tCommon('by')} {data.createdBy || '—'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bill of Materials / Components Section */}
        <div className="card">
          <h3 className="section-heading mb-4">
            <span className="material-symbols-outlined">inventory_2</span>
            {tWork('lineItems')}
          </h3>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex overflow-x-auto shrink-0">
              <div className="flex gap-0 min-w-max">
                <Button
                  className="text-xs font-medium px-3 py-1.5 rounded-l-lg"
                  style={{
                    color: activeTab === 'lines' ? 'var(--accent)' : 'var(--text-muted)',
                    background: activeTab === 'lines' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === 'lines' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTab('lines')}
                >
                  Component Lines
                </Button>
                <Button
                  className="text-xs font-medium px-3 py-1.5 rounded-r-lg"
                  style={{
                    color: activeTab === 'availability' ? 'var(--accent)' : 'var(--text-muted)',
                    background: activeTab === 'availability' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === 'availability' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                    borderLeft: activeTab === 'availability' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTab('availability')}
                >
                  Stock Availability
                </Button>
              </div>
            </div>
          </div>

          {activeTab === 'lines' ? (
            <DataTable
              columns={componentColumns}
              data={data.components || []}
              keyExtractor={(comp) => comp.workOrderComponentId}
              emptyMessage="No components listed for this Work Order."
            />
          ) : (
            <WorkOrderAvailabilityTab
              locationId={data.locationId}
              components={(data.components || []).map((c) => ({
                productId: c.productId,
                productNumber: c.productNumber,
                productDescription: c.productName,
                expectedQuantity: c.expectedQuantity,
              }))}
              inventoryData={inventoryLevels}
              loading={inventoryLoading}
            />
          )}
        </div>

        {/* Activity / Event Audit Timeline */}
        <div className="card">
          <ActivityTimeline events={(data.events || []) as unknown as TimelineEvent[]} />
        </div>
      </div>
    </DetailsLayout>
  );
}
