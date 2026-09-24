'use client';

import * as api from '@herobm/sdk';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { useTaxPositions, useTradingTerms, useSupplierGroups } from '@/hooks/useReferenceData';

export type Supplier = api.SupplierResponseDto;

export function useSupplier(id: string) {
  const { taxPositions } = useTaxPositions();
  const { tradingTerms: availableTradingTerms } = useTradingTerms();
  const { supplierGroups } = useSupplierGroups();

  const fetchFn = async (supplierId: string) => {
    const res = await api.suppliersControllerFindOne(supplierId);
    return res as unknown as { data: Supplier };
  };

  const {
    entity: supplier,
    setEntity: setSupplier,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadEntity: loadSupplier,
    updateField,
    saveField,
    handleSave,
  } = useAutoSaveEntity<Supplier, Partial<Supplier>>({
    id,
    fetchFn,
    updateFn: (id, dto) => api.suppliersControllerUpdate(id, dto as api.UpdateSupplierDto),
  });

  return {
    supplier,
    setSupplier,
    dto,
    setDto,
    loading,
    saving,
    setSaving,
    isDirty,
    loadSupplier,
    updateField,
    saveField,
    handleSave,
    taxPositions,
    availableTradingTerms,
    supplierGroups,
  };
}
