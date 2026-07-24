import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import AddSupplierModal from '@/components/products/AddSupplierModal';

interface ProductSuppliersTabProps {
  productId: string;
  productName: string;
  productNumber: string;
  isEditable: boolean;
}

export function ProductSuppliersTab({ productId, productName, productNumber, isEditable }: ProductSuppliersTabProps) {
  const router = useRouter();
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tStates = useTranslations('common.states');

  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [refreshGrid, setRefreshGrid] = useState(0);

  const removeSupplier = async (vendorId: string, vendorName: string) => {
    if (!window.confirm(t('suppliers.confirmUnlink', { name: vendorName }))) return;
    try {
      await api.productsControllerRemoveSupplier(productId, vendorId);
      toast.success(t('suppliers.toast.unlinked'));
      setRefreshGrid(prev => prev + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
  const supplierColumns: any[] = useMemo(() => [
    { field: 'vendorName', headerName: tCommon('columns.name'), flex: 1, minWidth: 160 },
    { field: 'vendorNumber', headerName: tCommon('columns.number'), width: 140 },
    { field: 'supplierPartNumber', headerName: t('products.supplierModal.inputs.supplierPartNo'), width: 140 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    { field: 'costPrice', headerName: t('products.supplierModal.inputs.costPrice'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `$${parseFloat(p.value).toFixed(2)}` : '—' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    { field: 'discountPercent', headerName: tCommon('columns.discountPct'), type: 'numericColumn', width: 120, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value)}%` : '—' },
    { 
      field: 'stateCode', 
      headerName: tCommon('columns.status'), 
      width: 110, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const s = String(p.value).toLowerCase();
        return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
      } 
    },
    {
      headerName: '',
      field: 'vendorId',
      width: 70,
      suppressMenu: true,
      sortable: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      onCellClicked: (p: any) => p.event?.stopPropagation(), // prevent triggering row click
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      cellRenderer: (p: { value: string, data: any }) => (
        <Button 
          onClick={(e) => { e.stopPropagation(); removeSupplier(p.value, p.data.vendorName); }}
          size="xs"
          variant="ghost"
          className="text-red-500 hover:bg-red-50 px-2 h-7 min-h-7"
          title={t('suppliers.buttons.unlinkSupplier')}
        >
          { }
          <span className="material-symbols-outlined text-[16px]">link_off</span>
        </Button>
      )
    }
  ], [tCommon, t, tStates]);

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
        <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
          <DataGrid 
            endpoint={`/api/suppliers/by-product/${encodeURIComponent(productId)}?r=${refreshGrid}`}
            columns={supplierColumns}
            gridKey={`product-suppliers-grid`}
            urlPrefix="suppliers"
            fetchAll
            rowIdField="vendorId"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
            onRowClicked={(row: any) => router.push(`/suppliers/${row.vendorId}`)}
            renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tCommon('tabs.suppliers')}
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
                  <Button 
                    size="sm"
                    variant="primary"
                    className="bg-[#006b5c] hover:bg-[#005246] border-none text-white flex items-center gap-1.5"
                    onClick={() => setIsAddSupplierOpen(true)}
                    disabled={!isEditable}
                  >
                    { }
                    <span className="material-symbols-outlined text-[16px]">add_link</span>
                    {t('products.supplierModal.title')}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <AddSupplierModal 
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        productId={productId}
        productName={productName}
        productNumber={productNumber}
        onSuccess={() => setRefreshGrid(prev => prev + 1)}
      />
    </>
  );
}
