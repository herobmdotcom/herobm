'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import DataGrid from '@/components/DataGrid';
import { Button } from '@/components/shared/Button';
import SlideOver from '@/components/shared/SlideOver';
import SupplierSelect, { Supplier } from '@/components/shared/SupplierSelect';
import ProductSelect, { Product as ProductOption } from '@/components/shared/ProductSelect';
import { routes } from '@/lib/routes';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { resolveContractorUnitCost } from '@/lib/resource-utils';
import { useSettings } from '@/components/SettingsProvider';
import * as api from '@herobm/sdk';
import {
  RESOURCE_TYPE,
  ResourceType,
  PROJECT_RESOURCE_STATE,
  getErrorMessage,
} from '@herobm/shared';
import type { ColDef } from 'ag-grid-community';

function extractArrayData<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

export default function ResourcesListClient() {
  const t = useTranslations('projects');
  const searchParams = useSearchParams();
  const { baseCurrency } = useSettings();
  const currency = baseCurrency || 'USD';

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(PROJECT_RESOURCE_STATE.ACTIVE);
  const [gridRefreshKey, setGridRefreshKey] = useState<number>(0);

  // Reference data for creation modal
  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [uomDictionary, setUomDictionary] = useState<api.UomResponseDto[]>([]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    resourceType: ResourceType;
    userId: string;
    vendorId: string;
    serviceProductId: string;
    baseUom: string;
    directUnitCost: string;
    unitPrice: string;
    isActive: boolean;
  }>({
    name: '',
    resourceType: RESOURCE_TYPE.PERSON,
    userId: '',
    vendorId: '',
    serviceProductId: '',
    baseUom: 'HOUR',
    directUnitCost: '0.00',
    unitPrice: '0.00',
    isActive: true,
  });

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [usersRes, uomsRes] = await Promise.all([
          api.usersControllerFindAll(),
          api.uomDictionaryControllerFindAll(),
        ]);
        setUsers(extractArrayData<api.UserResponseDto>(usersRes?.data));
        const loadedUoms = extractArrayData<api.UomResponseDto>(uomsRes?.data);
        setUomDictionary(loadedUoms);
        if (loadedUoms.length > 0) {
          const initialDefault =
            loadedUoms.find((u) => u.uomCode === 'HR')?.uomCode ||
            loadedUoms.find((u) => u.uomCode === 'HOUR')?.uomCode ||
            loadedUoms.find((u) => (u.category || 'goods') === 'service')?.uomCode ||
            loadedUoms[0].uomCode;
          setCreateForm((p) => ({
            ...p,
            baseUom: loadedUoms.some((u) => u.uomCode === p.baseUom) ? p.baseUom : initialDefault,
          }));
        }
      } catch (err: unknown) {
        reportError(err, 'ResourcesListClient');
        toast.error(getErrorMessage(err));
      }
    }
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (searchParams?.get('create') === 'true' || searchParams?.get('action') === 'new') {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

  const defaultUom = useMemo(() => {
    if (uomDictionary.length === 0) return 'HOUR';
    const match =
      uomDictionary.find((u) => u.uomCode === 'HR') ||
      uomDictionary.find((u) => u.uomCode === 'HOUR') ||
      uomDictionary.find((u) => (u.category || 'goods') === 'service') ||
      uomDictionary[0];
    return match ? match.uomCode : 'HOUR';
  }, [uomDictionary]);

  const defaultDayUom = useMemo(() => {
    if (uomDictionary.length === 0) return 'DAY';
    const match =
      uomDictionary.find((u) => u.uomCode === 'DAY') ||
      uomDictionary.find((u) => (u.category || 'goods') === 'service') ||
      uomDictionary[0];
    return match ? match.uomCode : defaultUom;
  }, [uomDictionary, defaultUom]);

  const handleOpenCreateModal = () => {
    setCreateForm({
      name: '',
      resourceType: RESOURCE_TYPE.PERSON,
      userId: '',
      vendorId: '',
      serviceProductId: '',
      baseUom: defaultUom,
      directUnitCost: '0.00',
      unitPrice: '0.00',
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error(t('errors.nameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: api.CreateProjectResourceDto = {
        name: createForm.name.trim(),
        resourceType: createForm.resourceType,
        baseUom: createForm.baseUom,
        directUnitCost: Number(createForm.directUnitCost) || 0,
        unitPrice: Number(createForm.unitPrice) || 0,
        isActive: createForm.isActive,
        serviceProductId: createForm.serviceProductId || undefined,
      };

      if (createForm.resourceType === RESOURCE_TYPE.PERSON && createForm.userId) {
        payload.userId = createForm.userId;
      } else if (createForm.resourceType === RESOURCE_TYPE.CONTRACTOR && createForm.vendorId) {
        payload.vendorId = createForm.vendorId;
      }

      await api.projectsControllerCreateResource(payload);
      toast.success(t('toasts.resourceCreated'));
      setIsCreateOpen(false);
      setGridRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.failedToSaveResource'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo<ColDef<api.ProjectResourceResponseDto>[]>(
    () => [
      {
        field: 'resourceNumber',
        headerName: t('columns.resourceCode'),
        width: 140,
        pinned: 'left',
        cellRenderer: (params: { value?: string }) => (
          <span className="font-semibold text-[var(--accent)]">{params.value}</span>
        ),
      },
      {
        field: 'name',
        headerName: t('columns.resourceName'),
        minWidth: 200,
        flex: 2,
      },
      {
        field: 'resourceType',
        headerName: t('columns.resourceType'),
        width: 170,
        valueFormatter: (params) => {
          switch (params.value) {
            case RESOURCE_TYPE.PERSON:
              return t('resources.typePerson');
            case RESOURCE_TYPE.CONTRACTOR:
              return t('resources.typeContractor');
            case RESOURCE_TYPE.EQUIPMENT:
              return t('resources.typeEquipment');
            default:
              return params.value || '—';
          }
        },
      },
      {
        headerName: t('columns.linkedEntity'),
        minWidth: 180,
        flex: 1.5,
        valueGetter: (params) => {
          const row = params.data;
          if (!row) return '—';
          if (row.resourceType === RESOURCE_TYPE.PERSON) {
            let userStr = '';
            if (row.user) userStr = row.user.displayName || row.user.username;
            else {
              const u = Array.isArray(users) ? users.find((item) => item.userId === row.userId) : undefined;
              if (u) userStr = u.displayName || u.username;
            }
            if (row.serviceProduct) {
              return userStr ? `${userStr} (${row.serviceProduct.name})` : row.serviceProduct.name;
            }
            return userStr || '—';
          }
          if (row.resourceType === RESOURCE_TYPE.CONTRACTOR) {
            const supStr =
              row.vendor?.supplierName ||
              (row.vendor as unknown as { name?: string })?.name ||
              row.vendorId ||
              '—';
            if (row.serviceProduct) {
              return supStr !== '—' ? `${supStr} (${row.serviceProduct.name})` : row.serviceProduct.name;
            }
            return supStr;
          }
          if (row.resourceType === RESOURCE_TYPE.EQUIPMENT) {
            if (row.serviceProduct) return `${row.serviceProduct.name} (${row.serviceProduct.productNumber})`;
            return '—';
          }
          return '—';
        },
      },
      {
        field: 'baseUom',
        headerName: t('columns.baseUom'),
        width: 110,
        valueFormatter: (params) => params.value || '—',
      },
      {
        field: 'directUnitCost',
        headerName: t('columns.unitCost'),
        width: 130,
        valueFormatter: (params) => (params.value ? formatAmount(Number(params.value), currency) : '—'),
      },
      {
        field: 'unitPrice',
        headerName: t('columns.unitPrice'),
        width: 130,
        valueFormatter: (params) => (params.value ? formatAmount(Number(params.value), currency) : '—'),
      },
      {
        field: 'isActive',
        headerName: t('columns.status'),
        width: 120,
        valueFormatter: (params) =>
          params.value ? t('resources.filterActive') : t('resources.filterArchived'),
      },
    ],
    [t, currency, users]
  );

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter && typeFilter !== 'all') {
      params.set('resourceType', typeFilter);
    }
    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    const qs = params.toString();
    return qs ? `/api/projects/resources?${qs}` : '/api/projects/resources';
  }, [typeFilter, statusFilter]);

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <DataGrid<api.ProjectResourceResponseDto>
        endpoint={endpoint}
        columns={columns}
        gridKey="resources-list"
        searchPlaceholder={t('placeholders.searchResources')}
        exportFileName="resources"
        rowIdField="resourceId"
        rowHref={(row) => routes.resources.detail(row.resourceId)}
        pageTitle={t('resources.title')}
        refreshTrigger={gridRefreshKey}
        headerFilters={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-xs"
              aria-label="Filter by resource type"
            >
              <option value="all">{t('resources.filterAllTypes')}</option>
              <option value={RESOURCE_TYPE.PERSON}>{t('resources.typePerson')}</option>
              <option value={RESOURCE_TYPE.CONTRACTOR}>{t('resources.typeContractor')}</option>
              <option value={RESOURCE_TYPE.EQUIPMENT}>{t('resources.typeEquipment')}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-xs"
              aria-label="Filter by status"
            >
              <option value="all">{t('resources.filterAllStatuses')}</option>
              <option value={PROJECT_RESOURCE_STATE.ACTIVE}>{t('resources.filterActive')}</option>
              <option value={PROJECT_RESOURCE_STATE.ARCHIVED}>{t('resources.filterArchived')}</option>
            </select>
          </div>
        }
        headerActions={
          <Button variant="primary" onClick={handleOpenCreateModal}>
            + {t('buttons.createResource')}
          </Button>
        }
      />

      {/* Create Resource SlideOver */}
      <SlideOver
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('resources.createTitle')}
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              form="create-resource-form"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('buttons.saving') : t('buttons.createResource')}
            </Button>
          </div>
        }
      >
        <form id="create-resource-form" onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('columns.resourceType')} <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  className="input w-full text-xs"
                  value={createForm.resourceType}
                  onChange={(e) => {
                    const newType = e.target.value as ResourceType;
                    setCreateForm((p) => ({
                      ...p,
                      resourceType: newType,
                      userId: newType === RESOURCE_TYPE.PERSON ? p.userId : '',
                      vendorId: newType === RESOURCE_TYPE.CONTRACTOR ? p.vendorId : '',
                      baseUom:
                        newType === RESOURCE_TYPE.EQUIPMENT
                          ? defaultDayUom
                          : uomDictionary.some((u) => u.uomCode === p.baseUom)
                          ? p.baseUom
                          : defaultUom,
                    }));
                  }}
                >
                  <option value={RESOURCE_TYPE.PERSON}>{t('resources.typePerson')}</option>
                  <option value={RESOURCE_TYPE.CONTRACTOR}>{t('resources.typeContractor')}</option>
                  <option value={RESOURCE_TYPE.EQUIPMENT}>{t('resources.typeEquipment')}</option>
                </select>
              </div>

              {/* Dynamic Entity Linker placed next to Type */}
              {createForm.resourceType === RESOURCE_TYPE.PERSON && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('labels.userAccount')}
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={createForm.userId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const u = users.find((usr) => usr.userId === uid);
                      setCreateForm((p) => ({
                        ...p,
                        userId: uid,
                        name: p.name.trim() === '' && u ? (u.displayName || u.username) : p.name,
                      }));
                    }}
                  >
                    <option value="">{t('labels.noUserAccount')}</option>
                    {Array.isArray(users) &&
                      users.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.displayName || u.username} ({u.email || u.username})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {createForm.resourceType === RESOURCE_TYPE.CONTRACTOR && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('labels.linkedSupplier')}
                  </label>
                  <SupplierSelect
                    value={createForm.vendorId || null}
                    onChange={async (supplier: Supplier | null) => {
                      const newVendorId = supplier?.vendorId || '';
                      let updatedCost: string | undefined;
                      if (createForm.serviceProductId) {
                        const resolved = await resolveContractorUnitCost(newVendorId, createForm.serviceProductId);
                        if (resolved !== null) {
                          updatedCost = resolved;
                        }
                      }
                      setCreateForm((p) => ({
                        ...p,
                        vendorId: newVendorId,
                        name: p.name.trim() === '' && supplier ? supplier.name : p.name,
                        directUnitCost: updatedCost !== undefined ? updatedCost : p.directUnitCost,
                      }));
                    }}
                    placeholder={t('labels.unlinkedContractor')}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.resourceName')} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                className="input w-full text-xs"
                placeholder={
                  createForm.resourceType === RESOURCE_TYPE.PERSON
                    ? t('placeholders.resourcePersonPlaceholder')
                    : createForm.resourceType === RESOURCE_TYPE.CONTRACTOR
                    ? t('placeholders.resourceContractorPlaceholder')
                    : t('placeholders.resourceEquipmentPlaceholder')
                }
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Service Product / Rate Card */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.serviceRole')}
              </label>
              <ProductSelect
                productType="service"
                value={createForm.serviceProductId || null}
                onChange={async (prod: ProductOption | null) => {
                  if (prod) {
                    let resolvedCost = prod.standardCost ? String(prod.standardCost) : undefined;
                    if (createForm.resourceType === RESOURCE_TYPE.CONTRACTOR && createForm.vendorId) {
                      const resolved = await resolveContractorUnitCost(createForm.vendorId, prod.productId, prod.standardCost);
                      if (resolved !== null) {
                        resolvedCost = resolved;
                      }
                    }
                    setCreateForm((p) => ({
                      ...p,
                      serviceProductId: prod.productId,
                      name: p.name.trim() === '' ? prod.name : p.name,
                      baseUom: prod.baseUom || p.baseUom,
                      directUnitCost: resolvedCost !== undefined ? resolvedCost : p.directUnitCost,
                      unitPrice: prod.listPrice ? String(prod.listPrice) : p.unitPrice,
                    }));
                  } else {
                    setCreateForm((p) => ({
                      ...p,
                      serviceProductId: '',
                    }));
                  }
                }}
                placeholder={t('labels.customRates')}
              />
            </div>
          </div>

          {/* Divider between Info and Rates */}
          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              {t('resources.ratesHeading')}
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('columns.baseUom')} <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  className="input w-full text-xs"
                  value={createForm.baseUom}
                  onChange={(e) => setCreateForm((p) => ({ ...p, baseUom: e.target.value }))}
                >
                  {uomDictionary.length === 0 ? (
                    <option value={createForm.baseUom}>{createForm.baseUom}</option>
                  ) : (
                    <>
                      {createForm.baseUom && !uomDictionary.some((u) => u.uomCode === createForm.baseUom) && (
                        <option value={createForm.baseUom}>{createForm.baseUom}</option>
                      )}
                      {uomDictionary.map((u) => (
                        <option key={u.uomCode} value={u.uomCode}>
                          {u.uomCode} {u.description ? `(${u.description})` : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('columns.unitCost')} <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input w-full text-xs"
                  value={createForm.directUnitCost}
                  onChange={(e) => setCreateForm((p) => ({ ...p, directUnitCost: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('columns.unitPrice')} <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input w-full text-xs"
                  value={createForm.unitPrice}
                  onChange={(e) => setCreateForm((p) => ({ ...p, unitPrice: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
