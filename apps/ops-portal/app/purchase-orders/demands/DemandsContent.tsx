'use client';

import { useMemo, useState } from 'react';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import DraftPOsModal from './DraftPOsModal';
import LinkToPOSlideOver from './LinkToPOSlideOver';
import ReallocateModal from './ReallocateModal';
import InternalTransferModal from './InternalTransferModal';
import StockElsewhereCell from './StockElsewhereCell';
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { PURCHASE_ORDER_STATE, WORK_ORDER_STATE } from '@herobm/shared';
import { allocationsControllerResolveOpenDemands } from '@herobm/sdk';

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
  availableElsewhere: AvailableElsewhereEntry[];
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  purchaseOrderState?: string;
  transferOrderId?: string;
  transferOrderNumber?: string;
  transferOrderState?: string;
  workOrderId?: string;
  workOrderNumber?: string;
  workOrderState?: string;
}

export default function DemandsContent() {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const [loading, setLoading] = useState(false);
  const [runningMrp, setRunningMrp] = useState(false);
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
      cellRenderer: (params: ICellRendererParams<DemandRow>) => {
        if (!params.data?.salesOrderId) return params.value;
        return (
          <Link href={`/sales-orders/${params.data.salesOrderId}`} className="text-[#006b5c] hover:underline">
            {params.value}
          </Link>
        );
      }
    },
    { field: 'productName', headerName: 'Product', flex: 1, minWidth: 150 },
    { field: 'productDescription', headerName: 'Description', flex: 2, minWidth: 200 },
    {
      field: 'purchaseOrderState',
      headerName: 'Status',
      width: 140,
      valueFormatter: (params: ValueFormatterParams<DemandRow>) => {
        if (params.data?.workOrderId) {
          return params.data.workOrderState === WORK_ORDER_STATE.DRAFT ? 'Work Order (Draft)' : 'Work Order';
        }
        if (params.data?.transferOrderId) {
          // eslint-disable-next-line no-restricted-syntax -- legacy
          return params.data.transferOrderState === 'draft' ? tPurchase('demandsContent.draft') : 'Transfer';
        }
        
        if (!params.data?.purchaseOrderId) {
          return tPurchase('demandsContent.pendingSupply');
        }
        
        return params.data.purchaseOrderState === PURCHASE_ORDER_STATE.DRAFT ? tPurchase('demandsContent.draft') : tPurchase('demandsContent.ordered');
      }
    },
    {
      field: 'purchaseOrderNumber',
      headerName: 'Document',
      width: 160,
      cellRenderer: (params: ICellRendererParams<DemandRow>) => {
        if (params.data?.workOrderId) {
          return (
            <Link href={`/manufacturing/work-orders/${params.data.workOrderId}`} className="text-[#006b5c] hover:underline font-medium">
              {params.data.workOrderNumber}
            </Link>
          );
        }
        if (params.data?.transferOrderId) {
          return (
            <Link href={`/transfers/${params.data.transferOrderId}`} className="text-[#006b5c] hover:underline">
              {params.data.transferOrderNumber}
            </Link>
          );
        }
        if (params.data?.purchaseOrderId) {
          return (
            <Link href={`/purchase-orders/${params.data.purchaseOrderId}`} className="text-[#006b5c] hover:underline">
              {params.data.purchaseOrderNumber}
            </Link>
          );
        }
        return <span className="text-slate-400">—</span>;
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
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<DemandRow>) => (
        <StockElsewhereCell
          availableElsewhere={params.data?.availableElsewhere ?? []}
          requiredQty={Number(params.data?.quantity ?? 0)}
        />
      ),
    },
  ], [tPurchase]);

  const handleDraftPOs = () => {
    if (selectedRows.length === 0) return;
    setIsModalOpen(true);
  };

  const handleRunMrp = async () => {
    try {
      setRunningMrp(true);
      await allocationsControllerResolveOpenDemands({});
      toast.success('MRP Engine executed successfully');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      toast.error('Failed to run MRP Engine');
    } finally {
      setRunningMrp(false);
    }
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    setIsLinkSlideOverOpen(false);
    setIsReallocateModalOpen(false);
    setIsInternalTransferModalOpen(false);
    setSelectedRows([]);
    setRefreshKey((k) => k + 1);
  };

  const mrpButtonLabel = runningMrp ? 'Running Engine...' : 'Run MRP Engine';

  return (
    <div className="h-full flex flex-col">
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
        isRowSelectable={(rowNode) => !rowNode.data?.purchaseOrderId && !rowNode.data?.transferOrderId && !rowNode.data?.workOrderId}
        onSelectionChanged={setSelectedRows}
        pageTitle={tPurchase('demandTitle')}
        headerActions={
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto">
            <Button
              variant="secondary"
              onClick={handleRunMrp}
              disabled={runningMrp}
              className="whitespace-nowrap"
            >
              {mrpButtonLabel}
            </Button>

            <div className="hidden lg:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>

            {/* Group 1: PO Allocation */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsLinkSlideOverOpen(true)}
                disabled={selectedRows.length === 0}
                className="whitespace-nowrap"
              >
                {tPurchase('demandsContent.allocateToPo')}
              </Button>
              <Button
                variant="primary"
                onClick={handleDraftPOs}
                disabled={selectedRows.length === 0}
                className="whitespace-nowrap"
              >
                {tPurchase('demandsContent.draftPos')}
              </Button>
            </div>

            <div className="hidden lg:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>

            {/* Group 2: Location Management */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsReallocateModalOpen(true)}
                disabled={selectedRows.length === 0}
                className="whitespace-nowrap"
              >
                {tPurchase('demandsContent.changeLocation')}
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsInternalTransferModalOpen(true)}
                disabled={selectedRows.length === 0}
                className="whitespace-nowrap"
              >
                {tPurchase('demandsContent.internalTransfer')}
              </Button>
            </div>
          </div>
        }
      />
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
