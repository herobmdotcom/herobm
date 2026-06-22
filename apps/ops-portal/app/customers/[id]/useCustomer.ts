'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { CUSTOMER_STATE } from '@herobm/shared';
import type { ValidState } from '@/types/states';
import { getErrorMessage } from '@herobm/shared';

export type Customer = api.AccountResponseDto & { parentCustomerName?: string | null; childAccounts?: unknown[] };

/* ── Hook ────────────────────────────────────────────────────────── */

export function useAccount(id: string) {
  const t = useTranslations();

  /* ── Core state ──────────────────────────────────────────────── */
  const [customer, setAccount] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Editable DTO (mirrors customer, mutated locally) ─────────── */
  const [dto, setDto] = useState<Partial<Customer>>({});
  const [isDirty, setIsDirty] = useState(false);

  /* ── Tax positions & Trading terms ───────────────────────────── */
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [accountGroups, setAccountGroups] = useState<api.AccountGroupResponseDto[]>([]);

  const [hasDiscountRules, setHasDiscountRules] = useState(false);

  /* ── Derived ─────────────────────────────────────────────────── */
  const isEditable = customer?.stateCode !== CUSTOMER_STATE.ARCHIVED;
  const [creditAssessment, setCreditAssessment] = useState<api.CreditAssessmentResponseDto | null>(null);

  /* ── Data loader ─────────────────────────────────────────────── */

  const loadAccount = async () => {
    setLoading(true);
    try {
      const [dataRes, rulesRes, creditRes] = await Promise.all([
        api.accountsControllerFindOne(id),
        api.discountMatrixControllerList({ ownerType: 'customer', customerId: id }).catch(() => ({ data: [] })),
        api.accountsControllerGetCreditAssessment(id).catch(() => ({ data: null }))
      ]);
      const data = dataRes.data;
      const rules = rulesRes.data || [];
      setAccount(data);
      setDto(data);
      setCreditAssessment(creditRes.data);
      setHasDiscountRules(rules && rules.length > 0);
      setIsDirty(false);
    } catch (err) {
      reportError(err, 'AccountDetailPage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
    api.tradingTermsControllerFindAll().then((res: unknown) => setTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[])).catch(console.error);
    api.accountGroupsControllerFindAll().then((res: unknown) => setAccountGroups((res as { data: unknown[] }).data as unknown as api.AccountGroupResponseDto[])).catch(console.error);
  }, [id]);

  /* ── Field helpers ──────────────────────────────────────────── */

  /** Update a field in the local DTO (no network call). */
  const updateField = (field: keyof Customer, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  /** Persist the current DTO to the server (replaces the old timer-based auto-save). */
  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const res = await api.accountsControllerUpdate(id, dto as api.UpdateAccountDto);
      const updated = res.data;
      setAccount({ ...updated, events: customer?.events });
      setDto({ ...updated, events: customer?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh to get updated events
      const refreshedRes = await api.accountsControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save a single field on blur. This is the standard onBlur pattern:
   * update the local DTO then persist if the value actually changed.
   */
  const saveField = async (field: keyof Customer, value: unknown) => {
    // Only persist if the value actually changed vs the server state
    const serverValue = customer ? customer[field] : undefined;
    if (value === serverValue || (value === '' && serverValue === null)) return;

    // Optimistically update DTO
    const nextDto = { ...dto, [field]: value };
    setDto(nextDto);

    setSaving(true);
    try {
      const res = await api.accountsControllerUpdate(id, nextDto as api.UpdateAccountDto);
      const updated = res.data;
      setAccount({ ...updated, events: customer?.events });
      setDto({ ...updated, events: customer?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh events
      const refreshedRes = await api.accountsControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── Archive / Unarchive ────────────────────────────────────── */

  const archiveAccount = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await api.accountsControllerArchive(id, {});
      toast.success(t('toast.orderArchived'));
      const refreshedRes = await api.accountsControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unarchiveAccount = async () => {
    setSaving(true);
    try {
      await api.accountsControllerUnarchive(id, {});
      toast.success(t('toast.orderUnarchived'));
      const refreshedRes = await api.accountsControllerFindOne(id);
      const refreshed = refreshedRes.data;
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    customer,
    loading,
    saving,
    dto,
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
