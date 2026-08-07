import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import DataGrid from '@/components/DataGrid';

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
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : ''
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
    <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
      <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
        <DataGrid 
          endpoint={`/api/sales-orders?productId=${encodeURIComponent(productId)}`}
          columns={columns}
          gridKey="product-sales-orders-grid"
          urlPrefix="sales-orders"
          fetchAll={false}
          rowIdField="id"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DataGrid row lacks strict type
          rowHref={(row: any) => `/sales-orders/${row.id}`}
          renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('salesOrders.sales')}
                </h2>
                <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                  <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tCommon('grid.rowCountLabel')}
                  </span>
                  <span className="text-[11px] font-bold text-[#006b5c]">
                    {loading ? '...' : rowCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex-1 ml-4 max-w-md">
                  {searchInput}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {optionsButton}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
