import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';

export interface SalesInvoiceDetails {
  invoiceId: string;
  invoiceNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  createdOn: string;
  totalAmount: string;
  taxAmount: string;
  outstandingAmount: string;
  currencyCode: string;
  stateCode: string;
  notes?: string;
  lines: Array<{
    lineId: string;
    productId: string;
    productNumber: string;
    description: string;
    quantityInvoiced: string;
    pricePerUnit: string;
    amount: string;
  }>;
}

export function useSalesInvoice(id: string) {
  const [invoice, setInvoice] = useState<SalesInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<SalesInvoiceDetails>(`/api/sales-invoices/${id}`)
      .then((data) => {
        setInvoice(data);
      })
      .catch((err) => {
        reportError(err, 'useSalesInvoice');
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return {
    invoice,
    loading,
    saving,
    error,
  };
}
