import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { formatLocalDate } from '@/lib/date';
import DetailTabGrid from '@/components/shared/DetailTabGrid';

interface ProductSalesTabProps {
  productId: string;
}

export function ProductSalesTab({ productId }: ProductSalesTabProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid column definition lacks strict type
  const columns: any[] = useMemo(() => [
    { field: 'orderNumber', headerName: tCommon('columns.number'), width: 140 },
    { field: 'customerName', headerName: t('salesOrders.columns.customer'), flex: 1, minWidth: 160 },
    { 
      field: 'productQuantity', 
      headerName: t('salesOrders.columns.orderedQty'), 
      type: 'numericColumn', 
      width: 120,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '—' 
    },
    { 
      field: 'productQuantityShipped', 
      headerName: t('salesOrders.columns.shippedQty'), 
      type: 'numericColumn', 
      width: 120,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? parseFloat(p.value).toLocaleString() : '—' 
    },
    { 
      field: 'totalPrice', 
      headerName: t('salesOrders.columns.totalAmount'), 
      type: 'numericColumn', 
      width: 120, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid params lack strict type
      valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' 
    },
    { 
      field: 'createdOn', 
      headerName: tCommon('columns.created'), 
      width: 140,
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
      title={t('salesOrders.sales')}
      endpoint={`/api/sales-orders?productId=${encodeURIComponent(productId)}`}
      columns={columns}
      gridKey="product-sales-orders-grid"
      urlPrefix="sales-orders"
      fetchAll={false}
      rowIdField="id"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid row lacks strict type
      rowHref={(row: any) => `/sales-orders/${row.id}`}
    />
  );
}
