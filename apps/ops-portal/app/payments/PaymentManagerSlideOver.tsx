'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsProvider';
import { formatAmount } from '@/lib/currency';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import {
  PAYMENT_STATE, 
  SALES_INVOICE_STATE, 
  PURCHASE_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_STATE
} from '@modbm/shared';

import SupplierSelect from '@/components/shared/SupplierSelect';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import PartialAllocationModal from './PartialAllocationModal';

const ToggleCell = (p: any) => {
  const data = p.data;
  const context = p.context;
  
  if (!data || !context) return null;
  const { handleToggle, t } = context;

  const isAllocated = data.pendingAllocation > 0;

  return (
    <div className="flex items-center gap-3 mt-1">
      <button
        type="button"
        onClick={() => handleToggle(data)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          isAllocated ? 'bg-[var(--accent)]' : 'bg-gray-300'
        }`}
        aria-checked={isAllocated}
        role="switch"
        title={isAllocated ? t("manager.messages.clickToRemoveAllocation") : t("manager.messages.clickToAutoAllocateMax")}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isAllocated ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
import CustomerSelect from '@/components/shared/CustomerSelect';
import GLAccountSelect from '@/components/shared/GLAccountSelect';
import { getErrorMessage } from '@modbm/shared';

interface Props {
  paymentId: string | null;
  onClose: () => void;
  onSaved: (close?: boolean) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

interface Allocation {
  allocationId: string;
  referenceType: 'sales_invoice' | 'purchase_invoice';
  referenceId: string;
  invoiceNumber?: string;
  allocatedAmount: string;
}

interface PaymentData {
  paymentId: string;
  paymentNumber: string;
  paymentType: string;
  partyId: string;
  partyName?: string;
  paymentDate: string;
  modeOfPayment: string;
  totalAmount: string;
  unallocatedAmount: string;
  stateCode: string;
  currencyCode: string;
  glAccountBank: string;
  referenceNumber?: string;
  allocations: Allocation[];
  lines?: { accountId: string; amount: string; memo: string; accountName: string }[];
}

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  outstandingAmount: string;
  date: string;
  referenceType: 'sales_invoice' | 'purchase_invoice' | 'sales_credit_note' | 'purchase_debit_note';
  // Local state for allocation editing
  pendingAllocation: number;
}

export default function PaymentManagerSlideOver({ paymentId, onClose, onSaved, onNext, onPrev }: Props) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const { baseCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [journalEntry, setJournalEntry] = useState<any | null>(null);
  const [data, setData] = useState<PaymentData | null>(null);
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Record<string, unknown> | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  
  // Creation Form State
  const [form, setForm] = useState({
    paymentType: 'customer_receipt',
    partyId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    modeOfPayment: 'EFT',
    totalAmount: '',
    glAccountBank: '',
    currencyCode: baseCurrency,
    referenceNumber: '',
    lines: [] as { id: string; accountId: string; amount: string; memo: string }[],
  });

  // Allocation State
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const loadPayment = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    try {
      const res = (await api.paymentsControllerFindOne(paymentId)).data as unknown as PaymentData;
      setData(res);

      if (res.stateCode === PAYMENT_STATE.SUBMITTED) {
        setLoadingJournal(true);
        api.glControllerGetJournalEntryBySource('payment_entry', paymentId)
          .then(jrnl => setJournalEntry((jrnl as any).data))
          .catch(err => reportError(err, 'PaymentManagerSlideOver.loadLedgerImpact'))
          .finally(() => setLoadingJournal(false));
      } else {
        setJournalEntry(null);
      }
    } catch (err) {
      reportError(err, 'PaymentManagerSlideOver.loadPayment');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (paymentId) {
      loadPayment();
    } else {
      setData(null);
      setJournalEntry(null);
      setIsAllocating(false);
      setForm({
        paymentType: 'customer_receipt',
        partyId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        modeOfPayment: 'EFT',
        totalAmount: '',
        glAccountBank: '',
        currencyCode: baseCurrency,
        referenceNumber: '',
        lines: [],
      });
    }
  }, [paymentId, baseCurrency, loadPayment]);

  // Load outstanding invoices for allocation
  const loadOutstandingInvoices = useCallback(async () => {
    if (!data || data.stateCode !== PAYMENT_STATE.SUBMITTED) return;

    if (parseFloat(data.unallocatedAmount) <= 0) {
      setOutstandingInvoices([]);
      return;
    }

    if (data.paymentType.startsWith('direct_')) {
      setOutstandingInvoices([]);
      return;
    }
    
    setLoadingInvoices(true);
    try {
      const isCustomer = data.paymentType.startsWith('customer_');
      let referenceType: 'sales_invoice' | 'purchase_invoice' | 'sales_credit_note' | 'purchase_debit_note' = 'sales_invoice';
      let res: any;
      if (data.paymentType === 'customer_receipt') {
        res = await api.invoiceDetailControllerGetSalesInvoicesGlobal({ customerId: data.partyId, balanceStatus: 'unpaid' });
        referenceType = 'sales_invoice';
      } else if (data.paymentType === 'customer_refund') {
        res = await api.salesCreditNotesControllerFindAll({ customerId: data.partyId, balanceStatus: 'unpaid' });
        referenceType = 'sales_credit_note';
      } else if (data.paymentType === 'supplier_payment') {
        res = await api.invoiceDetailControllerGetPurchaseInvoicesGlobal({ vendorId: data.partyId, balanceStatus: 'unpaid' });
        referenceType = 'purchase_invoice';
      } else if (data.paymentType === 'supplier_refund') {
        res = await api.purchaseDebitNotesControllerFindAll({ vendorId: data.partyId, balanceStatus: 'unpaid' });
        referenceType = 'purchase_debit_note';
      }
      
      const invoices = (res as any).data
        .filter((inv: any) => {
          if (
            inv.stateCode === SALES_INVOICE_STATE.PAID ||
            inv.stateCode === PURCHASE_INVOICE_STATE.PAID ||
            inv.stateCode === SALES_CREDIT_NOTE_STATE.POSTED ||
            inv.stateCode === PURCHASE_DEBIT_NOTE_STATE.POSTED
          ) {
            return false;
          }
          return parseFloat(inv.outstandingAmount) > 0;
        })
        .map((inv: any) => ({
          id: inv.invoiceId || inv.creditNoteId || inv.debitNoteId,
          invoiceNumber: inv.invoiceNumber || inv.creditNoteNumber || inv.debitNoteNumber,
          totalAmount: inv.totalAmount,
          outstandingAmount: inv.outstandingAmount,
          date: inv.invoiceDate || inv.createdOn,
          referenceType,
          pendingAllocation: 0,
        }));
      
      setOutstandingInvoices(invoices);
    } catch (err) {
      reportError(err, 'PaymentManagerSlideOver.loadInvoices');
    } finally {
      setLoadingInvoices(false);
    }
  }, [data]);

  useEffect(() => {
    if (data?.stateCode === PAYMENT_STATE.SUBMITTED) {
      loadOutstandingInvoices();
    }
  }, [data?.stateCode, data?.unallocatedAmount, loadOutstandingInvoices]);

  const handleToggle = useCallback((invoice: any) => {
    if (!data) return;
    setOutstandingInvoices(prev => prev.map(p => {
      if (p.id !== invoice.id) return p;
      if (p.pendingAllocation > 0) {
        return { ...p, pendingAllocation: 0 };
      } else {
        // Calculate remaining unallocated excluding this invoice
        const currentAllocated = prev.reduce((sum, item) => sum + (item.id === invoice.id ? 0 : item.pendingAllocation), 0);
        const maxAvailable = parseFloat(data.unallocatedAmount) - currentAllocated;
        const toAllocate = Math.min(parseFloat(p.outstandingAmount), Math.max(0, maxAvailable));
        return { ...p, pendingAllocation: toAllocate };
      }
    }));
  }, [data]);

  const allocationColumns = useMemo<ColDef[]>(() => [
    { 
      field: 'date', 
      headerName: t('manager.columns.date'), 
      width: 140,
      valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString() : ''
    },
    { field: 'invoiceNumber', headerName: t('manager.columns.invoiceNo'), flex: 1 },
    { 
      field: 'outstandingAmount', 
      headerName: t('manager.columns.outstanding'), 
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => data ? formatAmount(parseFloat(p.value), data.currencyCode) : ''
    },
    { 
      field: 'pendingAllocation', 
      headerName: t('manager.columns.allocated'), 
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => p.value > 0 && data ? formatAmount(p.value, data.currencyCode) : ''
    },
    {
      headerName: t('manager.columns.allocate'),
      cellRenderer: ToggleCell,
      width: 100,
      suppressSizeToFit: true,
      sortable: false,
      filter: false,
    }
  ], [data, t]);

  const totalAllocatedNow = outstandingInvoices.reduce((sum, i) => sum + i.pendingAllocation, 0);
  const remainingToAllocate = data ? parseFloat(data.unallocatedAmount) - totalAllocatedNow : 0;

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        paymentId: crypto.randomUUID(),
        partyId: form.partyId || undefined,
        totalAmount: parseFloat(form.totalAmount),
        lines: form.lines && form.lines.length > 0 && form.paymentType.startsWith('direct_') ? form.lines.map(l => ({
          accountId: l.accountId,
          amount: parseFloat(l.amount) || 0,
          memo: l.memo
        })) : undefined,
        submitImmediately: true,
      };
      await api.paymentsControllerCreate(payload as unknown as Parameters<typeof api.paymentsControllerCreate>[0]);
      toast.success(t('manager.messages.paymentCreated'));
      onSaved();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('manager.messages.failedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLine = () => {
    setForm({
      ...form,
      lines: [...form.lines, { id: Math.random().toString(), accountId: '', amount: '', memo: '' }]
    });
  };

  const handleRemoveLine = (id: string) => {
    setForm({
      ...form,
      lines: form.lines.filter(l => l.id !== id)
    });
  };

  const handleLineChange = (id: string, field: string, value: string) => {
    setForm(prev => {
      const newLines = prev.lines.map(l => l.id === id ? { ...l, [field]: value } : l);
      
      // Auto-compute total if we're changing amounts
      let newTotal = prev.totalAmount;
      if (field === 'amount') {
        const sum = newLines.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
        newTotal = sum > 0 ? sum.toFixed(2) : prev.totalAmount;
      }
      
      return {
        ...prev,
        lines: newLines,
        totalAmount: newTotal
      };
    });
  };

  const handleSubmitPayment = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    try {
      await api.paymentsControllerSubmit(paymentId, {});
      toast.success(t('manager.messages.paymentSubmitted'));
      loadPayment();
      onSaved(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!paymentId) return;
    
    const isDraft = data?.stateCode === PAYMENT_STATE.DRAFT;
    const message = isDraft 
      ? t('manager.messages.deleteDraftConfirm') 
      : t('manager.messages.reversePaymentConfirm');
    
    if (!confirm(message)) return;
    
    setSubmitting(true);
    try {
      await api.paymentsControllerCancel(paymentId, {});
      toast.success(t('manager.messages.paymentCancelled'));
      loadPayment();
      onSaved(); // Refresh grid
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualAllocateChange = (id: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setOutstandingInvoices(prev => prev.map(inv => 
      inv.id === id ? { ...inv, pendingAllocation: amount } : inv
    ));
  };

  const submitAllocations = async () => {
    if (!paymentId) return;
    const allocations = outstandingInvoices
      .filter(inv => inv.pendingAllocation > 0)
      .map(inv => ({
        referenceType: inv.referenceType,
        referenceId: inv.id,
        allocatedAmount: inv.pendingAllocation,
      }));

    if (allocations.length === 0) return;

    // Check total allocation doesn't exceed unallocated
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    if (totalAllocated > parseFloat(data?.unallocatedAmount || '0')) {
      toast.error(t('manager.messages.allocationExceedsUnallocated'));
      return;
    }

    setSubmitting(true);
    try {
      await api.paymentsControllerAllocate(paymentId, { allocations: allocations as unknown as Parameters<typeof api.paymentsControllerAllocate>[1]['allocations'] });
      toast.success(t('manager.messages.allocationsSaved'));
      loadPayment();
      onSaved(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isDraft = data?.stateCode === PAYMENT_STATE.DRAFT;
  const isSubmitted = data?.stateCode === PAYMENT_STATE.SUBMITTED;

  const actionsContent = (
    <div className="flex items-center gap-2">
      {/* Lifecycle Actions */}
      {isDraft && (
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCancelPayment}
            disabled={submitting}
            className="btn btn-secondary btn-sm"
          >
            {tCommon('cancel')}
          </button>
          <button 
            onClick={handleSubmitPayment}
            disabled={submitting}
            className="btn btn-primary btn-sm"
          >
            {tCommon('submit')}
          </button>
        </div>
      )}

      {isSubmitted && (
        <div className="flex items-center gap-2">
          {(!data?.allocations || data.allocations.length === 0) && (
            <button 
              onClick={handleCancelPayment}
              disabled={submitting}
              className="btn btn-secondary btn-sm"
            >
              {t('manager.buttons.reverse')}</button>
          )}
          {(!data?.paymentType?.startsWith('direct_') && (parseFloat(data?.unallocatedAmount || '0') > 0 || isAllocating)) && (
            <button 
              onClick={() => setIsAllocating(!isAllocating)}
              className={`btn btn-sm ${isAllocating ? 'btn-secondary' : 'btn-primary'}`}
            >
              {isAllocating ? t('view') : t('allocate')}
            </button>
          )}
        </div>
      )}

      {/* Vertical Separator */}
      {paymentId && (
        <>
          <div className="w-px h-4 bg-[var(--border)] mx-1" />
          
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button 
              onClick={onPrev} 
              disabled={!onPrev}
              className="btn btn-secondary btn-sm p-1 min-w-0"
              title={t('manager.buttons.previousPayment')}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button 
              onClick={onNext} 
              disabled={!onNext}
              className="btn btn-secondary btn-sm p-1 min-w-0"
              title={t('manager.buttons.nextPayment')}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <SlideOver
      isOpen={true}
      onClose={onClose}
      title={paymentId ? (data?.paymentNumber || '...') : t('manager.newEntry')}
      subtitle={paymentId && data ? `${new Date(data.paymentDate).toLocaleDateString()} · ${t(('manager.options.' + data.paymentType.replace(/_([a-z])/g, g => g[1].toUpperCase())) as Parameters<typeof t>[0])}` : undefined}
      actions={paymentId ? actionsContent : undefined}
      width="max-w-3xl"
      footer={!paymentId ? (
        <div className="flex items-center justify-end gap-3 w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {tCommon('cancel')}
          </button>
          <button type="submit" form="create-payment-form" className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm" disabled={submitting}>
            {submitting ? (
              <><span className="loading loading-spinner loading-sm mr-2" />{tCommon('saving')}</>
            ) : (
              t('createEntry')
            )}
          </button>
        </div>
      ) : undefined}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 opacity-50">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
            <p className="text-sm font-medium">{t('loadingEllipsis')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {!paymentId ? (
              <form id="create-payment-form" onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.type')}</label>
                    <select 
                      className="input w-full"
                      value={form.paymentType}
                      onChange={e => {
                        const payType = e.target.value;
                        setForm({
                          ...form, 
                          paymentType: payType,
                          partyId: '', // Reset selected party when type changes
                          lines: payType.startsWith('direct_') && form.lines.length === 0 
                            ? [{ id: Math.random().toString(), accountId: '', amount: '', memo: '' }] 
                            : form.lines
                        });
                      }}
                      required
                    >
                      <option value="customer_receipt">{t('manager.options.customerReceipt')}</option>
                      <option value="supplier_payment">{t('manager.options.supplierPayment')}</option>
                      <option value="customer_refund">{t('manager.options.customerRefund')}</option>
                      <option value="supplier_refund">{t('manager.options.supplierRefund')}</option>
                      <option value="direct_receipt">{t('manager.options.directReceipt')}</option>
                      <option value="direct_payment">{t('manager.options.directPayment')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.mode')}</label>
                    <select 
                      className="input w-full"
                      value={form.modeOfPayment}
                      onChange={e => setForm({...form, modeOfPayment: e.target.value})}
                      required
                    >
                      <option value="Cash">{t('manager.options.cash')}</option>
                      <option value="EFT">{t('manager.options.eft')}</option>
                      <option value="Credit Card">{t('manager.options.creditCard')}</option>
                      <option value="Cheque">{t('manager.options.cheque')}</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.reference')}</label>
                  <input 
                    type="text"
                    className="input w-full"
                    value={form.referenceNumber}
                    onChange={e => setForm({...form, referenceNumber: e.target.value})}
                    placeholder={t('manager.placeholders.reference')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.glBank')}</label>
                  <GLAccountSelect 
                    value={form.glAccountBank}
                    onChange={(val, acc) => setForm({
                      ...form, 
                      glAccountBank: val || '',
                      currencyCode: acc?.currencyCode || form.currencyCode
                    })}
                    bankAccountOnly={true}
                    required
                  />
                  {form.glAccountBank && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-1">
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)]">payments</span>
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
                        {t('manager.labels.settlementCurrency')}: <span className="text-[var(--accent)]">{form.currencyCode}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  {!form.paymentType.startsWith('direct_') && (
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">
                      {form.paymentType.startsWith('customer_') ? t('customer') : t('supplier')}
                    </label>
                  )}
                  {form.paymentType.startsWith('customer_') ? (
                    <CustomerSelect 
                      value={form.partyId}
                      onChange={(acc) => setForm({
                        ...form, 
                        partyId: acc?.customerId || '', 
                        currencyCode: form.glAccountBank ? form.currencyCode : (acc?.currencyCode || baseCurrency)
                      })}
                      required
                    />
                  ) : form.paymentType.startsWith('supplier_') ? (
                    <SupplierSelect 
                      value={form.partyId}
                      onChange={(sup) => setForm({
                        ...form, 
                        partyId: sup?.vendorId || '', 
                        currencyCode: form.glAccountBank ? form.currencyCode : (sup?.currencyCode || baseCurrency)
                      })}
                      required
                    />
                  ) : (
                    <>
                      <div className="mt-6">
                        <table className="table-lines w-full text-sm">
                          <thead>
                            <tr>
                              <th>{t('manager.labels.glAccount')}</th>
                              <th style={{ width: '140px' }}>{t('manager.labels.amount')}</th>
                              <th>{t('manager.labels.memo')}</th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.lines.map((line) => (
                              <tr key={line.id}>
                                <td className="py-2 pr-2">
                                  <GLAccountSelect
                                    value={line.accountId}
                                    onChange={(val) => handleLineChange(line.id, 'accountId', val || '')}
                                    bankAccountOnly={false}
                                    required
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="input input-sm w-full"
                                    value={line.amount}
                                    onChange={(e) => handleLineChange(line.id, 'amount', e.target.value)}
                                    required
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    className="input input-sm w-full"
                                    value={line.memo}
                                    onChange={(e) => handleLineChange(line.id, 'memo', e.target.value)}
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-circle btn-ghost text-[var(--text-muted)] hover:text-[var(--danger)]"
                                    onClick={() => handleRemoveLine(line.id)}
                                    disabled={form.lines.length === 1}
                                    title={form.lines.length === 1 ? "At least one line is required" : "Remove Line"}
                                  >
                                    {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 text-left">
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost text-[var(--accent)]"
                            onClick={handleAddLine}
                          >
                            {t('manager.buttons.addLine')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.totalAmount')}</label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.01"
                        className="input w-full pr-12"
                        value={form.totalAmount}
                        onChange={e => setForm({...form, totalAmount: e.target.value})}
                        required
                        readOnly={form.paymentType.startsWith('direct_')}
                        title={form.paymentType.startsWith('direct_') ? "Total amount is calculated from the lines below" : undefined}
                        placeholder={t('manager.placeholders.amount')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-40">
                        {form.currencyCode}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1">{t('manager.labels.date')}</label>
                    <input 
                      type="date"
                      className="input w-full"
                      value={form.paymentDate}
                      onChange={e => setForm({...form, paymentDate: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </form>            ) : (
              <div className="space-y-6">
                {!isAllocating ? (
                  <>
                    {/* Metadata Section (Mirror GL View) */}
                    <div className="card space-y-3 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div>
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('manager.labels.party')}</span>
                          <span className="text-[#041627] font-medium">{data?.partyName || '—'}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('manager.labels.status')}</span>
                          <StateBadge state={data?.stateCode as ValidState} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('manager.labels.mode')}</span>
                          <span className="text-[#041627] font-medium">{data?.modeOfPayment}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('manager.labels.reference')}</span>
                          <span className="text-[#041627]">{data?.referenceNumber || '—'}</span>
                        </div>
                        {!data?.paymentType?.startsWith('direct_') && (
                          <div>
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('manager.labels.unallocatedAmount')}</span>
                            <span className="text-[var(--accent)] font-bold">{formatAmount(parseFloat(data?.unallocatedAmount || '0'), data?.currencyCode || baseCurrency)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direct Payment Lines */}
                    {data?.paymentType?.startsWith('direct_') && data.lines && data.lines.length > 0 && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3">{t('manager.labels.glAccount')}</th>
                                <th className="px-5 py-3 text-right">{t('manager.labels.amount')}</th>
                                <th className="px-5 py-3">{t('manager.labels.memo')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {data.lines.map((l: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-5 py-3">
                                    <div>{l.accountName}</div>
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    {formatAmount(parseFloat(l.amount), data.currencyCode)}
                                  </td>
                                  <td className="px-5 py-3">{l.memo || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Ledger Impact */}
                    {isSubmitted && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          {loadingJournal ? (
                            <div className="flex justify-center items-center py-12">
                              <span className="loading loading-spinner text-gray-400"></span>
                            </div>
                          ) : journalEntry?.lines ? (
                            <table className="w-full text-sm text-left">
                              <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                                <tr>
                                  <th className="px-5 py-3">{t('manager.columns.customer')}</th>
                                  <th className="px-5 py-3 text-right">{t('manager.columns.debit')}</th>
                                  <th className="px-5 py-3 text-right">{t('manager.columns.credit')}</th>
                                  <th className="px-5 py-3">{t('manager.columns.memo')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {journalEntry.lines.map((l: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                      <div>{l.accountCode} - {l.accountName}</div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                      {parseFloat(l.debit) > 0 ? formatAmount(parseFloat(l.debit), journalEntry.currencyCode) : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                      {parseFloat(l.credit) > 0 ? formatAmount(parseFloat(l.credit), journalEntry.currencyCode) : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                      {l.memo || '—'}
                                    </td>
                                  </tr>
                                ))}
                                {/* Totals Row */}
                                <tr className="bg-[#f8f9fa] border-t-2 border-gray-200">
                                  <td className="px-5 py-3 text-right uppercase tracking-wider text-xs">
                                    {t('manager.messages.total')}
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    {formatAmount(journalEntry.lines.reduce((s: number, l: any) => s + parseFloat(l.debit || '0'), 0), journalEntry.currencyCode)}
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    {formatAmount(journalEntry.lines.reduce((s: number, l: any) => s + parseFloat(l.credit || '0'), 0), journalEntry.currencyCode)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-8 text-center text-gray-500 text-sm">
                              {t('manager.messages.noLedgerLines')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Allocation History */}
                    {data?.allocations && data.allocations.length > 0 && (
                      <div className="mt-6">
                        <h3 className="section-heading mb-3">
                          {/* eslint-disable-next-line i18next/no-literal-string */}
                          <span className="material-symbols-outlined">history</span>
                          {t('manager.messages.allocationHistory')}
                        </h3>
                        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3">{t('manager.columns.invoice')}</th>
                                <th className="px-5 py-3">{t('manager.columns.type')}</th>
                                <th className="px-5 py-3 text-right">{t('manager.columns.allocatedAmount')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {data.allocations.map((a) => {
                                const isSalesInv = a.referenceType as string === 'sales_invoice';
                                const isCreditNote = a.referenceType as string === 'sales_credit_note';
                                const isPurchInv = a.referenceType as string === 'purchase_invoice';
                                const linkUrl = isSalesInv ? `/sales-invoices/${a.referenceId}` : 
                                                isCreditNote ? `/sales-credit-notes/${a.referenceId}` :
                                                isPurchInv ? `/supplier-invoices/${a.referenceId}` :
                                                `/purchase-debit-notes/${a.referenceId}`; // fallback
                                return (
                                <tr key={a.allocationId} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-5 py-3">
                                    <Link 
                                      href={linkUrl}
                                      className="font-semibold text-[var(--accent)] hover:underline"
                                    >
                                      {a.invoiceNumber || a.referenceId.slice(0, 8)}
                                    </Link>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 uppercase font-bold tracking-wider">
                                      {isSalesInv ? t('salesInv') : 
                                       isCreditNote ? 'Credit Note' :
                                       isPurchInv ? t('purchInv') : 
                                       'Debit Note'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-right font-mono font-medium text-[#041627]">
                                    {formatAmount(parseFloat(a.allocatedAmount), data.currencyCode)}
                                  </td>
                                </tr>
                              )})}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* View: Allocation Controls */
                  <div className="flex-1 flex flex-col min-h-0 gap-6 h-full min-h-[600px]">
                    {loadingInvoices ? (
                      <div className="flex flex-col items-center justify-center flex-1 opacity-50">
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <span className="material-symbols-outlined animate-spin text-3xl mb-4">sync</span>
                        <p className="text-sm font-medium">{t('manager.messages.loadingInvoices')}</p>
                      </div>
                    ) : outstandingInvoices.length > 0 ? (
                      <>
                        {data && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('manager.labels.paymentUnallocated')}</div>
                              <div className="text-xl font-bold mt-0.5 text-gray-900">
                                {formatAmount(parseFloat(data.unallocatedAmount), data.currencyCode)}
                              </div>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('manager.labels.totalOutstanding')}</div>
                              <div className="text-xl font-bold mt-0.5 text-gray-900">
                                {formatAmount(outstandingInvoices.reduce((sum, i) => sum + parseFloat(i.outstandingAmount), 0), data.currencyCode)}
                              </div>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t('manager.labels.allocatedNow')}</div>
                              <div className="text-xl font-bold mt-0.5 text-gray-900">
                                {formatAmount(totalAllocatedNow, data.currencyCode)}
                              </div>
                            </div>
                            <div className={`p-3 rounded-lg border ${remainingToAllocate >= 0 ? 'bg-[#f0f8f6] border-[#006b5c]/30' : 'bg-red-50 border-red-200'}`}>
                              <div className={`text-[10px] uppercase tracking-wider font-bold ${remainingToAllocate >= 0 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
                                {t('manager.labels.remainingToAllocate')}
                              </div>
                              <div className={`text-xl font-bold mt-0.5 ${remainingToAllocate >= 0 ? 'text-[#006b5c]' : 'text-[var(--danger)]'}`}>
                                {formatAmount(remainingToAllocate, data.currencyCode)}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="border border-[var(--border)] rounded-md overflow-hidden bg-white">
                          <DataGrid
                            rowData={outstandingInvoices}
                            columns={allocationColumns}
                            rowIdField="id"
                            fetchAll={true}
                            domLayout="autoHeight"
                            rowSelection="single"
                            onSelectionChanged={(rows) => setSelectedInvoice(rows[0] || null)}
                            context={{ handleToggle, t }}
                            renderHeader={({ searchInput }) => (
                              <div className="flex flex-col bg-white border-b border-gray-100">
                                <div className="flex items-center justify-between px-4 py-3">
                                  <div className="flex-1 max-w-sm">
                                    {searchInput}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => setPartialModalOpen(true)}
                                      disabled={!selectedInvoice}
                                      className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={!selectedInvoice ? t('manager.messages.selectRowForPartial') : ""}
                                    >
                                      {t('manager.messages.partial')}
                                    </button>
                                    <button
                                      onClick={submitAllocations}
                                      disabled={submitting || totalAllocatedNow <= 0 || remainingToAllocate < 0}
                                      className="btn btn-primary btn-sm"
                                    >
                                      {submitting ? t('submitting') : t('manager.buttons.saveAllocations')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 opacity-50 border border-dashed border-gray-300 rounded-xl m-4 bg-gray-50/50">
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                          <span className="material-symbols-outlined text-4xl mb-4 text-gray-400">receipt_long</span>
                        <p className="text-sm font-medium text-gray-600">{t('manager.messages.noOutstandingInvoices')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      <PartialAllocationModal
        isOpen={partialModalOpen}
        onClose={() => setPartialModalOpen(false)}
        invoice={selectedInvoice}
        currencyCode={data?.currencyCode || baseCurrency}
        maxAvailable={data ? parseFloat(data.unallocatedAmount) - totalAllocatedNow + ((selectedInvoice as any)?.pendingAllocation || 0) : 0}
        onSave={(invoiceId, amount) => {
          setOutstandingInvoices(prev => prev.map(p => p.id === invoiceId ? { ...p, pendingAllocation: amount } : p));
        }}
      />
    </SlideOver>
  );
}