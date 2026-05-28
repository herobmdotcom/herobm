import { useState, useEffect, useCallback } from 'react';
import * as api from '@modbm/sdk';

export function useTransferOrder(id: string) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Header edit state
  const [editNotes, setEditNotes] = useState('');
  const [editSourceLoc, setEditSourceLoc] = useState('');
  const [editDestLoc, setEditDestLoc] = useState('');

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const orderRes = await api.transfersControllerFindOne(id);
      const res = orderRes.data;
      setOrder(res);
      setEditNotes(res.notes || '');
      setEditSourceLoc(res.sourceLocationId || '');
      setEditDestLoc(res.destinationLocationId || '');
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load transfer order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const saveHeader = async () => {
    if (!order) return;
    if (order.notes === editNotes && order.sourceLocationId === editSourceLoc && order.destinationLocationId === editDestLoc) return;

    try {
      setSaving(true);
      await api.transfersControllerUpdate(id, {
        notes: editNotes !== order.notes ? editNotes : undefined,
        sourceLocationId: editSourceLoc !== order.sourceLocationId ? editSourceLoc : undefined,
        destinationLocationId: editDestLoc !== order.destinationLocationId ? editDestLoc : undefined,
      });
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const addLine = async (productId: string, quantity: number) => {
    try {
      setSaving(true);
      await api.transfersControllerAddLine(id, { productId, quantity: quantity.toString() });
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  const updateLine = async (lineId: string, quantity: number) => {
    try {
      setSaving(true);
      await api.transfersControllerUpdateLine(id, lineId, { quantity: quantity.toString() });
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to update line');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    try {
      setSaving(true);
      await api.transfersControllerRemoveLine(id, lineId);
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to remove line');
    } finally {
      setSaving(false);
    }
  };

  const shipOrder = async () => {
    try {
      setSaving(true);
      await api.transfersControllerShipTransferOrder(id, {} as unknown as import('@modbm/sdk').EmptyBodyDto);
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to ship order');
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    try {
      setSaving(true);
      await api.transfersControllerCancelTransferOrder(id, {} as unknown as import('@modbm/sdk').EmptyBodyDto);
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  };

  const receiveOrder = async (destinationBinId: string) => {
    try {
      setSaving(true);
      await api.transfersControllerReceiveTransferOrder(id, { destinationBinId });
      await loadOrder();
    } catch (e: any) {
      setError(e.message || 'Failed to receive order');
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
    loadOrder,
  };
}
