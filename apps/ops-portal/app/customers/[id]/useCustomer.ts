'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { useTaxPositions, useTradingTerms, useCustomerGroups } from '@/hooks/useReferenceData';
import { CUSTOMER_STATE } from '@herobm/shared';
import type { ValidState } from '@/types/states';
import { getErrorMessage } from '@herobm/shared';

export type Customer = api.CustomerResponseDto & { parentCustomerName?: string | null; childAccounts?: { customerId: string; name: string; customerNumber?: string }[] };

/* ── Hook ────────────────────────────────────────────────────────── */

export function useAccount(id: string) {
  const t = useTranslations();

  /* ── Extra state ─────────────────────────────────────────────── */
  const { taxPositions } = useTaxPositions();
  const { tradingTerms } = useTradingTerms();
  const { customerGroups: accountGroups } = useCustomerGroups();
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
