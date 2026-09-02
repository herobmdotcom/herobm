import { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';

export function useTransferOrder(id: string) {
  const [order, setOrder] = useState<api.TransferResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Header edit state
  const [editNotes, setEditNotes] = useState('');
  const [editShippingNotes, setEditShippingNotes] = useState('');
  const [editSourceLoc, setEditSourceLoc] = useState('');
  const [editDestLoc, setEditDestLoc] = useState('');

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const orderRes = await api.transfersControllerFindOne(id);
      const res = orderRes.data;
      setOrder(res);
      setEditNotes(res.notes || '');
      setEditShippingNotes(res.shippingNotes || '');
      setEditSourceLoc(res.sourceLocationId || '');
      setEditDestLoc(res.destinationLocationId || '');
      setError(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to load transfer order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const saveHeader = async () => {
    if (!order) return;
    if (order.notes === editNotes && order.shippingNotes === editShippingNotes && order.sourceLocationId === editSourceLoc && order.destinationLocationId === editDestLoc) return;

    try {
      setSaving(true);
      await api.transfersControllerUpdate(id, {
        notes: editNotes !== order.notes ? editNotes : undefined,
        shippingNotes: editShippingNotes !== order.shippingNotes ? editShippingNotes : undefined,
        sourceLocationId: editSourceLoc !== order.sourceLocationId ? editSourceLoc : undefined,
        destinationLocationId: editDestLoc !== order.destinationLocationId ? editDestLoc : undefined,
      });
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const addLine = async (productId: string, quantity: number) => {
    try {
      setSaving(true);
      await api.transfersControllerAddLine(id, { productId, quantity: quantity.toString() });
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  const updateLine = async (lineId: string, quantity: number) => {
    try {
      setSaving(true);
      await api.transfersControllerUpdateLine(id, lineId, { quantity: quantity.toString() });
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to update line');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    try {
      setSaving(true);
      await api.transfersControllerRemoveLine(id, lineId);
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to remove line');
    } finally {
      setSaving(false);
    }
  };

  const shipOrder = async () => {
    try {
      setSaving(true);
      await api.transfersControllerShipTransferOrder(id, {} as unknown as import('@herobm/sdk').EmptyBodyDto);
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to ship order');
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    try {
      setSaving(true);
      await api.transfersControllerCancelTransferOrder(id, {} as unknown as import('@herobm/sdk').EmptyBodyDto);
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  };

  const receiveOrder = async (lines: import('@herobm/sdk').ReceiveTransferLineDto[]) => {
    try {
      setSaving(true);
      await api.transfersControllerReceiveTransferOrder(id, { lines });
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to receive order');
    } finally {
      setSaving(false);
    }
  };

  const cancelShipment = async () => {
    try {
      setSaving(true);
      await api.transfersControllerCancelTransferOrderShipment(id, {} as unknown as import('@herobm/sdk').EmptyBodyDto);
      await loadOrder();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to cancel shipment');
    } finally {
      setSaving(false);
    }
  };

  return {
    order,
    loading,
    error,
    saving,
    clearError: () => setError(null),
    editNotes,
    setEditNotes,
    editShippingNotes,
    setEditShippingNotes,
    editSourceLoc,
    setEditSourceLoc,
    editDestLoc,
    setEditDestLoc,
    saveHeader,
    addLine,
    updateLine,
    removeLine,
    shipOrder,
    cancelOrder,
    receiveOrder,
    cancelShipment,
    loadOrder,
  };
}
