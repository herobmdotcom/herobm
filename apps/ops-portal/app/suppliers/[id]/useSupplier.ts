'use client';

import { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';

export type Supplier = api.SupplierResponseDto;

export function useSupplier(id: string) {
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [availableTradingTerms, setAvailableTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [supplierGroups, setSupplierGroups] = useState<api.SupplierGroupResponseDto[]>([]);

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

  useEffect(() => {
    api.tradingTermsControllerFindAll()
      .then((res: unknown) => setAvailableTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[]))
      .catch(console.error);
    api.taxPositionsControllerFindAll()
      .then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[]))
      .catch(console.error);
    api.supplierGroupsControllerFindAll()
      .then((res: unknown) => setSupplierGroups((res as { data: unknown[] }).data as unknown as api.SupplierGroupResponseDto[]))
      .catch(console.error);
  }, []);

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
