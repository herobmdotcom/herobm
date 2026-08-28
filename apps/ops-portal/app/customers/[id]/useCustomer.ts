'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { CUSTOMER_STATE } from '@herobm/shared';
import type { ValidState } from '@/types/states';
import { getErrorMessage } from '@herobm/shared';

export type Customer = api.CustomerResponseDto & { parentCustomerName?: string | null; childAccounts?: { customerId: string; name: string; customerNumber?: string }[] };

/* ── Hook ────────────────────────────────────────────────────────── */

export function useAccount(id: string) {
  const t = useTranslations();

  /* ── Extra state ─────────────────────────────────────────────── */
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [accountGroups, setAccountGroups] = useState<api.CustomerGroupResponseDto[]>([]);
  const [hasDiscountRules, setHasDiscountRules] = useState(false);
  const [creditAssessment, setCreditAssessment] = useState<api.CreditAssessmentResponseDto | null>(null);

  /* ── Auto Save Hook ──────────────────────────────────────────── */
  const fetchFn = async (customerId: string) => {
    const [dataRes, rulesRes, creditRes] = await Promise.all([
      api.customersControllerFindOne(customerId),
      api.discountMatrixControllerList({ ownerType: 'customer', customerId }).catch(() => ({ data: [] })),
      api.customersControllerGetCreditAssessment(customerId).catch(() => ({ data: null }))
    ]);
    setHasDiscountRules(rulesRes.data && rulesRes.data.length > 0);
    setCreditAssessment(creditRes.data);
    return dataRes as unknown as { data: Customer };
  };

  const {
    entity: customer,
    setEntity: setAccount,
    dto,
    setDto,
    loading,
    saving,
    isDirty,
    loadEntity: loadAccount,
    updateField,
    saveField,
    handleSave,
  } = useAutoSaveEntity<Customer, Partial<Customer>>({
    id,
    fetchFn,
    updateFn: (id, dto) => api.customersControllerUpdate(id, dto as api.UpdateCustomerDto),
  });

  const isEditable = customer?.stateCode !== CUSTOMER_STATE.ARCHIVED;
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch((err) => toast.error('Failed to load tax positions: ' + getErrorMessage(err)));
    api.tradingTermsControllerFindAll().then((res: unknown) => setTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[])).catch((err) => toast.error('Failed to load trading terms: ' + getErrorMessage(err)));
    api.customerGroupsControllerFindAll().then((res: unknown) => setAccountGroups((res as { data: unknown[] }).data as unknown as api.CustomerGroupResponseDto[])).catch((err) => toast.error('Failed to load customer groups: ' + getErrorMessage(err)));
  }, [id]);

  /* ── Archive / Unarchive ────────────────────────────────────── */

  const [isSaving, setIsSaving] = useState(false);

  const archiveAccount = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setIsArchiving(true);
    try {
      await api.customersControllerArchive(id, {});
      toast.success(t('toast.orderArchived'));
      const refreshedRes = await api.customersControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsArchiving(false);
    }
  };

  const unarchiveAccount = async () => {
    setIsArchiving(true);
    try {
      await api.customersControllerUnarchive(id, {});
      toast.success(t('toast.orderUnarchived'));
      const refreshedRes = await api.customersControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    customer,
    loading,
    saving: saving || isSaving,
    dto: dto as Partial<Customer>,
    isDirty,
    isEditable,
    taxPositions,
    tradingTerms,
    accountGroups,
    hasDiscountRules,
    creditAssessment,

    // Field helpers
    updateField,
    saveField,
    handleSave,

    // Actions
    archiveAccount,
    unarchiveAccount,
    loadAccount,
  };
}
