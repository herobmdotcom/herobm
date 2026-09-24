'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import Tabs from '@/components/shared/Tabs';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { RESOURCE_TYPE, ResourceType } from '@herobm/shared';
import { routes } from '@/lib/routes';
import type { ProjectResource } from '../useProject';

export interface AssignProjectResourceSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  assignedResourceIds?: string[];
  resources?: ProjectResource[];
  currency?: string;
  onAssign: (dto: api.AssignProjectResourceDto) => Promise<void>;
  onSuccess: () => Promise<void>;
}

export function AssignProjectResourceSlideOver({
  isOpen,
  onClose,
  projectId: _projectId,
  assignedResourceIds = [],
  resources = [],
  currency = 'USD',
  onAssign,
  onSuccess,
}: AssignProjectResourceSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [poolResources, setPoolResources] = useState<ProjectResource[]>(resources);
  const [loading, setLoading] = useState(false);

  // Load pool resources from backend or fallback to provided resources
  const loadPoolResources = useCallback(async () => {
    try {
      const res = await api.projectsControllerFindAllResources();
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setPoolResources(res.data);
      }
    } catch {
      // fallback to provided resources
      setPoolResources(resources);
    }
  }, [resources]);

  // Reset / Initialize on open
  useEffect(() => {
    if (!isOpen) return;

    if (resources && resources.length > 0) {
      setPoolResources(resources);
    }
    loadPoolResources();

    setSelectedResource(null);
    setSelectedTypeFilter('all');
    setSearchQuery('');
    setNotes('');
    setLoading(false);
  }, [isOpen, loadPoolResources, resources]);

  // Filter available resources by Type and Search Query
  const filteredPoolResources = useMemo(() => {
    let list = poolResources;
    if (selectedTypeFilter !== 'all') {
      list = list.filter((r) => r.resourceType === selectedTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.resourceCode && r.resourceCode.toLowerCase().includes(q))
      );
    }
    return list;
  }, [poolResources, selectedTypeFilter, searchQuery]);

  const { unassignedResources, alreadyAssignedResources } = useMemo(() => {
    const unassigned: ProjectResource[] = [];
    const assigned: ProjectResource[] = [];

    for (const res of filteredPoolResources) {
      if (assignedResourceIds.includes(res.resourceId)) {
        assigned.push(res);
      } else {
        unassigned.push(res);
      }
    }

    return { unassignedResources: unassigned, alreadyAssignedResources: assigned };
  }, [filteredPoolResources, assignedResourceIds]);

  const handleSelectResource = (res: ProjectResource) => {
    if (assignedResourceIds.includes(res.resourceId)) {
      return;
    }
    setSelectedResource(res);
  };

  const formatResourceType = (type?: string) => {
    switch (type) {
      case RESOURCE_TYPE.PERSON:
        return t('resources.typePerson');
      case RESOURCE_TYPE.CONTRACTOR:
        return t('resources.typeContractor');
      case RESOURCE_TYPE.EQUIPMENT:
        return t('resources.typeEquipment');
      default:
        return type || t('resources.typePerson');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedResource) {
      toast.error(t('resources.selectResourcePrompt'));
      return;
    }
    if (assignedResourceIds.includes(selectedResource.resourceId)) {
      toast.error('Resource is already assigned to this project');
      return;
    }

    setLoading(true);
    try {
      await onAssign({
        resourceId: selectedResource.resourceId,
        notes: notes.trim() || undefined,
      });
      await onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('resources.assignSlideOverTitle')}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={loading || !selectedResource}
            onClick={handleSubmit}
          >
            {loading ? t('buttons.saving') : t('buttons.assignToProject')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resource Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              {t('resources.selectResourcePrompt')} <span className="text-[var(--danger)]">*</span>
            </label>
          </div>

          <Tabs
            tabs={[
              { id: 'all', label: t('resources.filterAllTypes') },
              { id: RESOURCE_TYPE.PERSON, label: t('resources.typePerson') },
              { id: RESOURCE_TYPE.CONTRACTOR, label: t('resources.typeContractor') },
              { id: RESOURCE_TYPE.EQUIPMENT, label: t('resources.typeEquipment') },
            ]}
            activeTab={selectedTypeFilter}
            onChange={(tabId) => setSelectedTypeFilter(tabId as 'all' | ResourceType)}
            size="sm"
            actions={
              <a
                href={routes.resources.new()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>{t('resources.createOnTheFly')}</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </a>
            }
          />

          {/* Search Box */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none">
              search
            </span>
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors"
              placeholder={t('placeholders.searchResources')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Resources Card List */}
          <div className="max-h-80 overflow-y-auto space-y-4 border border-[var(--border)] p-3 rounded-lg">
            {filteredPoolResources.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">
                {t('resources.noMatchingResources')}
              </div>
            ) : (
              <>
                {/* Available to Assign Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
                      {t('resources.availableToAssign')} ({unassignedResources.length})
                    </span>
                  </div>
                  {unassignedResources.length === 0 ? (
                    <div className="text-center py-4 text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
                      {t('resources.noAvailableResources')}
                    </div>
                  ) : (
                    unassignedResources.map((res) => {
                      const isSelected = selectedResource?.resourceId === res.resourceId;

                      return (
                        <LinkedEntityCard
                          key={res.resourceId}
                          icon={
                            res.resourceType === RESOURCE_TYPE.PERSON
                              ? 'person'
                              : res.resourceType === RESOURCE_TYPE.CONTRACTOR
                              ? 'engineering'
                              : 'precision_manufacturing'
                          }
                          title={res.name}
                          subtitle={[
                            res.resourceCode || null,
                            res.serviceProduct?.name || null,
                            res.baseUom ? `${res.baseUom}` : null,
                          ]}
                          amount={
                            <span className="text-xs font-normal text-[var(--text-primary)]">
                              Bill: {formatAmount(Number(res.unitPrice || 0), currency)}
                            </span>
                          }
                          amountSubtext={
                            <span className="text-[11px] text-[var(--text-muted)]">
                              Cost: {formatAmount(Number(res.directUnitCost || 0), currency)}
                            </span>
                          }
                          status={
                            <span className="badge badge-secondary text-[10px] uppercase font-medium">
                              {formatResourceType(res.resourceType)}
                            </span>
                          }
                          onClick={() => handleSelectResource(res)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? '!border-[var(--accent)] !bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]'
                              : ''
                          }`}
                        />
                      );
                    })
                  )}
                </div>

                {/* Already Assigned to Project Section */}
                {alreadyAssignedResources.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
                        {t('resources.alreadyAssignedSection')} ({alreadyAssignedResources.length})
                      </span>
                    </div>
                    {alreadyAssignedResources.map((res) => (
                      <LinkedEntityCard
                        key={res.resourceId}
                        icon={
                          res.resourceType === RESOURCE_TYPE.PERSON
                            ? 'person'
                            : res.resourceType === RESOURCE_TYPE.CONTRACTOR
                            ? 'engineering'
                            : 'precision_manufacturing'
                        }
                        title={res.name}
                        subtitle={[
                          res.resourceCode || null,
                          res.serviceProduct?.name || null,
                          res.baseUom ? `${res.baseUom}` : null,
                        ]}
                        amount={
                          <span className="text-xs font-normal text-[var(--text-muted)]">
                            Bill: {formatAmount(Number(res.unitPrice || 0), currency)}
                          </span>
                        }
                        amountSubtext={
                          <span className="text-[11px] text-[var(--text-muted)]">
                            Cost: {formatAmount(Number(res.directUnitCost || 0), currency)}
                          </span>
                        }
                        status={
                          <span className="badge badge-warning text-[10px] uppercase font-medium">
                            {t('labels.alreadyAssigned')}
                          </span>
                        }
                        className="opacity-60 cursor-not-allowed bg-[var(--bg-card)] border-dashed"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Selected Resource Notes / Role */}
        {selectedResource && (
          <div className="space-y-3 pt-3 border-t border-[var(--border)]">
            <h4 className="text-xs font-medium text-[var(--text-muted)]">
              {selectedResource.name} ({formatResourceType(selectedResource.resourceType)})
            </h4>

            <div>
              <label htmlFor="assign-resource-notes" className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('columns.notes')}
              </label>
              <textarea
                id="assign-resource-notes"
                rows={2}
                className="input w-full text-xs py-2"
                placeholder="e.g. Lead electrical commissioning engineer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </form>
    </SlideOver>
  );
}
