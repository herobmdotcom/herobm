'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { CUSTOMER_STATE } from '@modbm/shared';
import type { ValidState } from '@/types/states';

/* ── Customer shape ───────────────────────────────────────────────── */

export interface Customer {
  customerId: string;
  customerNumber: string;
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
  customerGroupId: string | null;
  taxCategoryId: string | null;
  currencyCode: string;
  customerDiscount: string | null;
  stateCode: ValidState;
  notes: string | null;
  parentCustomerId: string | null;
  parentCustomerName?: string | null;
  childAccounts?: any[];

  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;

  createdOn: string | null;
  createdBy: string | null;
  modifiedOn: string | null;
  events?: any[];
}

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

  /* ── Tax categories ─────────────────────────────────────────── */
  const [taxCategories, setTaxCategories] = useState<any[]>([]);

  const [hasDiscountRules, setHasDiscountRules] = useState(false);

  /* ── Derived ─────────────────────────────────────────────────── */
  const isEditable = customer?.stateCode !== CUSTOMER_STATE.ARCHIVED;

  /* ── Data loader ─────────────────────────────────────────────── */

  const loadAccount = async () => {
    setLoading(true);
    try {
      const [data, rules] = await Promise.all([
        apiFetch<Customer>(`/api/customers/${id}`),
        apiFetch<any[]>(`/api/discount-matrix?ownerType=customer&customerId=${id}`).catch(() => [])
      ]);
      setAccount(data);
      setDto(data);
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
    apiFetch<any[]>('/api/tax-categories').then(setTaxCategories).catch(console.error);
  }, [id]);

  /* ── Field helpers ──────────────────────────────────────────── */

  /** Update a field in the local DTO (no network call). */
  const updateField = (field: keyof Customer, value: any) => {
    setDto((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  /** Persist the current DTO to the server (replaces the old timer-based auto-save). */
  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const updated = await apiMutate<Customer>(
        `/api/customers/${id}`,
        'PATCH',
        dto,
      );
      setAccount({ ...updated, events: customer?.events });
      setDto({ ...updated, events: customer?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh to get updated events
      const refreshed = await apiFetch<Customer>(`/api/customers/${id}`);
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
  const saveField = async (field: keyof Customer, value: any) => {
    // Only persist if the value actually changed vs the server state
    const serverValue = customer ? (customer as any)[field] : undefined;
    if (value === serverValue || (value === '' && serverValue === null)) return;

    // Optimistically update DTO
    const nextDto = { ...dto, [field]: value };
    setDto(nextDto);

    setSaving(true);
    try {
      const updated = await apiMutate<Customer>(
        `/api/customers/${id}`,
        'PATCH',
        nextDto,
      );
      setAccount({ ...updated, events: customer?.events });
      setDto({ ...updated, events: customer?.events });
      setIsDirty(false);
      toast.success(t('toast.accountUpdated'));
      // Refresh events
      const refreshed = await apiFetch<Customer>(`/api/customers/${id}`);
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
      await apiMutate(`/api/customers/${id}/archive`, 'POST');
      toast.success(t('toast.orderArchived'));
      const refreshed = await apiFetch<Customer>(`/api/customers/${id}`);
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
      await apiMutate(`/api/customers/${id}/unarchive`, 'POST');
      toast.success(t('toast.orderUnarchived'));
      const refreshed = await apiFetch<Customer>(`/api/customers/${id}`);
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
    customer,
    loading,
    saving,
    dto,
    isDirty,
    isEditable,
    taxCategories,
    hasDiscountRules,

    // Field helpers
    updateField,
    saveField,
    handleSave,

    // Actions
    archiveAccount,
    unarchiveAccount,
  };
}
