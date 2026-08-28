import { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage, PRODUCT_STATE } from '@herobm/shared';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';

export function useProduct(id: string) {
  const t = useTranslations();
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [productGroups, setProductGroups] = useState<api.ProductGroupResponseDto[]>([]);
  const [uomDictionary, setUomDictionary] = useState<{ uomCode: string; description: string }[]>([]);
  
  const fetchFn = async (id: string) => {
    return api.productsControllerFindOne(id);
  };

  const {
    entity: product,
    setEntity: setProduct,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadEntity: loadProduct,
    updateField,
    saveField,
    handleSave,
  } = useAutoSaveEntity<api.ProductResponseDto, Partial<api.ProductResponseDto>>({
    id,
    fetchFn,
    updateFn: (id, dto) => api.productsControllerUpdate(id, dto as api.UpdateProductDto),
  });

  useEffect(() => {
    api.taxCategoriesControllerFindAll()
      .then((res) => setTaxCategories(res.data))
      .catch((err) => toast.error('Failed to load tax categories: ' + getErrorMessage(err)));
    api.productGroupsControllerFindAll()
      .then((res: unknown) => setProductGroups((res as { data: unknown[] }).data as unknown as api.ProductGroupResponseDto[]))
      .catch((err) => toast.error('Failed to load product groups: ' + getErrorMessage(err)));
    api.uomDictionaryControllerFindAll()
      .then((res) => setUomDictionary(res.data))
      .catch((err) => toast.error('Failed to load UOM dictionary: ' + getErrorMessage(err)));
  }, []);

  const archiveProduct = async () => {
    if (!product || saving) return;
    if (!window.confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await api.productsControllerArchive(id, {});
      await loadProduct();
      toast.success(t('toast.productUpdated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveProduct = async () => {
    if (!product || saving) return;
    setSaving(true);
    try {
      await api.productsControllerUnarchive(id, {});
      await loadProduct();
      toast.success(t('toast.productUpdated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return {
    product,
    setProduct,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadProduct,
    updateField,
    saveField,
    handleSave,
    taxCategories,
    productGroups,
    uomDictionary,
    archiveProduct,
    unarchiveProduct,
  };
}
