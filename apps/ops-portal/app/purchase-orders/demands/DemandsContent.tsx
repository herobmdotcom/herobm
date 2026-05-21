'use client';

import { useMemo, useState, useCallback } from 'react';
import DataGrid from '@/components/DataGrid';
import DraftPOsModal from './DraftPOsModal';
import LinkToPOSlideOver from './LinkToPOSlideOver';
import ReallocateModal from './ReallocateModal';
import InternalTransferModal from './InternalTransferModal';
import StockElsewhereCell from './StockElsewhereCell';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

export interface AvailableElsewhereEntry {
  locationId: string;
  locationName: string;
  availableQty: number;
}

export interface DemandRow {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productDescription?: string;
  quantity: number;
  createdOn: string;
  vendorId?: string;
  vendorName?: string;
  costPrice?: number;
  currencyCode?: string;
  locationId: string;
  locationName: string;
  /**
   * Inventory available at other locations for this demand's product,
   * excluding the demand's own destination location. Locations with zero
   * available qty are omitted server-side. Sorted ascending by API; the
   * cell renderer sorts by qty descending for display.
   */
  availableElsewhere: AvailableElsewhereEntry[];
}

export default function DemandsContent() {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRows, setSelectedRows] = useState<DemandRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkSlideOverOpen, setIsLinkSlideOverOpen] = useState(false);
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [isInternalTransferModalOpen, setIsInternalTransferModalOpen] = useState(false);

  const columns = useMemo<ColDef<DemandRow>[]>(() => [
    {
      field: 'orderNumber',
      headerName: 'Sales Order',
      width: 160,
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { field: 'productName', headerName: 'Product', flex: 1, minWidth: 150 },
    { field: 'productDescription', headerName: 'Description', flex: 2, minWidth: 200 },
    {
      field: 'locationName',
      headerName: 'Location',
      flex: 1,
    },
    { field: 'quantity', headerName: 'Required Qty', width: 140, cellDataType: 'number' },
    {
      headerName: 'Stock Elsewhere',
      width: 200,
      // Disable sort/filter on this synthetic column (derived array — no comparable scalar)
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<DemandRow>) => (
        <StockElsewhereCell
          availableElsewhere={params.data?.availableElsewhere ?? []}
          requiredQty={Number(params.data?.quantity ?? 0)}
        />
      ),
    },
    {
      field: 'vendorName',
      headerName: 'Preferred Supplier',
      width: 180,
      valueFormatter: (params: { value: unknown }) => params.value ? String(params.value) : '—'
    },
    {
      field: 'createdOn',
      headerName: 'Date Requested',
      width: 140,
      valueFormatter: (params: { value: unknown }) => {
        if (!params.value) return '—';
        return new Date(params.value as string).toLocaleDateString();
      },
    },
  ], []);

  const handleDraftPOs = () => {
    if (selectedRows.length === 0) return;
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setIsLinkSlideOverOpen(false);
    setIsReallocateModalOpen(false);
    setIsInternalTransferModalOpen(false);
    setSelectedRows([]);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-full flex flex-col relative p-4 lg:p-6">
      <div className="relative h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid<DemandRow>
            refreshTrigger={refreshKey}
            endpoint={`/api/allocations/open`}
            columns={columns}
            gridKey="open-demands"
            searchPlaceholder="Search demands..."
            exportFileName="open-demands"
            fetchAll
            rowIdField="id"
            rowSelection="multiple"
            onSelectionChanged={setSelectedRows}
            renderHeader={({ searchInput, optionsButton, rowCount, loading: gridLoading }) => (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tPurchase('demandTitle')}
                  </h2>
                  <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                    <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tCommon('grid.rowCountLabel')}
                    </span>
                    <span className="text-[11px] font-bold text-[#006b5c]">
                      {gridLoading ? '...' : rowCount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex-1 ml-4 max-w-[280px]">
                    {searchInput}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {optionsButton}
                  <button
                    onClick={() => setIsLinkSlideOverOpen(true)}
                    disabled={selectedRows.length === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Allocate to PO {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                  </button>
                  <button
                    onClick={handleDraftPOs}
                    disabled={selectedRows.length === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Draft POs {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                  </button>
                  <button
                    onClick={() => setIsReallocateModalOpen(true)}
                    disabled={selectedRows.length === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Reallocate {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                  </button>
                  <button
                    onClick={() => setIsInternalTransferModalOpen(true)}
                    disabled={selectedRows.length === 0}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#1A467F] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Internal Transfer {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      </div>
      <DraftPOsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDemands={selectedRows}
        onSuccess={handleModalSuccess}
      />
      <LinkToPOSlideOver
        isOpen={isLinkSlideOverOpen}
        onClose={() => setIsLinkSlideOverOpen(false)}
        demands={selectedRows}
        onRefresh={handleModalSuccess}
      />
      <ReallocateModal
        isOpen={isReallocateModalOpen}
        onClose={() => setIsReallocateModalOpen(false)}
        selectedDemands={selectedRows}
        onSuccess={handleModalSuccess}
      />
      <InternalTransferModal
        isOpen={isInternalTransferModalOpen}
        onClose={() => setIsInternalTransferModalOpen(false)}
        selectedDemands={selectedRows}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
