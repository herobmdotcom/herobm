'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { RETURN_STATE, PURCHASE_RETURN_STATE } from '@herobm/shared';
import AdHocCreditNoteSlideOver from './AdHocCreditNoteSlideOver';
import ReturnCreditNoteSlideOver from './ReturnCreditNoteSlideOver';
import ReturnDebitNoteSlideOver from './ReturnDebitNoteSlideOver';
import { Button } from '@/components/shared/Button';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import type { ColDef, ValueFormatterParams } from 'ag-grid-community';

interface CustomerReturnItem {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerNumber?: string;
  customerName?: string;
  createdOn: string;
  stateCode: string;
  notes?: string;
  lines?: Array<{ putawayStatus?: string }>;
}

interface SupplierReturnItem {
  returnId: string;
  returnNumber: string;
  orderNumber?: string;
  vendorCode?: string;
  vendorId?: string;
  vendorName?: string;
  createdOn: string;
  stateCode: string;
  notes?: string;
  lines?: Array<unknown>;
}

export interface UnifiedReturnRow {
  id: string;
  type: 'customer_return' | 'supplier_return';
  typeLabel: string;
  returnId: string;
  returnNumber: string;
  orderNumber: string;
  partyNumber: string;
  partyName: string;
  createdOn: string;
  stateCode: string;
  putawayStatus?: string;
  linesCount: number;
  notes: string;
  raw: unknown;
}

