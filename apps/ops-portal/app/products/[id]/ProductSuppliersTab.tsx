import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
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
      <DetailTabGrid
        title={tCommon('tabs.suppliers')}
        headerActions={
          <Button 
            size="sm"
            variant="primary"
            className="bg-[#006b5c] hover:bg-[#005246] border-none text-white flex items-center gap-1.5"
            onClick={() => setIsAddSupplierOpen(true)}
            disabled={!isEditable}
          >
            <span className="material-symbols-outlined text-[16px]">add_link</span>
            {t('products.supplierModal.title')}
          </Button>
        }
        endpoint={`/api/suppliers/by-product/${encodeURIComponent(productId)}?r=${refreshGrid}`}
        columns={supplierColumns}
        gridKey={`product-suppliers-grid`}
        urlPrefix="suppliers"
        fetchAll
        rowIdField="vendorId"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        rowHref={(row: any) => `/suppliers/${row.vendorId}`}
      />

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
