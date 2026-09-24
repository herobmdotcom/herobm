'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import AddSupplierModal, { SupplierLinkInitialData } from '@/components/products/AddSupplierModal';

export interface ProductSupplierItem {
  productSupplierId?: string;
  vendorId: string;
  vendorName?: string;
  vendorNumber?: string;
  supplierPartNumber?: string | null;
  costPrice?: string | null;
  discountPercent?: string | null;
  isPreferred?: boolean;
  minPurchaseQty?: string | null;
  purchaseUnit?: string | null;
  stateCode?: string | null;
}

interface ProductSuppliersTabProps {
  productId: string;
  productName: string;
  productNumber: string;
  isEditable: boolean;
}

export function ProductSuppliersTab({
  productId,
  productName,
  productNumber,
  isEditable,
}: ProductSuppliersTabProps) {
  const router = useRouter();
  const t = useTranslations();
  const tCommon = useTranslations('common');

  const [suppliers, setSuppliers] = useState<ProductSupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ProductSupplierItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.suppliersControllerFindByProduct(productId, { limit: 100 });
      const rawData = res.data;
      const list: ProductSupplierItem[] = Array.isArray(rawData)
        ? (rawData as unknown as ProductSupplierItem[])
        : Array.isArray((rawData as { data?: unknown })?.data)
        ? ((rawData as { data: unknown[] }).data as unknown as ProductSupplierItem[])
        : [];
      setSuppliers(list);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const removeSupplier = async (vendorId: string, vendorName?: string) => {
    if (!window.confirm(t('suppliers.confirmUnlink', { name: vendorName || vendorId }))) return;
    try {
      await api.productsControllerRemoveSupplier(productId, vendorId);
      toast.success(t('suppliers.toast.unlinked'));
      await loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
        <h3 className="section-heading !mb-0 flex items-center gap-2">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined">store</span>
          {tCommon('tabs.suppliers')}
        </h3>
        {isEditable && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/purchase-orders/new?productId=${productId}`)}
            >
              {t('purchaseOrders.buttons.createPO')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingSupplier(null);
                setIsAddSupplierOpen(true);
              }}
            >
              {t('products.supplierModal.title')}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-40">storefront</span>
          {tCommon('noMatchingResults')}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-4">
          {suppliers.map((s) => {
            const displayName = s.vendorName || s.vendorNumber || s.vendorId;
            const moqVal = s.minPurchaseQty ? parseFloat(s.minPurchaseQty) : null;
            return (
              <LinkedEntityCard
                key={s.productSupplierId || s.vendorId}
                icon="store"
                title={displayName}
                href={`/suppliers/${s.vendorId}`}
                subtitle={[
                  s.isPreferred ? t('products.costSummary.preferredSupplier') : null,
                  s.vendorNumber ? `#${s.vendorNumber}` : null,
                  s.supplierPartNumber ? `${t('products.supplierModal.inputs.supplierPartNo')}: ${s.supplierPartNumber}` : null,
                  moqVal && moqVal > 0 ? `MOQ: ${moqVal}${s.purchaseUnit ? ` ${s.purchaseUnit}` : ''}` : null,
                  s.discountPercent && parseFloat(s.discountPercent) > 0 ? `${tCommon('columns.discountPct')}: ${parseFloat(s.discountPercent)}%` : null,
                ]}
                amount={s.costPrice ? `$${parseFloat(s.costPrice).toFixed(2)}` : undefined}
                amountSubtext={s.costPrice ? t('products.supplierModal.inputs.costPrice') : undefined}
                status={s.stateCode || undefined}
                actions={
                  isEditable ? (
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/purchase-orders/new?vendorId=${s.vendorId}&productId=${productId}`);
                        }}
                        size="xs"
                        variant="ghost"
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] h-7 w-7 p-0"
                        title={t('purchaseOrders.buttons.createPO')}
                      >
                        <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingSupplier(s);
                          setIsAddSupplierOpen(true);
                        }}
                        size="xs"
                        variant="ghost"
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] h-7 w-7 p-0"
                        title={t('suppliers.buttons.editSupplier')}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSupplier(s.vendorId, s.vendorName);
                        }}
                        size="xs"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 h-7 w-7 p-0"
                        title={t('suppliers.buttons.unlinkSupplier')}
                      >
                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      <AddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => {
          setIsAddSupplierOpen(false);
          setEditingSupplier(null);
        }}
        productId={productId}
        productName={productName}
        productNumber={productNumber}
        initialData={editingSupplier}
        onSuccess={loadData}
      />
    </div>
  );
}
