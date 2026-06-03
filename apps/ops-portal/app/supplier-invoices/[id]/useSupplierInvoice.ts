'use client';
import { getErrorMessage } from '@modbm/shared';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { formatAmount } from '@/lib/currency';
import { 
  PURCHASE_INVOICE_TRANSITIONS, 
  PURCHASE_INVOICE_LIFECYCLE, 
  getAllowedTransitions, 
  isBackTransition,
  MATCH_STATUS,
  PURCHASE_INVOICE_STATE
} from '@modbm/shared';

export interface PurchaseInvoiceDetails {
  invoiceId: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  vendorId: string;
  vendorName?: string;
  purchaseOrderId?: string;
  receiptFilename?: string;
  totalAmount: string;
  taxAmount: string;
  currencyCode: string;
  stateCode: string;
  notes?: string;
  createdOn: string;
  lines: {
    lineId: string;
    description: string;
    productId?: string;
    productNumber?: string;
    glAccountId?: string;
    purchaseOrderId?: string;
    purchaseOrderNumber?: string;
    purchaseOrderLineId?: string;
    matchStatus: string;
    quantityInvoiced: string;
    pricePerUnit: string;
    amount: string;
    poLineQuantityOrdered?: string;
    poLineQuantityReceived?: string;
    poLinePricePerUnit?: string;
  }[];
  allocations?: {
    allocationId: string;
    allocatedAmount: string;
    paymentId: string;
    paymentNumber: string;
    paymentDate: string;
    currencyCode: string;
  }[];
}

