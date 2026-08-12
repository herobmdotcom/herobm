import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import DetailTabGrid from '@/components/shared/DetailTabGrid';
import { KitComponentSlideOver } from './KitComponentSlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface ProductKitComponentsTabProps {
  productId: string;
  isEditable: boolean;
}

export const ProductKitComponentsTab: React.FC<ProductKitComponentsTabProps> = ({ productId, isEditable }) => {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const [refreshKey, setRefreshKey] = useState(0);
  const [slideOverState, setSlideOverState] = useState<{
    isOpen: boolean;
    componentId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    existingData?: any;
  }>({ isOpen: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const columns: any[] = [
    { field: 'sequenceNumber', headerName: '#', width: 60 },
    { field: 'productNumber', headerName: t('columns.productNumber'), width: 150 },
    { field: 'name', headerName: t('columns.name'), flex: 1 },
    { field: 'parentQuantity', headerName: t('columns.parentQuantity'), type: 'numericColumn', width: 120 },
    { field: 'quantity', headerName: t('columns.quantity'), type: 'numericColumn', width: 120 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    { field: 'fractionalBehavior', headerName: 'Fraction Rule', width: 150, valueFormatter: (p: any) => p.value?.replace('_', ' ') || '' },
    { field: 'baseUom', headerName: t('columns.baseUom'), width: 100 },
    ...(isEditable ? [{
      headerName: '',
      field: '_actions',
      width: 150,
      sortable: false,
      filter: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      cellRenderer: (params: any) => params.data ? (
        <div className="flex gap-1 items-center h-full">
          <Button size="sm" variant="ghost" className="min-h-0 h-8 px-2 text-[#006b5c] hover:bg-[#006b5c]/10" onClick={() => handleEdit(params.data)} title={tCommon('edit')}>
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 min-h-0 h-8 px-2" onClick={() => handleDelete(params.data)} title={tCommon('delete')}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </Button>
        </div>
      ) : null
    }] : [])
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleEdit = (row: any) => {
    setSlideOverState({
      isOpen: true,
      componentId: row.componentId,
      existingData: row,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleDelete = async (row: any) => {
    if (!window.confirm(t('confirmRemoveComponent'))) return;
    try {
      await api.productsControllerRemoveComponent(productId, row.componentId);
      toast.success(t('toast.componentRemoved'));
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DetailTabGrid
        title={t('tabs.kitComponents')}
        headerActions={
          <Button
            size="sm"
            variant="primary"
            className="bg-[#006b5c] hover:bg-[#005246] border-none text-white flex items-center gap-1.5"
            onClick={() => setSlideOverState({ isOpen: true })}
            disabled={!isEditable}
          >
            {t('addComponent')}
          </Button>
        }
        endpoint={`/api/products/${productId}/components?r=${refreshKey}`}
        columns={columns}
        gridKey="kit-components-grid"
        urlPrefix="components"
        fetchAll
        rowIdField="componentId"
      />

      <KitComponentSlideOver
        isOpen={slideOverState.isOpen}
        onClose={() => setSlideOverState({ isOpen: false })}
        productId={productId}
        componentId={slideOverState.componentId}
        existingData={slideOverState.existingData}
        onSaved={() => {
          setSlideOverState({ isOpen: false });
          setRefreshKey(k => k + 1);
        }}
      />
    </>
  );
};
