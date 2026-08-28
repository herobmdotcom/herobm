'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import * as api from '@herobm/sdk';
import type { ColDef } from 'ag-grid-community';

import { useSettings } from '@/components/SettingsProvider';
import PaymentManagerSlideOver from './PaymentManagerSlideOver';
import { PaymentRunGeneratorSlideOver } from './PaymentRunGeneratorSlideOver';
import { PAYMENT_STATE, getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';
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
  const searchParams = useSearchParams();
  const paymentQuery = searchParams?.get('payment');
  const [slideOverOpen, setSlideOverOpen] = useState(!!paymentQuery);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(paymentQuery || null);

  useEffect(() => {
    if (paymentQuery) {
      setSelectedPaymentId(paymentQuery);
      setSlideOverOpen(true);
    }
  }, [paymentQuery]);
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
        return formatLocalDate(params.value as string);
      },
    },
    { 
      field: 'createdBy', 
      headerName: 'Created By', 
      width: 120,
      valueGetter: (params) => {
        const val = params.data?.createdBy;
        if (!val || val === '[object Object]') return 'admin';
        if (typeof val === 'object') return (val as { username?: string; userId?: string }).username || (val as { username?: string; userId?: string }).userId || 'admin';
        return val;
      }
    },
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
      toast.error(getErrorMessage(err));
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
      toast.error(getErrorMessage(err));
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
      toast.error(getErrorMessage(err));
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
      defaultSortModel={[{ colId: 'paymentDate', sort: 'desc' }]}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setSelectedPaymentId(null);
              setSlideOverOpen(true);
            }}
            className="whitespace-nowrap"
          >
            {t('newPayment')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setGeneratorSlideOverOpen(true)}
            className="whitespace-nowrap"
          >
            {t('generateRun')}
          </Button>
        </div>
      }
      secondaryHeader={
        <div className="flex flex-wrap items-center justify-start gap-3">
          <select
            value={allocationFilter}
            onChange={(e) => setAllocationFilter(e.target.value)}
            className="input text-sm !w-auto min-w-[140px]"
          >
            <option value="all">{t('allAllocations')}</option>
            <option value="unallocated">{t('unallocatedOnly')}</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="input text-sm !w-auto min-w-[130px]"
          >
            <option value="30">{tCommon('filters.last30Days')}</option>
            <option value="90">{tCommon('filters.last90Days')}</option>
            <option value="365">{tCommon('filters.last1Year')}</option>
            <option value="0">{tCommon('filters.allTime')}</option>
          </select>
          
          {(hasDraftSelected || hasExportedSelected) && (
            <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-1"></div>
          )}

          {hasDraftSelected && showAba && (
            <Button
              variant="primary"
              onClick={handleExportAba} 
              disabled={isProcessingBatch}
            >
              {isProcessingBatch ? t('processing') : t('exportAba', { count: draftSelected.length })}
            </Button>
          )}

          {hasDraftSelected && showNacha && (
            <Button
              variant="primary"
              onClick={handleExportNacha} 
              disabled={isProcessingBatch}
            >
              {isProcessingBatch ? t('processing') : `Export NACHA (${draftSelected.length})`}
            </Button>
          )}
          
          {hasExportedSelected && (
            <>
              <Button
                variant="primary"
                onClick={() => handleBatchAction('confirm-exported')} 
                disabled={isProcessingBatch}
              >
                {t('confirmCount', { count: exportedSelected.length })}
              </Button>
              <Button
                variant="danger"
                onClick={() => handleBatchAction('reject-exported')} 
                disabled={isProcessingBatch}
              >
                {t('reject')}
              </Button>
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