export function useSupplierInvoice(id: string) {
  const router = useRouter();
  const tCommon = useTranslations('common');

  const [invoice, setInvoice] = useState<PurchaseInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isMatchingMode, setIsMatchingMode] = useState(false);
  const [selectedInvoiceLineId, setSelectedInvoiceLineId] = useState<string | null>(null);
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [pendingState, setPendingState] = useState<string | null>(null);
  // Prepare invoice lines for the matching panel
  const matchingPanelLines = useMemo(() => {
    return (invoice?.lines || []).map((l) => ({
      lineId: l.lineId,
      matchStatus: l.matchStatus,
      productId: l.productId,
      productNumber: l.productNumber,
      description: l.description,
      purchaseOrderLineId: l.purchaseOrderLineId,
      purchaseOrderNumber: l.purchaseOrderNumber,
    }));
  }, [invoice?.lines]);

  const [discrepanciesAcknowledged, setDiscrepanciesAcknowledged] = useState(false);

  const [editSupplierInvoiceNumber, setEditSupplierInvoiceNumber] = useState('');
  const [editReceiptFilename, setEditReceiptFilename] = useState('');
  const [editCurrencyCode, setEditCurrencyCode] = useState('');
  const [editTaxAmount, setEditTaxAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editVendorId, setEditVendorId] = useState('');
  const [glAccounts, setGlAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [headerDirty, setHeaderDirty] = useState(false);

  const loadInvoice = () => {
    setLoading(true);
    api.invoiceDetailControllerGetPurchaseBillDetails(id)
      .then((res: any) => {
        const data = (res as any).data ? (res as any).data : res;
        setInvoice(data);
        setEditSupplierInvoiceNumber(data.supplierInvoiceNumber || '');
        setEditReceiptFilename(data.receiptFilename || '');
        setEditCurrencyCode(data.currencyCode ?? 'EUR');
        setEditTaxAmount(data.taxAmount || '0.00');
        setEditNotes(data.notes || '');
        setEditVendorId(data.vendorId || '');
        setHeaderDirty(false);
      })
      .catch(err => reportError(err, 'useSupplierInvoice'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoice();
    api.glControllerGetAccounts({} as unknown as Parameters<typeof api.glControllerGetAccounts>[0])
      .then((res: unknown) => setGlAccounts(((res as { data: unknown[] }).data as unknown as api.GlAccountResponseDto[]) || []))
      .catch(err => reportError(err, 'useSupplierInvoice'));
  }, [id, refreshKey]);

  useEffect(() => {
    if (!invoice) return;
    const changed = 
      editSupplierInvoiceNumber !== (invoice.supplierInvoiceNumber || '') ||
      editReceiptFilename !== (invoice.receiptFilename || '') ||
      editCurrencyCode !== (invoice.currencyCode ?? 'EUR') ||
      parseFloat(editTaxAmount || '0').toFixed(2) !== parseFloat(invoice.taxAmount || '0').toFixed(2) ||
      editNotes !== (invoice.notes || '') ||
      editVendorId !== (invoice.vendorId || '');
    setHeaderDirty(changed);
  }, [editSupplierInvoiceNumber, editReceiptFilename, editCurrencyCode, editTaxAmount, editNotes, editVendorId, invoice]);

  const saveHeader = async (overrideVendorId?: string | any) => {
    const newVendorId = typeof overrideVendorId === 'string' ? overrideVendorId : null;
    if (!headerDirty && !newVendorId) return;
    if (!invoice) return;
    setSaving(true);
    try {
      await api.invoiceDetailControllerUpdateInvoice(id, {
        supplierInvoiceNumber: editSupplierInvoiceNumber || null,
        receiptFilename: editReceiptFilename || null,
        currencyCode: editCurrencyCode ?? 'EUR',
        taxAmount: editTaxAmount || '0.00',
        notes: editNotes || null,
        vendorId: newVendorId || editVendorId || invoice.vendorId,
      } as unknown as import('@modbm/sdk').UpdatePurchaseInvoiceDto);
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const changeState = async (newState: string, acknowledgedOverride?: boolean) => {
    const isForward = !isBackTransition(PURCHASE_INVOICE_LIFECYCLE, invoice?.stateCode || '', newState) && newState !== 'cancelled';
    const isAcknowledged = acknowledgedOverride ?? discrepanciesAcknowledged;

    if (isForward && discrepancies.length > 0 && !isAcknowledged) {
      setPendingState(newState);
      setShowDiscrepancyModal(true);
      return;
    }

    try {
      await api.invoiceDetailControllerChangeInvoiceState(id, { 
        stateCode: newState,
        discrepanciesAcknowledged: discrepancies.length > 0 ? isAcknowledged : undefined
      } as unknown as Parameters<typeof api.invoiceDetailControllerChangeInvoiceState>[1]);
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to change state');
    }
  };

  const handleAutoMatch = async (purchaseOrderId: string) => {
    try {
      await api.invoiceDetailControllerAutoMatchPurchaseOrder(id, { purchaseOrderId });
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to auto-match PO');
    }
  };

  const handlePanelMatch = async (invoiceLineId: string, purchaseOrderLineId: string) => {
    try {
      await api.invoiceDetailControllerResolveInvoiceLine(invoiceLineId, { purchaseOrderLineId });
      loadInvoice();
      const nextUnmatched = invoice?.lines.find(
        (l) => l.lineId !== invoiceLineId && l.matchStatus !== MATCH_STATUS.MATCHED
      );
      setSelectedInvoiceLineId(nextUnmatched?.lineId || null);
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to match line');
    }
  };

  const updateLine = async (lineId: string, field: string, value: string) => {
    setSaving(true);
    try {
      await api.invoiceDetailControllerUpdateInvoiceLine(id, lineId, { [field]: value });
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to update line');
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId: string) => {
    if (!confirm('Are you sure you want to remove this line?')) return;
    setSaving(true);
    try {
      await api.invoiceDetailControllerRemoveInvoiceLine(id, lineId);
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to remove line');
    } finally {
      setSaving(false);
    }
  };

  const addBlankLine = async () => {
    setSaving(true);
    try {
      await api.invoiceDetailControllerAddInvoiceLine(id, { description: '', quantityInvoiced: 1, pricePerUnit: 0 });
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to add line');
    } finally {
      setSaving(false);
    }
  };

  const addRoundingLine = async () => {
    setSaving(true);
    try {
      await api.invoiceDetailControllerAddInvoiceLine(id, { description: 'Rounding Adjustment', quantityInvoiced: 1, pricePerUnit: 0 });
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to add rounding line');
    } finally {
      setSaving(false);
    }
  };

  const handleProductSelect = async (lineId: string, product: { productId: string; productNumber: string; name: string }) => {
    setSaving(true);
    try {
      await api.invoiceDetailControllerUpdateInvoiceLine(id, lineId, {
        productId: product.productId,
        description: product.name,
      });
      loadInvoice();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to set product');
    } finally {
      setSaving(false);
    }
  };

  const handleUnresolve = async (lineId: string) => {
    if (!confirm('Are you sure you want to change this allocation?')) return;
    try {
      await api.invoiceDetailControllerUnresolveInvoiceLine(lineId, { method: 'POST' });
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to unresolve allocation');
    }
  };

  const discrepancies = useMemo(() => {
    if (!invoice) return [];
    const issues: { lineId: string; type: string; message: string; severity: 'warning' | 'error' }[] = [];
    
    invoice.lines.forEach((line, idx) => {
      if (line.matchStatus !== MATCH_STATUS.MATCHED && !line.purchaseOrderLineId && parseFloat(line.amount || '0') > 0) {
        issues.push({
          lineId: line.lineId,
          type: 'unplanned_line',
          message: `Line ${idx + 1} is an unplanned expense not linked to a Purchase Order.`,
          severity: 'warning'
        });
      }

      if (line.matchStatus === MATCH_STATUS.MATCHED && line.purchaseOrderLineId) {
        const billedQty = parseFloat(line.quantityInvoiced || '0');
        const poReceived = parseFloat(line.poLineQuantityReceived || '0');
        const billedPrice = parseFloat(line.pricePerUnit || '0');
        const poPrice = parseFloat(line.poLinePricePerUnit || '0');

        if (Math.abs(billedPrice - poPrice) > 0.001) {
          issues.push({
            lineId: line.lineId,
            type: 'price_variance',
            message: `Line ${idx + 1} unit price (${formatAmount(billedPrice, invoice.currencyCode)}) differs from PO unit price (${formatAmount(poPrice, invoice.currencyCode)}).`,
            severity: 'error'
          });
        }

        if (billedQty > poReceived) {
          issues.push({
            lineId: line.lineId,
            type: 'quantity_variance',
            message: `Line ${idx + 1} billed quantity (${billedQty}) exceeds the received quantity (${poReceived}).`,
            severity: 'error'
          });
        }
      }
    });
    return issues;
  }, [invoice]);

  const allowedTransitions = useMemo(() => {
    if (!invoice) return [];
    return getAllowedTransitions(PURCHASE_INVOICE_TRANSITIONS, invoice.stateCode)
      .filter(state => ![PURCHASE_INVOICE_STATE.PAID, PURCHASE_INVOICE_STATE.PARTIALLY_PAID].some(s => s === state));
  }, [invoice?.stateCode]);

  return {
    invoice,
    loading,
    saving,
    refreshKey,
    isMatchingMode,
    setIsMatchingMode,
    selectedInvoiceLineId,
    setSelectedInvoiceLineId,
    showDiscrepancyModal,
    setShowDiscrepancyModal,
    pendingState,
    setPendingState,
    discrepanciesAcknowledged,
    setDiscrepanciesAcknowledged,
    editSupplierInvoiceNumber,
    setEditSupplierInvoiceNumber,
    editReceiptFilename,
    setEditReceiptFilename,
    editCurrencyCode,
    setEditCurrencyCode,
    editTaxAmount,
    setEditTaxAmount,
    editNotes,
    setEditNotes,
    editVendorId,
    setEditVendorId,
    glAccounts,
    headerDirty,
    discrepancies,
    matchingPanelLines,
    allowedTransitions,
    saveHeader,
    changeState,
    handleAutoMatch,
    handlePanelMatch,
    updateLine,
    removeLine,
    addBlankLine,
    addRoundingLine,
    handleProductSelect,
    handleUnresolve,
    loadInvoice
  };
}
