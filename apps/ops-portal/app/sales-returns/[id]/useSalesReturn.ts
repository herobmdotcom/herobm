import { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';

export interface SalesReturnDetails {
  returnId: string;
  returnNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  createdOn: string;
  currencyCode: string;
  stateCode: string;
  locationId?: string;
  locationName?: string;
  notes?: string;
  creditNoteNumber?: string;
  events?: { eventId: string; eventType: string; payload: Record<string, unknown>; actor: string; createdOn: string }[];
  lines: Array<{
    returnLineId: string;
    salesOrderLineId: string;
    productId: string;
    productNumber: string;
    description: string;
    quantityReturned: string;
    reason?: string;
    resolution?: string;
    returnFee?: string;
    feeMode?: string;
  }>;
}

export function useSalesReturn(id: string) {
  const [ret, setRet] = useState<SalesReturnDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReturn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.globalReturnsControllerFindOne(id);
      setRet((res.data as unknown) as SalesReturnDetails);
    } catch (err) {
      reportError(err, 'useSalesReturn');
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturn();
  }, [id]);

  return { ret, loading, saving, error, fetchReturn, setSaving, setError };
}
