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
import Link from 'next/link';
import { PO_STATE } from '@modbm/core';

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
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  purchaseOrderState?: string;
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
      field: 'purchaseOrderState',
      headerName: 'Status',
      width: 160,
      cellRenderer: (params: ICellRendererParams<DemandRow>) => {
        if (!params.data?.purchaseOrderId) {
          return <span className="badge badge-warning">{tPurchase('demandsContent.pendingSupply')}</span>;
        }
        
        const badgeClass = params.data.purchaseOrderState === PO_STATE.DRAFT ? 'badge-draft' : 'badge-info';
        const label = params.data.purchaseOrderState === PO_STATE.DRAFT ? tPurchase('demandsContent.draft') : tPurchase('demandsContent.ordered');
        const poNumber = params.data.purchaseOrderNumber || '';
        const displayPo = poNumber.length > 8 ? poNumber.substring(0, 8) + '...' : poNumber;
        
        return (
          <Link href={`/purchase-orders/${params.data.purchaseOrderId}`} className="hover:opacity-80 transition-opacity inline-flex items-center">
            <span className={`badge ${badgeClass} cursor-pointer`} title={poNumber}>{label} {displayPo}</span>
          </Link>
        );
      }
    },
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
      <>
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
            isRowSelectable={(rowNode) => !rowNode.data?.purchaseOrderId}
            onSelectionChanged={setSelectedRows}
            pageTitle={tPurchase('demandTitle')}
            headerActions={
              <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto">
                  {/* Group 1: PO Allocation */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsLinkSlideOverOpen(true)}
                      disabled={selectedRows.length === 0}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {tPurchase('demandsContent.allocateToPo')} {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                    </button>
                    <button
                      onClick={handleDraftPOs}
                      disabled={selectedRows.length === 0}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {tPurchase('demandsContent.draftPos')} {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                    </button>
                  </div>

                  <div className="hidden lg:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>

                  {/* Group 2: Location Management */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsReallocateModalOpen(true)}
                      disabled={selectedRows.length === 0}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#1A467F] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {tPurchase('demandsContent.changeLocation')} {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                    </button>
                    <button
                      onClick={() => setIsInternalTransferModalOpen(true)}
                      disabled={selectedRows.length === 0}
                      className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#1A467F] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {tPurchase('demandsContent.internalTransfer')} {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
                    </button>
                  </div>
              </div>
            }
          />
      </>
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
