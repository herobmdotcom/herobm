import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import DataGrid from '@/components/DataGrid';
import { KitComponentSlideOver } from './KitComponentSlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

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
          <button className="btn btn-sm btn-ghost min-h-0 h-8 px-2 text-[#006b5c] hover:bg-[#006b5c]/10" onClick={() => handleEdit(params.data)} title={tCommon('edit')}>
            { }
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button className="btn btn-sm btn-ghost text-red-500 hover:bg-red-50 min-h-0 h-8 px-2" onClick={() => handleDelete(params.data)} title={tCommon('delete')}>
            { }
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
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

  // Render actions now handled inside the columns definition

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full pb-6">
      <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
        <DataGrid
          endpoint={`/api/products/${productId}/components?r=${refreshKey}`}
          columns={columns}
          gridKey="kit-components-grid"
          urlPrefix="components"
          fetchAll
          rowIdField="componentId"
          renderHeader={({ rowCount, loading }: { rowCount: number, loading: boolean }) => (
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('tabs.kitComponents')}
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
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <button
                  className="btn btn-sm btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white shadow-sm flex items-center gap-1.5"
                  onClick={() => setSlideOverState({ isOpen: true })}
                  disabled={!isEditable}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined text-[16px]">add</span>
                  {t('addComponent')}
                </button>
              </div>
            </div>
          )}
        />
      </div>

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
    </div>
  );
};
