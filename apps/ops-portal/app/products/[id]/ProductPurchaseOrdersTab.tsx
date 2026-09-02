import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { formatLocalDate } from '@/lib/date';

interface ProductPurchaseOrdersTabProps {
  productId: string;
}

export function ProductPurchaseOrdersTab({ productId }: ProductPurchaseOrdersTabProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid column definition lacks strict type
  const columns: any[] = useMemo(() => [
    { field: 'orderNumber', headerName: tCommon('columns.number'), width: 130 },
    { field: 'vendorName', headerName: t('purchaseOrders.columns.vendor'), flex: 1, minWidth: 150 },
    { field: 'referenceNumber', headerName: t('purchaseOrders.columns.referenceNumber'), width: 120 },
    { 
      field: 'productQuantity', 
      headerName: t('purchaseOrders.columns.orderedQty'), 
      type: 'numericColumn', 
      width: 100,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '—' 
    },
    { 
      field: 'productQuantityReceived', 
      headerName: t('purchaseOrders.columns.deliveredQty'), 
      type: 'numericColumn', 
      width: 100,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '—' 
    },
    { 
      field: 'productUnitPrice', 
      headerName: t('purchaseOrders.columns.productUnitPrice'), 
      type: 'numericColumn', 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value != null && p.value !== '' ? `$${parseFloat(p.value).toFixed(2)}` : '—' 
    },
    { 
      field: 'productLineTotal', 
      headerName: t('purchaseOrders.columns.productLineTotal'), 
      type: 'numericColumn', 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value != null && p.value !== '' ? `$${parseFloat(p.value).toFixed(2)}` : '—' 
    },
    { 
      field: 'totalPrice', 
      headerName: t('purchaseOrders.columns.totalAmount'), 
      type: 'numericColumn', 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' 
    },
    { 
      field: 'createdOn', 
      headerName: tCommon('columns.created'), 
      width: 120,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => formatLocalDate(p.value, undefined, '')
    },
    { 
      field: 'stateCode', 
      headerName: tCommon('columns.status'), 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      cellRenderer: (p: any) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        const translated = tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
        return <span className="text-sm">{translated}</span>;
      }
    }
  ], [tCommon, t, tStates]);

  return (
    <DetailTabGrid 
      title={t('purchaseOrders.title')}
      endpoint={`/api/purchase-orders?productId=${encodeURIComponent(productId)}`}
      columns={columns}
      gridKey="product-purchase-orders-grid"
      urlPrefix="purchase-orders"
      fetchAll={false}
      rowIdField="id"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid row lacks strict type
      rowHref={(row: any) => `/purchase-orders/${row.id}`}
    />
  );
}
