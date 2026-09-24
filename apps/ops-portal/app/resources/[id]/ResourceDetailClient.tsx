'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import StateBadge from '@/components/StateBadge';
import { Button } from '@/components/shared/Button';
import SupplierSelect, { Supplier } from '@/components/shared/SupplierSelect';
import ProductSelect, { Product as ProductOption } from '@/components/shared/ProductSelect';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { formatLocalDate } from '@/lib/date';
import { resolveContractorUnitCost } from '@/lib/resource-utils';
import { useAuth } from '@/components/shared/AuthGate';
import { RESOURCE_TYPE, PROJECT_RESOURCE_STATE, SystemResource, hasPermission } from '@herobm/shared';
import { useResource } from './useResource';

interface ResourceDetailClientProps {
  resourceId: string;
}

export default function ResourceDetailClient({ resourceId }: ResourceDetailClientProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tProducts = useTranslations('products');
  const tSales = useTranslations('salesOrders');
  const router = useRouter();
  const { permissions } = useAuth();

  const canWrite = hasPermission(permissions, SystemResource.PROJECTS, 'write');
  const canArchive = hasPermission(permissions, SystemResource.PROJECTS, 'archive');

  const {
    resource,
    dto,
    loading,
    saving,
    updateField,
    saveField,
    users,
    uomDictionary,
    archiveResource,
    unarchiveResource,
    deleteResource,
  } = useResource(resourceId);

  useDocumentTitle(
    resource ? (resource.name ? `${resource.resourceNumber} - ${resource.name}` : resource.resourceNumber) : null
  );

  const isEditable = Boolean(resource?.isActive && canWrite);

  const renderTypeLabel = (type?: string) => {
    switch (type) {
      case RESOURCE_TYPE.PERSON:
        return t('resources.typePerson');
      case RESOURCE_TYPE.CONTRACTOR:
        return t('resources.typeContractor');
      case RESOURCE_TYPE.EQUIPMENT:
        return t('resources.typeEquipment');
      default:
        return type || '—';
    }
  };

  const visibleSections = [
    {
      id: 'tab-details',
      label: tCommon('tabs.overview'),
      isSubPage: true,
      isActive: true,
      onClick: () => {},
      subtargets: [
        {
          id: 'info-section',
          label: 'Info',
          onClick: () => {
            document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
        {
          id: 'pricing-section',
          label: tProducts('pricing'),
          onClick: () => {
            document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
        {
          id: 'entity-section',
          label: 'Linked Entity',
          onClick: () => {
            document.getElementById('entity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
        {
          id: 'activity-section',
          label: 'Activity',
          onClick: () => {
            document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
      ],
    },
  ];

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!resource) return [];
    return [
      {
        eventId: 'created',
        eventType: 'created',
        payload: { resourceNumber: resource.resourceNumber, resourceType: resource.resourceType },
        actor: 'System',
        createdOn: resource.createdOn ? new Date(resource.createdOn).toISOString() : new Date().toISOString(),
        entityDisplayName: resource.name || resource.resourceNumber,
      },
      ...(resource.modifiedOn && resource.modifiedOn !== resource.createdOn
        ? [
            {
              eventId: 'modified',
              eventType: 'updated',
              payload: {},
              actor: 'System',
              createdOn: new Date(resource.modifiedOn).toISOString(),
              entityDisplayName: resource.name || resource.resourceNumber,
            },
          ]
        : []),
    ];
  }, [resource]);

  if (loading && !resource) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!resource || !dto) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <p className="text-sm text-[var(--text-muted)]">{tCommon('noMatchingResults')}</p>
        <Button variant="secondary" onClick={() => router.push('/resources')}>
          {t('backToResources')}
        </Button>
      </div>
    );
  }

  return (
    <DetailsLayout
      maxWidth="full"
      header={
        <EntityHeader
          title={resource.resourceNumber}
          subtitle={resource.name}
          isSaving={saving}
          badges={
            <div className="flex items-center gap-2">
              <span className="badge badge-secondary text-xs uppercase font-medium">
                {renderTypeLabel(resource.resourceType)}
              </span>
              {!resource.isActive && (
                <StateBadge state={PROJECT_RESOURCE_STATE.ARCHIVED} />
              )}
            </div>
          }
          nav={<PageNav sections={visibleSections} />}
        />
      }
      footerActions={
        <div className="flex items-center gap-2">
          {canArchive && (
            !resource.isActive ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={unarchiveResource}
                disabled={saving}
              >
                {t('buttons.unarchiveResource')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                onClick={archiveResource}
                disabled={saving}
              >
                {t('buttons.archiveResource')}
              </Button>
            )
          )}
          {canWrite && (
            <Button
              variant="danger"
              size="sm"
              onClick={deleteResource}
              disabled={saving}
              title={t('buttons.deleteResource')}
            >
              {t('buttons.deleteResource')}
            </Button>
          )}
        </div>
      }
    >
      {!resource.isActive && (
        <div className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700">
          <div>
            <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* General Information Card */}
        <div id="info-section" className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">badge</span>
            {t('sections.generalInfo')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.resourceCode')} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                className="input"
                required
                disabled={!isEditable}
                value={dto.resourceNumber ?? resource.resourceNumber ?? ''}
                onChange={(e) => updateField('resourceNumber', e.target.value)}
                onBlur={(e) => saveField('resourceNumber', e.target.value)}
                placeholder={tCommon('placeholders.number')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.resourceName')} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                className="input w-full"
                required
                disabled={!isEditable}
                value={dto.name ?? ''}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={(e) => saveField('name', e.target.value)}
                placeholder={t('placeholders.resourceNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.resourceType')} <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                className="input w-full"
                disabled={!isEditable}
                value={dto.resourceType ?? resource.resourceType}
                onChange={(e) => {
                  const newType = e.target.value;
                  updateField('resourceType', newType);
                  saveField('resourceType', newType);
                  if (newType !== RESOURCE_TYPE.PERSON && dto.userId) {
                    updateField('userId', null);
                    saveField('userId', null);
                  }
                  if (newType !== RESOURCE_TYPE.CONTRACTOR && dto.vendorId) {
                    updateField('vendorId', null);
                    saveField('vendorId', null);
                  }
                }}
              >
                <option value={RESOURCE_TYPE.PERSON}>{t('resources.typePerson')}</option>
                <option value={RESOURCE_TYPE.CONTRACTOR}>{t('resources.typeContractor')}</option>
                <option value={RESOURCE_TYPE.EQUIPMENT}>{t('resources.typeEquipment')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.status')}
              </label>
              <select
                className="input"
                disabled={!isEditable}
                value={dto.isActive ? PROJECT_RESOURCE_STATE.ACTIVE : PROJECT_RESOURCE_STATE.ARCHIVED}
                onChange={(e) => {
                  const active = e.target.value === PROJECT_RESOURCE_STATE.ACTIVE;
                  updateField('isActive', active);
                  saveField('isActive', active);
                }}
              >
                <option value={PROJECT_RESOURCE_STATE.ACTIVE}>{t('resources.filterActive')}</option>
                <option value={PROJECT_RESOURCE_STATE.ARCHIVED}>{t('resources.filterArchived')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('columns.createdOn')}
              </label>
              <input
                className="input"
                disabled
                value={resource.createdOn ? formatLocalDate(resource.createdOn) : '—'}
              />
            </div>
          </div>
        </div>

        {/* Pricing Card */}
        <div id="pricing-section" className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">payments</span>
            {tProducts('pricing')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('columns.baseUom')} <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                className="input"
                disabled={!isEditable}
                value={dto.baseUom ?? resource.baseUom ?? 'HOUR'}
                onChange={(e) => {
                  updateField('baseUom', e.target.value);
                  saveField('baseUom', e.target.value);
                }}
              >
                {uomDictionary.length === 0 ? (
                  <option value={dto.baseUom || resource.baseUom}>{dto.baseUom || resource.baseUom}</option>
                ) : (
                  <>
                    {dto.baseUom && !uomDictionary.some((u) => u.uomCode === dto.baseUom) && (
                      <option value={dto.baseUom}>{dto.baseUom}</option>
                    )}
                    {uomDictionary.map((u) => (
                      <option key={u.uomCode} value={u.uomCode}>
                        {u.uomCode}{u.description ? ` — ${u.description}` : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('resources.directCostRate')} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                disabled={!isEditable}
                value={dto.directUnitCost !== undefined ? String(dto.directUnitCost) : ''}
                onChange={(e) => updateField('directUnitCost', e.target.value)}
                onBlur={(e) => saveField('directUnitCost', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('resources.billingRate')} <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                disabled={!isEditable}
                value={dto.unitPrice !== undefined ? String(dto.unitPrice) : ''}
                onChange={(e) => updateField('unitPrice', e.target.value)}
                onBlur={(e) => saveField('unitPrice', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Linked Entity Card */}
        <div id="entity-section" className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">account_tree</span>
            {t('resources.linkedEntityHeading')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Account Linker (when Person) */}
            {(dto.resourceType ?? resource.resourceType) === RESOURCE_TYPE.PERSON && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('labels.userAccount')}
                </label>
                <select
                  className="input w-full"
                  disabled={!isEditable}
                  value={dto.userId ?? resource.userId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    updateField('userId', val);
                    saveField('userId', val);
                  }}
                >
                  <option value="">{t('labels.noUserAccount')}</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.displayName || u.username} ({u.email || u.username})
                    </option>
                  ))}
                </select>
                {resource.user && (
                  <div className="mt-2 text-xs text-[var(--text-secondary)] space-y-0.5">
                    <p className="font-medium text-[var(--text-primary)]">
                      {resource.user.displayName || resource.user.username}
                    </p>
                    <p className="text-[var(--text-muted)]">
                      {resource.user.email} &bull; @{resource.user.username}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Contractor Supplier Linker (when Contractor) */}
            {(dto.resourceType ?? resource.resourceType) === RESOURCE_TYPE.CONTRACTOR && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('labels.linkedSupplier')}
                </label>
                <SupplierSelect
                  value={dto.vendorId ?? resource.vendorId ?? null}
                  onChange={async (s: Supplier | null) => {
                    const val = s?.vendorId || null;
                    updateField('vendorId', val);
                    saveField('vendorId', val);
                    const activeServiceProductId = dto.serviceProductId ?? resource.serviceProductId;
                    if (activeServiceProductId) {
                      const resolved = await resolveContractorUnitCost(val, activeServiceProductId);
                      if (resolved !== null) {
                        updateField('directUnitCost', resolved);
                        saveField('directUnitCost', resolved);
                      }
                    }
                  }}
                  disabled={!isEditable}
                  placeholder={t('labels.unlinkedContractor')}
                  initialSearchTerm={
                    resource.vendor
                      ? `${resource.vendor.supplierNumber} — ${resource.vendor.supplierName}`
                      : undefined
                  }
                />
              </div>
            )}

            {/* Service Role / Rate Card Selector */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.serviceRole')}
              </label>
              <ProductSelect
                productType="service"
                value={dto.serviceProductId ?? resource.serviceProductId ?? null}
                onChange={async (prod: ProductOption | null) => {
                  const val = prod?.productId || null;
                  updateField('serviceProductId', val);
                  saveField('serviceProductId', val);
                  if (prod) {
                    if (prod.baseUom) {
                      updateField('baseUom', prod.baseUom);
                      saveField('baseUom', prod.baseUom);
                    }
                    const currentType = dto.resourceType ?? resource.resourceType;
                    const activeVendorId = dto.vendorId ?? resource.vendorId;
                    let resolvedCost: string | undefined = prod.standardCost ? String(prod.standardCost) : undefined;
                    if (currentType === RESOURCE_TYPE.CONTRACTOR && activeVendorId) {
                      const resolved = await resolveContractorUnitCost(activeVendorId, val, prod.standardCost);
                      if (resolved !== null) {
                        resolvedCost = resolved;
                      }
                    }
                    if (resolvedCost !== undefined) {
                      updateField('directUnitCost', resolvedCost);
                      saveField('directUnitCost', resolvedCost);
                    }
                    if (prod.listPrice) {
                      updateField('unitPrice', String(prod.listPrice));
                      saveField('unitPrice', String(prod.listPrice));
                    }
                  }
                }}
                disabled={!isEditable}
                placeholder={t('labels.customRates')}
                initialSearchTerm={
                  resource.serviceProduct
                    ? `${resource.serviceProduct.productNumber} — ${resource.serviceProduct.name}`
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={timelineEvents} />
        </div>
      </div>
    </DetailsLayout>
  );
}
