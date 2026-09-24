'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import AsyncSelect from './AsyncSelect';
import { RESOURCE_TYPE, ResourceType, getErrorMessage } from '@herobm/shared';
import { formatAmount } from '@/lib/currency';
import type { ProjectResource } from '@/app/projects/[id]/useProject';

export interface ResourceSearchInputProps {
  onSelect: (resource: ProjectResource) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  resourceType?: ResourceType;
  disabled?: boolean;
  excludeResourceIds?: string[];
  resources?: ProjectResource[];
  currency?: string;
}

export default function ResourceSearchInput({
  onSelect,
  placeholder,
  className,
  style,
  resourceType,
  disabled,
  excludeResourceIds = [],
  resources,
  currency = 'USD',
}: ResourceSearchInputProps) {
  const t = useTranslations('projects');

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

  const excludeSet = new Set(excludeResourceIds);

  return (
    <AsyncSelect<ProjectResource>
      placeholder={placeholder || t('placeholders.searchResources')}
      disabled={disabled}
      className={className}
      style={style}
      clearOnSelect
      onSearch={async (term) => {
        const q = term.toLowerCase().trim();
        let list: ProjectResource[] = [];
        if (resources && resources.length > 0) {
          list = resources.filter((r) => {
            if (r.isActive === false) return false;
            if (excludeSet.has(r.resourceId)) return false;
            if (resourceType && r.resourceType !== resourceType) return false;
            return (
              r.name.toLowerCase().includes(q) ||
              (r.resourceCode && r.resourceCode.toLowerCase().includes(q)) ||
              (r.resourceNumber && r.resourceNumber.toLowerCase().includes(q))
            );
          });
        } else {
          try {
            const res = await api.projectsControllerFindAllResources({
              q: term,
              resourceType: resourceType as api.ProjectsControllerFindAllResourcesResourceType,
            });
            const fetched = (Array.isArray(res?.data) ? res.data : []) as unknown as ProjectResource[];
            list = fetched.filter((r) => !excludeSet.has(r.resourceId) && r.isActive !== false);
          } catch (err) {
            reportError(err, 'ResourceSearchInput:onSearch');
            toast.error(getErrorMessage(err));
            list = [];
          }
        }
        return list;
      }}
      onChange={(res) => {
        if (res) {
          onSelect(res);
        }
      }}
      getKey={(r) => r.resourceId}
      renderOption={(r) => (
        <div className="flex items-center justify-between gap-2 py-1">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[var(--accent)] font-semibold text-xs shrink-0">
              {r.resourceCode || r.resourceNumber}
            </span>
            <span className="text-[var(--text-primary)] text-xs font-medium truncate">
              {r.name}
            </span>
            <span className="badge badge-secondary text-[10px] uppercase font-medium shrink-0">
              {formatResourceType(r.resourceType)}
            </span>
          </div>
          <div className="text-right text-[11px] text-[var(--text-muted)] font-mono shrink-0">
            Bill: {formatAmount(Number(r.unitPrice || 0), currency)}
          </div>
        </div>
      )}
      noResultsText={t('resources.noMatchingResources')}
      typeMinCharsText={t('placeholders.searchResources')}
    />
  );
}
