import { useState, useEffect } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';

export interface SalesInvoiceDetails {
  invoiceId: string;
  invoiceNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  createdOn: string;
  totalAmount: string;
  taxAmount: string;
  outstandingAmount: string;
  currencyCode: string;
  stateCode: string;
  notes?: string;
  termsDescription?: string;
  earlyPaymentDiscount?: string | null;
  earlyPaymentDiscountDays?: number | null;
  events?: { eventId: string; eventType: string; payload: Record<string, unknown>; actor: string; createdOn: string }[];
  lines: Array<{
    lineId: string;
    productId: string;
    productNumber: string;
    description: string;
    quantityInvoiced: string;
    pricePerUnit: string;
    amount: string;
  }>;
  allocations?: {
    allocationId: string;
    allocatedAmount: string;
    paymentId: string;
    paymentNumber: string;
    paymentDate: string;
    currencyCode: string;
  }[];
}

export function useSalesInvoice(id: string) {
  const [invoice, setInvoice] = useState<SalesInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.invoiceDetailControllerGetSalesInvoiceDetails(id)
      .then((res) => {
        setInvoice((res.data as unknown) as SalesInvoiceDetails);
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
