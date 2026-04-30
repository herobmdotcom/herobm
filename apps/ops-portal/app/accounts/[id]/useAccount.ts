'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import type { ValidState } from '@/types/states';

/* ── Account shape ───────────────────────────────────────────────── */

export interface Account {
  accountId: string;
  accountNumber: string;
  name: string;
  emailAddress1: string | null;
  telephone1: string | null;
  fax: string | null;
  address1Line1: string | null;
  address1Line2: string | null;
  address1City: string | null;
  address1StateOrProvince: string | null;
  address1PostalCode: string | null;
  address1Country: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  accountGroupId: string | null;
  taxCategoryId: string | null;
  currencyCode: string;
  customerDiscount: string | null;
  stateCode: ValidState;
  notes: string | null;

  createdOn: string | null;
  createdBy: string | null;
  modifiedOn: string | null;
  events?: any[];
}

/* ── Hook ────────────────────────────────────────────────────────── */

export function useAccount(id: string) {
  const t = useTranslations();

  /* ── Core state ──────────────────────────────────────────────── */
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Editable DTO (mirrors account, mutated locally) ─────────── */
  const [dto, setDto] = useState<Partial<Account>>({});
  const [isDirty, setIsDirty] = useState(false);

  /* ── Tax categories ─────────────────────────────────────────── */
  const [taxCategories, setTaxCategories] = useState<any[]>([]);

  /* ── Derived ─────────────────────────────────────────────────── */
  const isEditable = account?.stateCode !== 'archived';

  /* ── Data loader ─────────────────────────────────────────────── */

  const loadAccount = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Account>(`/api/accounts/${id}`);
      setAccount(data);
      setDto(data);
      setIsDirty(false);
    } catch (err) {
      reportError(err, 'AccountDetailPage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
    apiFetch<any[]>('/api/tax-categories').then(setTaxCategories).catch(console.error);
  }, [id]);

  /* ── Field helpers ──────────────────────────────────────────── */

  /** Update a field in the local DTO (no network call). */
  const updateField = (field: keyof Account, value: any) => {
    setDto((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  /** Persist the current DTO to the server (replaces the old timer-based auto-save). */
  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const updated = await apiMutate<Account>(
        `/api/accounts/${id}`,
        'PATCH',
        dto,
      );
      setAccount({ ...updated, events: account?.events });
      setDto({ ...updated, events: account?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh to get updated events
      const refreshed = await apiFetch<Account>(`/api/accounts/${id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Save a single field on blur. This is the standard onBlur pattern:
   * update the local DTO then persist if the value actually changed.
   */
  const saveField = async (field: keyof Account, value: any) => {
    // Only persist if the value actually changed vs the server state
    const serverValue = account ? (account as any)[field] : undefined;
    if (value === serverValue || (value === '' && serverValue === null)) return;

    // Optimistically update DTO
    const nextDto = { ...dto, [field]: value };
    setDto(nextDto);

    setSaving(true);
    try {
      const updated = await apiMutate<Account>(
        `/api/accounts/${id}`,
        'PATCH',
        nextDto,
      );
      setAccount({ ...updated, events: account?.events });
      setDto({ ...updated, events: account?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh events
      const refreshed = await apiFetch<Account>(`/api/accounts/${id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Archive / Unarchive ────────────────────────────────────── */

  const archiveAccount = async () => {
    if (!confirm(t('confirm.archiveOrder'))) return;
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${id}/archive`, 'POST');
      toast.success(t('toast.orderArchived'));
      const refreshed = await apiFetch<Account>(`/api/accounts/${id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const unarchiveAccount = async () => {
    setSaving(true);
    try {
      await apiMutate(`/api/accounts/${id}/unarchive`, 'POST');
      toast.success(t('toast.orderUnarchived'));
      const refreshed = await apiFetch<Account>(`/api/accounts/${id}`);
      setAccount(refreshed);
      setDto(refreshed);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Public API ─────────────────────────────────────────────── */

  return {
    account,
    loading,
    saving,
    dto,
    isDirty,
    isEditable,
    taxCategories,

    // Field helpers
    updateField,
    saveField,
    handleSave,

    // Actions
    archiveAccount,
    unarchiveAccount,
  };
}
