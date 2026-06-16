'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import * as api from '@herobm/sdk';
import type { ColDef } from 'ag-grid-community';

import { useSettings } from '@/components/SettingsProvider';
import PaymentManagerSlideOver from './PaymentManagerSlideOver';
import { PaymentRunGeneratorSlideOver } from './PaymentRunGeneratorSlideOver';
import { PAYMENT_STATE } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { ValidState } from '@/types/states';

interface UnifiedPayment {
  paymentId: string;
  paymentNumber: string;
  paymentType: string;
  partyId: string;
  paymentDate: string;
  modeOfPayment: string;
  totalAmount: string;
  unallocatedAmount: string;
  stateCode: string;
  currencyCode: string;
  createdOn: string;
  createdBy: string;
  partyName?: string;
}

export default function PaymentsContent() {
  const { baseCurrency, gl } = useSettings();
  const supportedFormats = gl?.supportedBatchPaymentFormats || (baseCurrency === 'USD' ? ['NACHA'] : ['ABA']);
  const showNacha = supportedFormats.includes('NACHA');
  const showAba = supportedFormats.includes('ABA');
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<UnifiedPayment[]>([]);
  const [days, setDays, isReadyDays] = usePersistedFilter('payments-days', '90');
  const [allocationFilter, setAllocationFilter, isReadyAlloc] = usePersistedFilter('payments-allocation', 'all');
  const isReady = isReadyDays && isReadyAlloc;
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [generatorSlideOverOpen, setGeneratorSlideOverOpen] = useState(false);
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');

  const handleNext = useCallback(() => {
    if (!selectedPaymentId || payments.length === 0) return;
    const idx = payments.findIndex(p => p.paymentId === selectedPaymentId);
    if (idx !== -1 && idx < payments.length - 1) {
      setSelectedPaymentId(payments[idx + 1].paymentId);
    }
  }, [selectedPaymentId, payments]);

  const handlePrev = useCallback(() => {
    if (!selectedPaymentId || payments.length === 0) return;
    const idx = payments.findIndex(p => p.paymentId === selectedPaymentId);
    if (idx !== -1 && idx > 0) {
      setSelectedPaymentId(payments[idx - 1].paymentId);
    }
  }, [selectedPaymentId, payments]);

  const columns = useMemo<ColDef<UnifiedPayment>[]>(() => [
    { 
      field: 'paymentNumber', 
      headerName: 'Payment #', 
      width: 170, 
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { 
      field: 'paymentType', 
      headerName: 'Type', 
      width: 150, 
      cellRenderer: (params: { data?: UnifiedPayment }) => {
        if (!params.data || !params.data.paymentType) return '';
        return t(('manager.options.' + params.data.paymentType.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())) as Parameters<typeof t>[0]);
      } 
    },
    { field: 'partyName', headerName: 'Party', width: 200, valueFormatter: (params: { value?: unknown }) => (params.value as string) || '—' },
    {
      field: 'stateCode',
      headerName: 'Status',
      width: 110,
      valueFormatter: (params: { value?: unknown }) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(params.value);
      },
    },
    {
      headerName: 'Allocation',
      width: 140,
      valueGetter: (params: { data?: UnifiedPayment }) => {
        if (!params.data) return null;
        if (params.data.paymentType?.startsWith('direct_')) return '—';
        const total = parseFloat(params.data.totalAmount);
        const unalloc = parseFloat(params.data.unallocatedAmount);
        if (unalloc === total) return 'Unallocated';
        if (unalloc > 0) return 'Partially Allocated';
        return 'Fully Allocated';
      }
    },
    {
      field: 'totalAmount',
      headerName: 'Total',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params: { data?: UnifiedPayment }) => {
        if (!params.data?.totalAmount) return null;
        return parseFloat(params.data.totalAmount);
      },
      valueFormatter: (params: { value?: number; data?: UnifiedPayment }) => {
        if (!params.value || params.value === 0) return '—';
        return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
      },
    },
    {
      field: 'unallocatedAmount',
      headerName: 'Unallocated',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params: { data?: UnifiedPayment }) => {
        if (!params.data?.unallocatedAmount) return null;
        return parseFloat(params.data.unallocatedAmount);
      },
      valueFormatter: (params: { value?: number; data?: UnifiedPayment }) => {
        if (!params.value && params.value !== 0) return '—';
        return formatAmount(params.value, params.data?.currencyCode || baseCurrency);
      },
    },
    { field: 'modeOfPayment', headerName: 'Mode', width: 120 },
    {
      field: 'paymentDate',
      headerName: 'Date',
      width: 110,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
    { field: 'createdBy', headerName: 'Created By', width: 120 },
  ], [baseCurrency]);

  const handleRowClicked = useCallback((payment: UnifiedPayment) => {
    setSelectedPaymentId(payment.paymentId);
    setSlideOverOpen(true);
  }, []);

  const handleExportAba = async () => {
    if (selectedPayments.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const response = await api.paymentsControllerExportAba({ paymentIds: selectedPayments.map(p => p.paymentId) });
      
      // Download the file
      const blob = new Blob([response.data?.fileContent || ''], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ABA_${new Date().toISOString().slice(0,10)}.aba`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
      setSelectedPayments([]);
    } catch (err: unknown) {
      reportError(err, 'PaymentsContent_handleExportAba');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleExportNacha = async () => {
    if (selectedPayments.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const response = await api.paymentsControllerExportNacha({ paymentIds: selectedPayments.map(p => p.paymentId) });
      
      const blob = new Blob([response.data?.fileContent || ''], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NACHA_${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
      setSelectedPayments([]);
    } catch (err: unknown) {
      reportError(err, 'PaymentsContent_handleExportNacha');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchAction = async (endpoint: string) => {
    if (selectedPayments.length === 0) return;
    setIsProcessingBatch(true);
    try {
      if (endpoint === 'confirm-exported') {
        await api.paymentsControllerConfirmExported({ paymentIds: selectedPayments.map(p => p.paymentId) });
      } else if (endpoint === 'reject-exported') {
        await api.paymentsControllerRejectExported({ paymentIds: selectedPayments.map(p => p.paymentId) });
      }
      window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
      setSelectedPayments([]);
    } catch (err: unknown) {
      reportError(err, 'PaymentsContent_handleSetState');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const draftSelected = selectedPayments.filter(p => p.stateCode === PAYMENT_STATE.DRAFT);
  const exportedSelected = selectedPayments.filter(p => p.stateCode === PAYMENT_STATE.EXPORTED);
  const hasDraftSelected = draftSelected.length > 0 && draftSelected.length === selectedPayments.length;
  const hasExportedSelected = exportedSelected.length > 0 && exportedSelected.length === selectedPayments.length;

  return (
    <>
    <DataGrid<UnifiedPayment>
      endpoint={isReady ? `/api/payments?days=${days}&allocation=${allocationFilter}` : undefined}
      columns={columns}
      gridKey="ops-payments"
      searchPlaceholder="Search payments..."
      exportFileName="payments"
      rowIdField="paymentId"
      rowSelection="multiple"
      onSelectionChanged={setSelectedPayments}
      onDataLoaded={setPayments}
      onRowClicked={handleRowClicked}
      pageTitle={t('title')}
      headerFilters={
        <>
          <select
            value={allocationFilter}
            onChange={(e) => setAllocationFilter(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 150 }}
          >
            <option value="all">{t('allAllocations')}</option>
            <option value="unallocated">{t('unallocatedOnly')}</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm"
            style={{ minWidth: 150 }}
          >
            <option value="30">{tCommon('filters.last30Days')}</option>
            <option value="90">{tCommon('filters.last90Days')}</option>
            <option value="365">{tCommon('filters.last1Year')}</option>
            <option value="0">{tCommon('filters.allTime')}</option>
          </select>
        </>
      }
      headerActions={
        <div className="flex lg:hidden flex-wrap items-center justify-start gap-3 w-full">
          <button  
            onClick={() => {
              setSelectedPaymentId(null);
              setSlideOverOpen(true);
            }}
            className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all whitespace-nowrap"
          >
            {t('newPayment')}
          </button>
          <button
            onClick={() => setGeneratorSlideOverOpen(true)}
            className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
          >
            {t('generateRun')}
          </button>

          {hasDraftSelected && showAba && (
            <button 
              onClick={handleExportAba} 
              disabled={isProcessingBatch}
              className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
            >
              {isProcessingBatch ? t('processing') : t('exportAba', { count: draftSelected.length })}
            </button>
          )}

          {hasDraftSelected && showNacha && (
            <button 
              onClick={handleExportNacha} 
              disabled={isProcessingBatch}
              className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
            >
              {isProcessingBatch ? t('processing') : `Export NACHA (${draftSelected.length})`}
            </button>
          )}
          
          {hasExportedSelected && (
            <>
              <button 
                onClick={() => handleBatchAction('confirm-exported')} 
                disabled={isProcessingBatch}
                className="px-4 py-2 bg-[var(--success)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
              >
                {t('confirmCount', { count: exportedSelected.length })}
              </button>
              <button 
                onClick={() => handleBatchAction('reject-exported')} 
                disabled={isProcessingBatch}
                className="px-4 py-2 bg-[var(--danger)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
              >
                {t('reject')}
              </button>
            </>
          )}
        </div>
      }
      secondaryHeader={
        <div className="flex flex-wrap items-center justify-end gap-3 w-full">
          <button  
            onClick={() => {
              setSelectedPaymentId(null);
              setSlideOverOpen(true);
            }}
            className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
          >
            {t('newPayment')}
          </button>
          <button
            onClick={() => setGeneratorSlideOverOpen(true)}
            className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
          >
            {t('generateRun')}
          </button>
          
          {(hasDraftSelected || hasExportedSelected) && (
            <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-1"></div>
          )}

          {hasDraftSelected && showAba && (
            <button 
              onClick={handleExportAba} 
              disabled={isProcessingBatch}
              className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
            >
              {isProcessingBatch ? t('processing') : t('exportAba', { count: draftSelected.length })}
            </button>
          )}

          {hasDraftSelected && showNacha && (
            <button 
              onClick={handleExportNacha} 
              disabled={isProcessingBatch}
              className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
            >
              {isProcessingBatch ? t('processing') : `Export NACHA (${draftSelected.length})`}
            </button>
          )}
          
          {hasExportedSelected && (
            <>
              <button 
                onClick={() => handleBatchAction('confirm-exported')} 
                disabled={isProcessingBatch}
                className="px-4 py-2 bg-[var(--success)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
              >
                {t('confirmCount', { count: exportedSelected.length })}
              </button>
              <button 
                onClick={() => handleBatchAction('reject-exported')} 
                disabled={isProcessingBatch}
                className="px-4 py-2 bg-[var(--danger)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
              >
                {t('reject')}
              </button>
            </>
          )}
        </div>
      }
    />
      
      {slideOverOpen && (
        <PaymentManagerSlideOver
          paymentId={selectedPaymentId}
          onClose={() => setSlideOverOpen(false)}
          onNext={(selectedPaymentId && payments.findIndex(p => p.paymentId === selectedPaymentId) < payments.length - 1) ? handleNext : undefined}
          onPrev={(selectedPaymentId && payments.findIndex(p => p.paymentId === selectedPaymentId) > 0) ? handlePrev : undefined}
          onSaved={(close) => {
            if (close !== false) setSlideOverOpen(false);
            window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
          }}
        />
      )}

      <PaymentRunGeneratorSlideOver
        open={generatorSlideOverOpen}
        onClose={() => setGeneratorSlideOverOpen(false)}
        onSuccess={() => window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'))}
        baseCurrency={baseCurrency}
      />
    </>
  );
}
