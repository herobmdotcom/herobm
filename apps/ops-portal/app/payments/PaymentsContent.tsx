'use client';

import { useCallback, useMemo, useState } from 'react';
import DataGrid from '@/components/DataGrid';
import { formatAmount } from '@/lib/currency';
import type { ColDef } from 'ag-grid-community';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { useSettings } from '@/components/SettingsProvider';
import PaymentManagerSlideOver from './PaymentManagerSlideOver';

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
}

export default function PaymentsContent() {
  const { baseCurrency } = useSettings();
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const columns = useMemo<ColDef<UnifiedPayment>[]>(() => [
    { field: 'paymentNumber', headerName: 'Payment #', width: 150, pinned: 'left' },
    { field: 'paymentType', headerName: 'Type', width: 120, cellRenderer: (params: any) => params.value === 'receive' ? 'Receipt' : 'Payment' },
    { field: 'partyType', headerName: 'Party Type', width: 120, cellRenderer: (params: any) => params.value === 'customer' ? 'Customer' : 'Supplier' },
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

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid<UnifiedPayment>
              endpoint="/api/payments"
              columns={columns}
              gridKey="ops-payments"
              searchPlaceholder="Search payments..."
              exportFileName="payments"
              fetchAll
              rowIdField="paymentId"
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
                    {optionsButton}
                    <button 
                      onClick={() => {
                        setSelectedPaymentId(null);
                        setSlideOverOpen(true);
                      }}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap"
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
          onSaved={() => {
            setSlideOverOpen(false);
            window.dispatchEvent(new CustomEvent('grid-refresh-ops-payments'));
          }}
        />
      )}
    </>
  );
}
