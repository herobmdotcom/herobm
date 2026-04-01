'use client';

import { useState, useCallback } from 'react';
import { apiFetch, apiMutate, apiFetchBlob } from '../lib/api';

// ---------------------------------------------------------------------------
// Types (exported for sub-components)
// ---------------------------------------------------------------------------

export interface PickingSummaryLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productNumber?: string;
  productDescription: string;
  locationName: string;
  quantity: string;
  quantityPicked: string;
  quantityShipped: string;
  remaining: string;
  isFullyPicked: boolean;
  onHand: string;
  isPhysical?: boolean;
}

export interface PickingSummary {
  totalLines: number;
  fullyPickedLines: number;
  isFullyPicked: boolean;
  lines: PickingSummaryLine[];
}

export interface ShipmentLine {
  shipmentLineId: string;
  salesOrderLineId: string;
  quantityShipped: string;
}

export interface Shipment {
  shipmentId: string;
  shipmentNumber: string;
  salesOrderId: string;
  stateCode: string;
  notes: string | null;
  trackingNumber: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  lines: ShipmentLine[];
}

export interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productNumber?: string;
  productDescription: string;
  quantity: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePickingData(
  orderId: string,
  enableShippedFloorCheck: boolean,
  onOrderUpdated: (autoTransitions?: unknown[]) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tPicking: (...args: any[]) => string,
) {
  const [summary, setSummary] = useState<PickingSummary | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, _setError] = useState('');
  const setError = useCallback((msg: string) => {
    _setError(msg);
    if (msg) {
      import('react-hot-toast').then(({ toast }) => toast.error(msg));
    }
  }, []);

  // Data loading
  const loadPickingData = useCallback(async () => {
    try {
      const [summaryData, shipmentsData] = await Promise.all([
        apiFetch<PickingSummary>(`/api/sales-orders/${orderId}/picking`),
        apiFetch<Shipment[]>(`/api/sales-orders/${orderId}/shipments`),
      ]);
      setSummary(summaryData);
      setShipments(shipmentsData);
    } catch {
      setSummary(null);
      setShipments([]);
    } finally {
      setInitialLoading(false);
    }
  }, [orderId]);

  // Picking actions
  const pickLine = async (lineId: string, qty: string) => {
    setError('');
    if (enableShippedFloorCheck) {
      const line = summary?.lines.find((l) => l.salesOrderLineId === lineId);
      const shipped = parseFloat(line?.quantityShipped || '0');
      if (parseFloat(qty) < shipped) {
        setError(tPicking('errors.cannotReducePicked', { qty, shipped: String(shipped) }));
        return;
      }
    }
    try {
      await apiMutate(`/api/sales-orders/${orderId}/picking/lines/${lineId}`, 'PATCH', {
        quantityPicked: qty,
      });
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToUpdatePick'));
    }
  };

  const updateLineLocation = async (lineId: string, locationId: string) => {
    setError('');
    try {
      await apiMutate(`/api/sales-orders/${orderId}/picking/lines/${lineId}/location`, 'PATCH', {
        fulfillmentLocationId: locationId,
      });
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToUpdateLocation'));
    }
  };

  const pickAllForLine = async (lineId: string) => {
    setError('');
    try {
      await apiMutate(`/api/sales-orders/${orderId}/picking/lines/${lineId}/pick-all`, 'POST');
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToPickAll'));
    }
  };

  const pickAllOrder = async () => {
    setError('');
    try {
      await apiMutate(`/api/sales-orders/${orderId}/picking/pick-all`, 'POST');
      await loadPickingData();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToPickAll'));
    }
  };

  const printPickingSlip = async () => {
    setError('');
    try {
      const blob = await apiFetchBlob(`/api/reports/hooks/picking-slip/run?id=${orderId}&context=picking-slip`, { method: 'POST' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToGeneratePickingSlip'));
    }
  };

  // Shipment actions
  const createShipment = async (
    lines: Array<{ salesOrderLineId: string; quantityShipped: string }>,
    notes: string,
    trackingNumber: string,
  ) => {
    setError('');
    const filtered = lines.filter(
      (l) => l.quantityShipped && parseFloat(l.quantityShipped) > 0,
    );
    if (filtered.length === 0) {
      setError(tPicking('errors.atLeastOneLineRequired'));
      return false;
    }
    try {
      await apiMutate(`/api/sales-orders/${orderId}/shipments`, 'POST', {
        notes: notes || undefined,
        trackingNumber: trackingNumber || undefined,
        lines: filtered,
      });
      await loadPickingData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToCreateShipment'));
      return false;
    }
  };

  const changeShipmentState = async (shipmentId: string, newState: string) => {
    setError('');
    try {
      const response = await apiMutate<{ _autoTransitions?: unknown[] }>(
        `/api/sales-orders/${orderId}/shipments/${shipmentId}/state`,
        'PATCH',
        { stateCode: newState },
      );
      await loadPickingData();
      if (response?._autoTransitions?.length) {
        onOrderUpdated(response._autoTransitions);
      } else {
        onOrderUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToUpdateShipment'));
    }
  };

  const updateShipmentHeader = async (
    shipmentId: string,
    notes: string | null,
    trackingNumber: string | null,
  ) => {
    setError('');
    try {
      await apiMutate(
        `/api/sales-orders/${orderId}/shipments/${shipmentId}`,
        'PATCH',
        { notes, trackingNumber },
      );
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPicking('errors.failedToUpdateShipment'));
    }
  };

  return {
    summary,
    shipments,
    initialLoading,
    error,
    loadPickingData,
    pickLine,
    updateLineLocation,
    pickAllForLine,
    pickAllOrder,
    printPickingSlip,
    createShipment,
    changeShipmentState,
    updateShipmentHeader,
  };
}