export default function ReturnsQueuePage() {
  const tCommon = useTranslations('common');
  const tOrders = useTranslations('salesOrders');
  useDocumentTitle('Credit & Debit Notes Queue');

  const [refreshKey, setRefreshKey] = useState(0);
  const [rows, setRows] = useState<UnifiedReturnRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [adHocOpen, setAdHocOpen] = useState(false);
  const [selectedCustomerReturn, setSelectedCustomerReturn] = useState<unknown | null>(null);
  const [selectedSupplierReturn, setSelectedSupplierReturn] = useState<unknown | null>(null);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [salesRes, purchaseRes] = await Promise.all([
        api
          .globalReturnsControllerFindGlobalReturns({ stateCode: RETURN_STATE.RECEIVED, requireCredit: true })
          .catch((err: unknown) => {
            reportError(err, 'ReturnsQueue.fetchSales');
            return { data: { data: [] } };
          }),
        api
          .globalPurchaseReturnsControllerGetPurchaseReturns({ stateCode: PURCHASE_RETURN_STATE.SHIPPED, requireDebitNote: true })
          .catch((err: unknown) => {
            reportError(err, 'ReturnsQueue.fetchPurchase');
            return { data: { data: [] } };
          }),
      ]);

      const salesRaw = salesRes?.data as unknown;
      const purchaseRaw = purchaseRes?.data as unknown;
      const salesList = (Array.isArray(salesRaw) ? salesRaw : (salesRaw as { data?: CustomerReturnItem[] })?.data || []) as CustomerReturnItem[];
      const purchaseList = (Array.isArray(purchaseRaw) ? purchaseRaw : (purchaseRaw as { data?: SupplierReturnItem[] })?.data || []) as SupplierReturnItem[];

      const salesRows: UnifiedReturnRow[] = salesList.map((r) => ({
        id: `sr-${r.returnId}`,
        type: 'customer_return',
        typeLabel: 'Customer Return',
        returnId: r.returnId,
        returnNumber: r.returnNumber,
        orderNumber: r.orderNumber || r.salesOrderNumber || '—',
        partyNumber: r.customerNumber || '—',
        partyName: r.customerName || '—',
        createdOn: r.createdOn,
        stateCode: r.stateCode,
        putawayStatus:
          r.lines && r.lines.length > 0
            ? r.lines.every((l) => l.putawayStatus === 'completed')
              ? 'Completed'
              : 'Pending'
            : '—',
        linesCount: r.lines ? r.lines.length : 0,
        notes: r.notes || '',
        raw: r,
      }));

      const purchaseRows: UnifiedReturnRow[] = purchaseList.map((r) => ({
        id: `pr-${r.returnId}`,
        type: 'supplier_return',
        typeLabel: 'Supplier Return',
        returnId: r.returnId,
        returnNumber: r.returnNumber,
        orderNumber: r.orderNumber || '—',
        partyNumber: r.vendorCode || r.vendorId?.substring(0, 8) || '—',
        partyName: r.vendorName || '—',
        createdOn: r.createdOn,
        stateCode: r.stateCode,
        putawayStatus: 'Shipped',
        linesCount: r.lines ? r.lines.length : 0,
        notes: r.notes || '',
        raw: r,
      }));

      setRows([...salesRows, ...purchaseRows]);
    } catch (err) {
      reportError(err, 'ReturnsQueuePage.loadData');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleReturnClick = useCallback((row: UnifiedReturnRow) => {
    if (row.type === 'customer_return') {
      setSelectedCustomerReturn(row.raw);
    } else {
      setSelectedSupplierReturn(row.raw);
    }
  }, []);

  const gridColumns: ColDef<UnifiedReturnRow>[] = useMemo(
    () => [
      { field: 'typeLabel', headerName: 'Type', width: 140 },
      { field: 'returnNumber', headerName: 'Return No', width: 140 },
      { field: 'orderNumber', headerName: 'Order No', width: 140 },
      { field: 'partyNumber', headerName: 'Party No', width: 130 },
      { field: 'partyName', headerName: 'Customer / Supplier', minWidth: 200, flex: 1 },
      {
        field: 'createdOn',
        headerName: tCommon('columns.date'),
        width: 130,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) =>
          formatLocalDate(p.value as string | number, undefined, ''),
      },
      {
        field: 'stateCode',
        headerName: tCommon('columns.status'),
        width: 120,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) => {
          const val = p.value as string;
          if (!val) return '';
          return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        },
      },
      {
        field: 'putawayStatus',
        headerName: 'Putaway / Shipping',
        width: 150,
      },
      {
        field: 'linesCount',
        headerName: 'Lines',
        width: 100,
        valueFormatter: (p: ValueFormatterParams<UnifiedReturnRow>) => {
          if (p.value === undefined || p.value === null) return '';
          return tCommon('itemsCount', { count: p.value });
        },
      },
      { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 },
    ],
    [tCommon],
  );

  return (
    <>
      <DataGrid
        rowData={rows}
        columns={gridColumns}
        gridKey="unified-returns-queue-list"
        rowIdField="id"
        onRowClicked={handleReturnClick}
        pageTitle="Returns Queue (Credit & Debit Notes)"
        defaultSortModel={[{ colId: 'createdOn', sort: 'desc' }]}
        headerActions={
          <Button
            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[var(--accent)] text-white hover:brightness-110 whitespace-nowrap"
            onClick={() => setAdHocOpen(true)}
          >
            {tOrders('returns.creditNote')}
          </Button>
        }
      />

      <AdHocCreditNoteSlideOver
        isOpen={adHocOpen}
        onClose={() => setAdHocOpen(false)}
        onSuccess={() => {
          setAdHocOpen(false);
          triggerRefresh();
        }}
      />

      <ReturnCreditNoteSlideOver
        isOpen={!!selectedCustomerReturn}
        onClose={() => setSelectedCustomerReturn(null)}
        returnRecord={selectedCustomerReturn}
        onSuccess={() => {
          setSelectedCustomerReturn(null);
          triggerRefresh();
        }}
      />

      <ReturnDebitNoteSlideOver
        isOpen={!!selectedSupplierReturn}
        onClose={() => setSelectedSupplierReturn(null)}
        returnRecord={selectedSupplierReturn}
        onSuccess={() => {
          setSelectedSupplierReturn(null);
          triggerRefresh();
        }}
      />
    </>
  );
}
