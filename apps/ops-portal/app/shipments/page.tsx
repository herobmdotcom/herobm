'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';


export default function ShipmentsPage() {
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');
  const router = useRouter();
  const [days, setDays] = useState('30');

  const columns = useMemo<ColDef[]>(() => [
    {
      field: 'shipmentNumber',
      headerName: t('columns.shipmentNumber'),
      width: 150,
      pinned: 'left',
      cellRenderer: (params: any) => (
        <span className="font-semibold text-[var(--text-primary)]">
          {params.value}
        </span>
      ),
    },
    {
      field: 'createdOn',
      headerName: t('columns.date'),
      width: 110,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : '—',
    },
    {
      field: 'customerName',
      headerName: t('columns.customer'),
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'orderNumber',
      headerName: t('columns.orderNumber'),
      width: 140,
    },
    {
      field: 'purchaseOrders',
      headerName: t('columns.purchaseOrders'),
      width: 160,
      valueFormatter: (params) => params.value?.join(', ') || '—',
    },
    {
      field: 'stateCode',
      headerName: t('columns.status'),
      width: 120,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const s = String(params.value).toLowerCase();
        return tStates.has(s as any) ? tStates(s as any) : String(params.value);
      },
    },
    {
      field: 'notes',
      headerName: t('columns.notes'),
      flex: 1.5,
      minWidth: 200,
    },
  ], [t]);

  const handleRowClicked = useCallback((data: any) => {
    router.push(`/shipments/${data.shipmentId}`);
  }, [router]);

  return (
    <DataGrid
      endpoint={`/api/shipments?days=${days}`}
      columns={columns}
      gridKey="ops-shipments"
      searchPlaceholder={t('placeholders.searchShipments')}
      exportFileName="shipments"
      fetchAll
      rowIdField="shipmentId"
      onRowClicked={handleRowClicked}
      pageTitle={t('title')}
      headerFilters={
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
      }
    />
  );
}
