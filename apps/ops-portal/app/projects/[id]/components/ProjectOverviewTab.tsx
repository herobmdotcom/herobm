'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import CustomerSelect, { Customer } from '@/components/shared/CustomerSelect';
import OpportunitySelect, { OpportunityOption } from '@/components/shared/OpportunitySelect';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import NotesSection from '@/components/shared/NotesSection';
import { Button } from '@/components/shared/Button';
import { DynamicForm } from '@/components/DynamicForm';
import { reportError } from '@/lib/api';
import { CURRENCIES, formatAmount } from '@/lib/currency';
import { toInputDateFormat, formatLocalDate } from '@/lib/date';
import {
  PROJECT_BILLING_TYPE,
  ProjectBillingType,
} from '@herobm/shared';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from '@/components/shared/InheritedSelect';
import { useInheritance } from '@/hooks/useInheritance';

interface ProjectOverviewTabProps {
  project: api.ProjectResponseDto;
  dto: Partial<api.UpdateProjectDto>;
  isEditable: boolean;
  saving: boolean;
  profitability: api.ProjectProfitabilityResponseDto | null;
  users: api.UserResponseDto[];
  tradingTerms?: api.TradingTermResponseDto[];
  updateField: (field: keyof api.UpdateProjectDto, value: unknown) => void;
  saveField: (field: keyof api.UpdateProjectDto, value: unknown) => Promise<void>;
  reloadProject?: () => Promise<unknown>;
}

