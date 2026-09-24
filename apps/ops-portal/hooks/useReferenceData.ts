'use client';

import useSWR from 'swr';
import * as api from '@herobm/sdk';

const REFERENCE_SWR_CONFIG = {
  dedupingInterval: 60000, // 1 minute
  revalidateOnFocus: false,
  revalidateIfStale: false,
};

export function useTaxPositions() {
  const { data = [], error, isLoading, mutate } = useSWR<api.TaxPositionResponseDto[]>(
    'ref-tax-positions',
    async () => {
      const res = await api.taxPositionsControllerFindAll();
      return (res.data || []) as api.TaxPositionResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    taxPositions: data,
    isLoading,
    error,
    mutate,
  };
}

export function useTradingTerms() {
  const { data = [], error, isLoading, mutate } = useSWR<api.TradingTermResponseDto[]>(
    'ref-trading-terms',
    async () => {
      const res = await api.tradingTermsControllerFindAll();
      return (res.data || []) as api.TradingTermResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    tradingTerms: data,
    isLoading,
    error,
    mutate,
  };
}

export function useCustomerGroups() {
  const { data = [], error, isLoading, mutate } = useSWR<api.CustomerGroupResponseDto[]>(
    'ref-customer-groups',
    async () => {
      const res = await api.customerGroupsControllerFindAll();
      return (res.data || []) as api.CustomerGroupResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    customerGroups: data,
    isLoading,
    error,
    mutate,
  };
}

export function useSupplierGroups() {
  const { data = [], error, isLoading, mutate } = useSWR<api.SupplierGroupResponseDto[]>(
    'ref-supplier-groups',
    async () => {
      const res = await api.supplierGroupsControllerFindAll();
      return (res.data || []) as api.SupplierGroupResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    supplierGroups: data,
    isLoading,
    error,
    mutate,
  };
}

export function useTaxCategories() {
  const { data = [], error, isLoading, mutate } = useSWR<api.TaxCategoryResponseDto[]>(
    'ref-tax-categories',
    async () => {
      const res = await api.taxCategoriesControllerFindAll();
      return (res.data || []) as api.TaxCategoryResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    taxCategories: data,
    isLoading,
    error,
    mutate,
  };
}

export function useGlBankAccounts() {
  const { data = [], error, isLoading, mutate } = useSWR<api.GlAccountResponseDto[]>(
    'ref-gl-bank-accounts',
    async () => {
      const res = await api.glControllerGetAccounts({ isBankAccount: 'true' });
      return (res.data || []) as api.GlAccountResponseDto[];
    },
    REFERENCE_SWR_CONFIG
  );

  return {
    bankAccounts: data,
    isLoading,
    error,
    mutate,
  };
}
