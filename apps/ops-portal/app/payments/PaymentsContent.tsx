'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { useSettings } from '@/components/SettingsProvider';
import PaymentManagerSlideOver from './PaymentManagerSlideOver';
import { PAYMENT_STATE } from '@modbm/shared';

interface UnifiedPayment {
  paymentId: string;
  paymentNumber: string;
  paymentType: string;
  partyType: string;
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
  const { baseCurrency } = useSettings();
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<UnifiedPayment[]>([]);
  const [days, setDays] = useState('90');
  const [allocationFilter, setAllocationFilter] = useState('all');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const tCommon = useTranslations('common');

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
    { field: 'paymentType', headerName: 'Type', width: 120, cellRenderer: (params: any) => params.value === 'receive' ? 'Receipt' : 'Payment' },
    { field: 'partyType', headerName: 'Party Type', width: 120, cellRenderer: (params: any) => params.value === 'customer' ? 'Customer' : 'Supplier' },
    { field: 'partyName', headerName: 'Party', width: 200 },
    {
      field: 'stateCode',
      headerName: 'Status',
      width: 110,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        return <StateBadge state={params.value as ValidState} />;
      },
    },
    {
      headerName: 'Allocation',
      width: 140,
      valueGetter: (params: { data?: UnifiedPayment }) => {
        if (!params.data) return null;
        const total = parseFloat(params.data.totalAmount);
        const unalloc = parseFloat(params.data.unallocatedAmount);
        if (unalloc === total) return 'Unallocated';
        if (unalloc > 0) return 'Partial';
        return 'Fully Allocated';
      },
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return null;
        let className = 'badge badge-legacy'; // Partial (gray)
        if (params.value === 'Unallocated') className = 'badge badge-partially_paid'; // Amber
        else if (params.value === 'Fully Allocated') className = 'badge badge-paid'; // Green
        return <span className={className}>{params.value}</span>;
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
      const response = await fetch('/api/payments/export-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds: selectedPayments.map(p => p.paymentId) }),
      });
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
      
      // Download the file
      const blob = new Blob([data.fileContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ABA_${new Date().toISOString().slice(0,10)}.aba`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
      setSelectedPayments([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleBatchAction = async (endpoint: string) => {
    if (selectedPayments.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const response = await fetch(`/api/payments/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds: selectedPayments.map(p => p.paymentId) }),
      });
      if (!response.ok) throw new Error('Action failed');
      window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
      setSelectedPayments([]);
    } catch (err: any) {
      alert(err.message);
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
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedPayment>
              endpoint={`/api/payments?days=${days}&allocation=${allocationFilter}`}
              columns={columns}
              gridKey="ops-payments"
              searchPlaceholder="Search payments..."
              exportFileName="payments"
              fetchAll
              rowIdField="paymentId"
              rowSelection="multiple"
              onSelectionChanged={setSelectedPayments}
              onDataLoaded={setPayments}
              onRowClicked={handleRowClicked}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Payments
                    </h2>
                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                      <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Records
                      </span>
                      <span className="text-[11px] font-bold text-[#006b5c]">
                        {loading ? '...' : rowCount.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex-1 ml-4 max-w-[280px]">
                      {searchInput}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <select
                      value={allocationFilter}
                      onChange={(e) => setAllocationFilter(e.target.value)}
                      className="input text-sm"
                      style={{ minWidth: 150 }}
                    >
                      <option value="all">All Allocations</option>
                      <option value="unallocated">Unallocated Only</option>
                    </select>
                    <select
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="input text-sm"
                      style={{ minWidth: 150 }}
                    >
                      <option value="30">{tCommon('filters.last30Days', { defaultValue: 'Last 30 Days' })}</option>
                      <option value="90">{tCommon('filters.last90Days', { defaultValue: 'Last 90 Days' })}</option>
                      <option value="365">{tCommon('filters.last1Year', { defaultValue: 'Last 1 Year' })}</option>
                      <option value="0">{tCommon('filters.allTime', { defaultValue: 'All Time' })}</option>
                    </select>
                    {optionsButton}
                    
                    {hasDraftSelected && (
                      <button 
                        onClick={handleExportAba} 
                        disabled={isProcessingBatch}
                        className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
                      >
                        {isProcessingBatch ? 'Processing...' : `Export ABA (${draftSelected.length})`}
                      </button>
                    )}
                    
                    {hasExportedSelected && (
                      <>
                        <button 
                          onClick={() => handleBatchAction('confirm-exported')} 
                          disabled={isProcessingBatch}
                          className="px-4 py-2 bg-[var(--success)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
                        >
                          Confirm ({exportedSelected.length})
                        </button>
                        <button 
                          onClick={() => handleBatchAction('reject-exported')} 
                          disabled={isProcessingBatch}
                          className="px-4 py-2 bg-[var(--danger)] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    <button  
                      onClick={() => {
                        setSelectedPaymentId(null);
                        setSlideOverOpen(true);
                      }}
                      className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all whitespace-nowrap"
                    >
                      New Payment
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
      
      {slideOverOpen && (
        <PaymentManagerSlideOver
          paymentId={selectedPaymentId}
          onClose={() => setSlideOverOpen(false)}
          onSaved={(close) => {
            if (close !== false) setSlideOverOpen(false);
            window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
          }}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}
    </>
  );
}