export function ProjectOverviewTab({
  project,
  dto,
  isEditable,
  saving,
  profitability,
  users,
  tradingTerms = [],
  updateField,
  saveField,
  reloadProject,
}: ProjectOverviewTabProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const { app: appSettings } = useSettings();
  const projectStages = (appSettings?.projectStages || []) as Array<{ value: string; order?: number }>;
  const sortedStages = [...projectStages].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const tradingTermsInheritance = useInheritance([
    {
      value: project.customer?.tradingTermsId,
      sourceLabel: project.customer?.name ? `Customer (${project.customer.name})` : 'Customer',
    },
    {
      value: appSettings?.defaultCustomerTermsId,
      sourceLabel: 'System Default',
    },
  ]);

  const [localNotes, setLocalNotes] = useState<api.ProjectNoteResponseDto[]>(
    project.projectNotes || [],
  );
  const [projectMetadataSchema, setProjectMetadataSchema] = useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    api.projectsControllerGetSettings()
      .then((res) => {
        if (res.data?.projectMetadataSchema) {
          setProjectMetadataSchema(res.data.projectMetadataSchema as Record<string, unknown>);
        }
      })
      .catch((err) => {
        reportError(err, 'ProjectOverviewTab:fetchSettings');
      });
  }, []);

  React.useEffect(() => {
    if (project.projectNotes) {
      setLocalNotes(project.projectNotes);
    }
  }, [project.projectNotes]);

  const marginVal = profitability?.actualMarginPercent !== undefined ? Number(profitability.actualMarginPercent) : 0;
  const isPositiveMargin = marginVal >= 0;

  const currentCurrency = dto.currencyCode || project.currencyCode || 'USD';

  const handleAddNote = async (content: string) => {
    try {
      const res = await api.projectsControllerAddNote(project.projectId, {
        content: content.trim(),
      });
      toast.success('Note added');
      if (res.data) {
        setLocalNotes((prev) => [res.data, ...prev]);
      }
      if (reloadProject) {
        await reloadProject();
      }
    } catch {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.projectsControllerDeleteNote(project.projectId, noteId);
      toast.success('Note deleted');
      setLocalNotes((prev) => prev.filter((n) => n.noteId !== noteId));
      if (reloadProject) {
        await reloadProject();
      }
    } catch {
      toast.error('Failed to delete note');
    }
  };

  // Build timeline events from project audit data
  const timelineEvents: TimelineEvent[] = [
    {
      eventId: 'created',
      eventType: 'created',
      payload: { stateCode: project.stateCode },
      actor: project.createdBy || 'System',
      createdOn: project.createdOn ? new Date(project.createdOn).toISOString() : new Date().toISOString(),
      entityDisplayName: project.name,
    },
    ...(project.modifiedOn && project.modifiedOn !== project.createdOn
      ? [
          {
            eventId: 'modified',
            eventType: 'updated',
            payload: {},
            actor: 'System',
            createdOn: new Date(project.modifiedOn).toISOString(),
            entityDisplayName: project.name,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Card */}
      <div id="overview-section" className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">info</span>
          {t('sections.overview')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.name')} *
            </label>
            <input
              type="text"
              className="input w-full font-semibold"
              value={dto.name ?? project.name ?? ''}
              onChange={(e) => updateField('name', e.target.value)}
              onBlur={(e) => saveField('name', e.target.value)}
              disabled={!isEditable}
              placeholder={t('placeholders.projectName')}
            />
          </div>

          {/* Project Code */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.projectCode')}
            </label>
            <input
              type="text"
              className="input w-full font-mono text-[var(--accent)]"
              value={dto.projectNumber ?? project.projectNumber ?? ''}
              onChange={(e) => updateField('projectNumber', e.target.value)}
              onBlur={(e) => saveField('projectNumber', e.target.value)}
              disabled={!isEditable}
              placeholder={t('placeholders.projectCode')}
            />
          </div>

          {/* Delivery Stage */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.stage')}
            </label>
            <select
              className="input w-full"
              value={dto.stage ?? project.stage ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateField('stage', val);
                saveField('stage', val);
              }}
              disabled={!isEditable}
            >
              {sortedStages.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value}
                </option>
              ))}
              {(dto.stage || project.stage) && !sortedStages.some((s) => s.value === (dto.stage || project.stage)) && (
                <option value={dto.stage ?? project.stage ?? ''}>
                  {dto.stage || project.stage}
                </option>
              )}
            </select>
          </div>

          {/* Customer Selector */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.customer')} *
            </label>
            <CustomerSelect
              value={dto.customerId || project.customerId || null}
              initialSearchTerm={
                project.customer
                  ? (project.customer.customerName || project.customer.name)
                    ? `${project.customer.customerNumber ? `${project.customer.customerNumber} — ` : ''}${project.customer.customerName || project.customer.name}`
                    : project.customer.customerNumber || ''
                  : ''
              }
              onChange={(cust: Customer | null) => {
                const newId = cust?.customerId || null;
                updateField('customerId', newId);
                saveField('customerId', newId);
                if (cust?.currencyCode && cust.currencyCode !== currentCurrency) {
                  updateField('currencyCode', cust.currencyCode);
                  saveField('currencyCode', cust.currencyCode);
                }
              }}
              disabled={!isEditable}
              placeholder={t('placeholders.searchCustomers')}
            />
          </div>

          {/* CRM Opportunity */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.opportunity')}
            </label>
            <OpportunitySelect
              value={dto.opportunityId || project.opportunityId || null}
              initialSearchTerm={project.opportunity?.name || ''}
              onChange={(opp: OpportunityOption | null) => {
                const oppId = opp?.opportunityId || null;
                updateField('opportunityId', oppId);
                saveField('opportunityId', oppId);
              }}
              disabled={!isEditable}
              placeholder={t('placeholders.opportunity')}
            />
          </div>

          {/* Project Manager */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.projectManager')}
            </label>
            <select
              className="input w-full"
              value={dto.projectManagerId ?? project.projectManagerId ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                updateField('projectManagerId', val);
                saveField('projectManagerId', val);
              }}
              disabled={!isEditable}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName || u.username}{u.email ? ` (${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.description')}
            </label>
            <textarea
              className="input w-full min-h-[90px] pt-2 resize-y text-xs"
              placeholder={t('placeholders.description')}
              value={dto.description ?? project.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              onBlur={(e) => saveField('description', e.target.value)}
              disabled={!isEditable}
            />
          </div>
        </div>
      </div>

      {/* Billing Card */}
      <div id="billing-section" className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">payments</span>
          {t('sections.billing')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Billing Type */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.billingType')} *
            </label>
            <select
              className="input w-full"
              value={dto.billingType || (project.billingType as api.UpdateProjectDtoBillingType) || PROJECT_BILLING_TYPE.TIME_AND_MATERIALS}
              onChange={(e) => {
                const val = e.target.value as ProjectBillingType;
                updateField('billingType', val);
                saveField('billingType', val);
              }}
              disabled={!isEditable}
            >
              <option value={PROJECT_BILLING_TYPE.TIME_AND_MATERIALS}>Time & Materials</option>
              <option value={PROJECT_BILLING_TYPE.FIXED_PRICE}>Fixed Price</option>
              <option value={PROJECT_BILLING_TYPE.MILESTONE}>Milestone Based</option>
              <option value={PROJECT_BILLING_TYPE.COST_PLUS}>Cost Plus</option>
            </select>
          </div>

          {/* Discount Percentage */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Headline Discount %
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="input w-full pr-8"
                placeholder="0"
                value={dto.discountPercentage ?? project.discountPercentage ?? ''}
                onChange={(e) => updateField('discountPercentage', e.target.value)}
                onBlur={(e) => saveField('discountPercentage', e.target.value)}
                disabled={!isEditable}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                %
              </span>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.currency')} *
            </label>
            <select
              className="input w-full"
              value={dto.currencyCode || project.currencyCode || 'USD'}
              onChange={(e) => {
                updateField('currencyCode', e.target.value);
                saveField('currencyCode', e.target.value);
              }}
              disabled={!isEditable}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Payment Terms */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.paymentTerms')}
            </label>
            <InheritedSelect
              className="input w-full"
              disabled={!isEditable}
              value={dto.tradingTermsId || project.tradingTermsId || ''}
              onChange={(val) => {
                updateField('tradingTermsId', val);
                saveField('tradingTermsId', val);
              }}
              options={tradingTerms.map((term) => ({
                value: term.tradingTermsId,
                label: `${term.code} - ${term.description}`,
              }))}
              inheritedValue={tradingTermsInheritance.inheritedValue}
              inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
            />
          </div>
        </div>
      </div>

      {/* Schedule Card */}
      <div id="schedule-section" className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">calendar_month</span>
          {t('sections.schedule')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.startDate')}
            </label>
            <input
              type="date"
              className="input w-full"
              value={toInputDateFormat(dto.startDate ?? (project.startDate ? new Date(project.startDate) : ''))}
              onChange={(e) => {
                const val = e.target.value || null;
                updateField('startDate', val);
                saveField('startDate', val);
              }}
              disabled={!isEditable}
            />
          </div>

          {/* Target End Date */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.endDate')}
            </label>
            <input
              type="date"
              className="input w-full"
              value={toInputDateFormat(dto.targetEndDate ?? (project.targetEndDate ? new Date(project.targetEndDate) : ''))}
              onChange={(e) => {
                const val = e.target.value || null;
                updateField('targetEndDate', val);
                saveField('targetEndDate', val);
              }}
              disabled={!isEditable}
            />
          </div>

          {/* Actual End Date (Read Only) */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Actual Completed Date
            </label>
            <input
              type="text"
              className="input w-full"
              value={project.actualEndDate ? formatLocalDate(project.actualEndDate) : '—'}
              disabled
            />
          </div>
        </div>
      </div>

      {/* Custom Fields Card */}
      {!!(projectMetadataSchema?.properties && typeof projectMetadataSchema.properties === 'object' && Object.keys(projectMetadataSchema.properties).length > 0) && (
        <div id="custom-fields-section" className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">tune</span>
            {t('sections.customFields')}
          </h3>
          <DynamicForm
            schema={projectMetadataSchema}
            data={(dto.metadata || project.metadata || {}) as Record<string, unknown>}
            onChange={(newMetadata) => {
              updateField('metadata', newMetadata);
            }}
            onBlur={(newMetadata) => {
              saveField('metadata', newMetadata);
            }}
            readOnly={!isEditable}
          />
        </div>
      )}

      {/* Notes Section */}
      <NotesSection
        id="notes-section"
        title={t('sections.notes')}
        placeholder={t('placeholders.addNote')}
        addButtonLabel={t('buttons.addNote')}
        savingLabel={t('buttons.saving')}
        notes={localNotes}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        isEditable={isEditable}
      />

      {/* KPIs Card */}
      <div id="kpi-section" className="card">
        <h3 className="section-heading">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined">analytics</span>
          {t('sections.kpis')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Total Budget Cost</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(Number(profitability?.totalBudgetCost || 0), currentCurrency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Total Actual Cost</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(Number(profitability?.totalActualCost || 0), currentCurrency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Budget Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(Number(profitability?.totalBudgetPrice || 0), currentCurrency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Billable Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(Number(profitability?.totalBillablePrice || 0), currentCurrency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Billed Revenue</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {formatAmount(Number(profitability?.totalBilledPrice || 0), currentCurrency)}
            </span>
          </div>
          <div className="p-3 border border-[var(--border)] rounded-lg">
            <span className="text-xs text-[var(--text-muted)] block mb-1">Actual Margin %</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {marginVal.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Activity Timeline Card */}
      <div id="activity-section" className="card">
        <ActivityTimeline events={timelineEvents} />
      </div>
    </div>
  );
}
