'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import { RESOURCE_TYPE } from '@herobm/shared';
import type { ProjectResource } from '../useProject';
import { ConsumeProjectResourceSlideOver } from './ConsumeProjectResourceSlideOver';
import { AssignProjectResourceSlideOver } from './AssignProjectResourceSlideOver';
import { EditResourceUsageSlideOver } from './EditResourceUsageSlideOver';

export interface ResourceSummaryRow {
  resourceId: string;
  name: string;
  resourceCode?: string;
  resourceType: string;
  serviceName?: string;
  baseUom?: string;
  notes?: string | null;
  tasksWorked: string[];
  consumedHours: number;
  lastPostingDate: string | null;
  entryCount: number;
  isAssigned?: boolean;
}

interface ProjectResourcesTabProps {
  projectId?: string;
  projectNumber?: string;
  tasks?: api.ProjectTaskResponseDto[];
  resources: ProjectResource[];
  assignedResources?: api.ProjectResourceAssignmentResponseDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries?: api.ProjectLedgerEntryResponseDto[];
  currency?: string;
  isEditable?: boolean;
  discountPercentage?: number;
  createResource?: (dto: api.CreateProjectResourceDto) => Promise<void>;
  assignResourceToProject?: (dto: api.AssignProjectResourceDto) => Promise<void>;
  removeResourceFromProject?: (resourceId: string) => Promise<void>;
  consumeResource?: (dto: api.ConsumeResourceDto) => Promise<void>;
  createBudgetLine?: (dto: api.CreateProjectBudgetLineDto) => Promise<void>;
  updateBudgetLine?: (lineId: string, dto: api.UpdateProjectBudgetLineDto) => Promise<void>;
  deleteBudgetLine?: (lineId: string) => Promise<void>;
  updateLedgerEntry?: (ledgerId: string, dto: api.UpdateProjectLedgerEntryDto) => Promise<void>;
  deleteLedgerEntry?: (ledgerId: string) => Promise<void>;
  reloadProject?: () => Promise<unknown>;
}

export function ProjectResourcesTab({
  projectId = '',
  projectNumber,
  tasks = [],
  resources = [],
  assignedResources = [],
  budgetLines = [],
  ledgerEntries = [],
  currency: _currency = 'USD',
  isEditable = false,
  discountPercentage,
  assignResourceToProject,
  removeResourceFromProject,
  consumeResource,
  updateLedgerEntry,
  deleteLedgerEntry,
  reloadProject,
}: ProjectResourcesTabProps) {
  const t = useTranslations('projects');

  const [showAssignSlideOver, setShowAssignSlideOver] = useState(false);
  const [showConsumeSlideOver, setShowConsumeSlideOver] = useState(false);
  const [prefilledResourceId, setPrefilledResourceId] = useState<string | null>(null);
  const [editingLedgerEntry, setEditingLedgerEntry] = useState<api.ProjectLedgerEntryResponseDto | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);

  // Filter ledger entries for resource consumption / timesheet
  const initialResourceLedgerEntries = useMemo(() => {
    return (ledgerEntries || []).filter(
      (e) => e.lineType === 'resource' || e.sourceType === 'timesheet',
    );
  }, [ledgerEntries]);

  const [paginatedResourceEntries, setPaginatedResourceEntries] = useState<api.ProjectLedgerEntryResponseDto[]>(initialResourceLedgerEntries);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(initialResourceLedgerEntries.length);

  const fetchResourceLedger = React.useCallback(async (cursorToFetch?: string | null, append = false) => {
    if (!projectId) return;
    setLoadingEntries(true);
    try {
      const res = await api.projectsControllerGetLedgerEntries(projectId, {
        lineType: 'resource',
        cursor: cursorToFetch || undefined,
        limit: 50,
      });
      const data = res.data as { data?: api.ProjectLedgerEntryResponseDto[]; nextCursor?: string | null; hasMore?: boolean; total?: number };
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(res.data) ? res.data : []);
      if (append) {
        setPaginatedResourceEntries((prev) => [...prev, ...items]);
      } else {
        setPaginatedResourceEntries(items);
      }
      setNextCursor(data?.nextCursor ?? null);
      setHasMore(Boolean(data?.hasMore));
      if (data?.total !== undefined) {
        setTotalCount(data.total);
      }
    } catch (err) {
      reportError(err, 'ProjectResourcesTab:fetchResourceLedger'); // fallback
    } finally {
      setLoadingEntries(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (projectId) {
      fetchResourceLedger();
    }
  }, [projectId, fetchResourceLedger]);

  React.useEffect(() => {
    if (initialResourceLedgerEntries.length > 0 && paginatedResourceEntries.length === 0) {
      setPaginatedResourceEntries(initialResourceLedgerEntries);
    }
  }, [initialResourceLedgerEntries, paginatedResourceEntries.length]);

  const effectiveResourceEntries = paginatedResourceEntries.length > 0 ? paginatedResourceEntries : initialResourceLedgerEntries;

  const assignedResourceIds = useMemo(() => {
    return (assignedResources || []).map((a) => a.resourceId);
  }, [assignedResources]);

  const formatResourceType = (type: string) => {
    switch (type) {
      case RESOURCE_TYPE.PERSON:
        return t('resources.typePerson');
      case RESOURCE_TYPE.CONTRACTOR:
        return t('resources.typeContractor');
      case RESOURCE_TYPE.EQUIPMENT:
        return t('resources.typeEquipment');
      default:
        return type;
    }
  };

  // Group ledger entries and assigned resources into the planned resources list
  const resourceSummaries = useMemo(() => {
    const summaryMap = new Map<string, ResourceSummaryRow>();

    // 1. First populate all explicitly assigned resources
    for (const a of assignedResources || []) {
      const matchedRes = resources.find((r) => r.resourceId === a.resourceId) || a.resource;
      const resName = matchedRes?.name || t('columns.resourceName');
      const resType = matchedRes?.resourceType || 'person';
      const resCode =
        (matchedRes as ProjectResource | undefined)?.resourceCode ||
        (matchedRes as { resourceNumber?: string } | undefined)?.resourceNumber;
      const serviceName = matchedRes?.serviceProduct?.name;
      const baseUom = matchedRes?.baseUom;

      summaryMap.set(a.resourceId, {
        resourceId: a.resourceId,
        name: resName,
        resourceCode: resCode,
        resourceType: resType,
        serviceName,
        baseUom,
        notes: a.notes || null,
        tasksWorked: [],
        consumedHours: Number(a.consumedQuantity || 0),
        lastPostingDate: null,
        entryCount: 0,
        isAssigned: true,
      });
    }

    // 2. Process ledger entries for active consumption & tasks worked
    for (const entry of effectiveResourceEntries) {
      const resId = entry.resourceId || 'unassigned';
      const matchedRes = resources.find((r) => r.resourceId === entry.resourceId);
      const resName = matchedRes?.name || entry.description || t('columns.resourceName');
      const resType = matchedRes?.resourceType || 'person';
      const resCode = matchedRes?.resourceCode || (matchedRes as { resourceNumber?: string })?.resourceNumber;
      const serviceName = matchedRes?.serviceProduct?.name;
      const baseUom = matchedRes?.baseUom;
      const matchedTask = tasks.find((tk) => tk.projectTaskId === entry.projectTaskId);
      const taskLabel = matchedTask
        ? matchedTask.taskCode
          ? `${matchedTask.taskCode} ${matchedTask.name}`
          : matchedTask.name
        : '';
      const qty = Number(entry.quantity || 0);
      const postDate = entry.postingDate ? new Date(entry.postingDate).toISOString() : null;

      if (!summaryMap.has(resId)) {
        summaryMap.set(resId, {
          resourceId: resId,
          name: resName,
          resourceCode: resCode,
          resourceType: resType,
          serviceName,
          baseUom,
          notes: null,
          tasksWorked: taskLabel ? [taskLabel] : [],
          consumedHours: qty,
          lastPostingDate: postDate,
          entryCount: 1,
          isAssigned: false,
        });
      } else {
        const existing = summaryMap.get(resId)!;
        const matchedAssigned = (assignedResources || []).find((a) => a.resourceId === resId);
        if (!matchedAssigned?.consumedQuantity) {
          existing.consumedHours += qty;
        }
        existing.entryCount += 1;
        if (!existing.serviceName && serviceName) {
          existing.serviceName = serviceName;
        }
        if (!existing.baseUom && baseUom) {
          existing.baseUom = baseUom;
        }
        if (!existing.notes && matchedAssigned?.notes) {
          existing.notes = matchedAssigned.notes;
        }
        if (taskLabel && !existing.tasksWorked.includes(taskLabel)) {
          existing.tasksWorked.push(taskLabel);
        }
        if (
          postDate &&
          (!existing.lastPostingDate || new Date(postDate) > new Date(existing.lastPostingDate))
        ) {
          existing.lastPostingDate = postDate;
        }
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.consumedHours - a.consumedHours);
  }, [assignedResources, effectiveResourceEntries, resources, tasks, t]);

  const handleRemoveResource = async (row: ResourceSummaryRow) => {
    if (!removeResourceFromProject) return;
    const confirmMsg = `Are you sure you want to remove ${row.name} from the project roster?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingResourceId(row.resourceId);
    try {
      await removeResourceFromProject(row.resourceId);
    } finally {
      setDeletingResourceId(null);
    }
  };

  const handleDeleteLedgerEntry = async (entry: api.ProjectLedgerEntryResponseDto) => {
    if (!deleteLedgerEntry) return;
    const confirmMsg = t('confirmDeleteTimeEntry') || 'Are you sure you want to delete this time entry?';
    if (!window.confirm(confirmMsg)) return;

    setDeletingLedgerId(entry.ledgerId);
    try {
      await deleteLedgerEntry(entry.ledgerId);
      await fetchResourceLedger();
    } finally {
      setDeletingLedgerId(null);
    }
  };

  const renderResourceActionButtons = (row: ResourceSummaryRow) => {
    if (!isEditable) return null;
    const isDeleting = deletingResourceId === row.resourceId;
    const isAssigned = (assignedResources || []).some((a) => a.resourceId === row.resourceId);

    return (
      <div className="flex items-center justify-end gap-2">
        {consumeResource && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10"
            title={t('buttons.consumeResource')}
            onClick={() => {
              setPrefilledResourceId(row.resourceId);
              setShowConsumeSlideOver(true);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
          </Button>
        )}
        {isAssigned && removeResourceFromProject && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Remove from Project Roster"
            disabled={isDeleting}
            onClick={() => handleRemoveResource(row)}
          >
            <span className="material-symbols-outlined text-[18px]">person_remove</span>
          </Button>
        )}
      </div>
    );
  };

  const renderLogActionButtons = (entry: api.ProjectLedgerEntryResponseDto) => {
    if (!isEditable) return null;
    const isDeleting = deletingLedgerId === entry.ledgerId;
    const isBilled = Boolean(entry.isBilled);

    return (
      <div className="flex items-center justify-end gap-2">
        {updateLedgerEntry && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title={isBilled ? 'Cannot edit billed time entries' : 'Edit Time Entry'}
            disabled={isDeleting || isBilled}
            onClick={() => setEditingLedgerEntry(entry)}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </Button>
        )}
        {deleteLedgerEntry && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="!px-2.5 !py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            title={isBilled ? 'Cannot delete billed time entries' : 'Delete Time Entry'}
            disabled={isDeleting || isBilled}
            onClick={() => handleDeleteLedgerEntry(entry)}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </Button>
        )}
      </div>
    );
  };

  const summaryColumns: DataTableColumn<ResourceSummaryRow>[] = useMemo(() => {
    const cols: DataTableColumn<ResourceSummaryRow>[] = [
      {
        id: 'resourceName',
        header: t('columns.resourceName'),
        render: (row) => (
          <div>
            <span className="font-semibold text-xs text-[var(--text-primary)] block">
              {row.name}
            </span>
            {row.resourceCode && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {row.resourceCode}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'resourceType',
        header: t('columns.resourceType'),
        width: '130px',
        render: (row) => (
          <span className="badge badge-secondary text-xs uppercase font-medium">
            {formatResourceType(row.resourceType)}
          </span>
        ),
      },
      {
        id: 'service',
        header: t('columns.service'),
        render: (row) => (
          <span className="text-xs text-[var(--text-primary)]">
            {row.serviceName || '—'}
          </span>
        ),
      },
      {
        id: 'tasksWorked',
        header: t('columns.tasksWorked'),
        render: (row) => (
          <span className="text-xs text-[var(--text-primary)]">
            {row.tasksWorked.length > 0 ? row.tasksWorked.join(', ') : '—'}
          </span>
        ),
      },
      {
        id: 'notes',
        header: t('columns.notes'),
        render: (row) => (
          <span
            className="text-xs text-[var(--text-primary)] line-clamp-1"
            title={row.notes || ''}
          >
            {row.notes || '—'}
          </span>
        ),
      },
      {
        id: 'consumedHours',
        header: t('columns.consumed'),
        align: 'right',
        render: (row) => (
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {`${row.consumedHours.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            })}${row.baseUom ? ` ${row.baseUom}` : ''}`}
          </span>
        ),
      },
      {
        id: 'lastActivity',
        header: t('columns.lastActivity'),
        align: 'right',
        render: (row) => (
          <span className="text-xs text-[var(--text-muted)]">
            {row.lastPostingDate ? formatLocalDate(row.lastPostingDate) : '—'}
          </span>
        ),
      },
    ];

    if (isEditable) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        align: 'right',
        width: '110px',
        render: (row) => renderResourceActionButtons(row),
      });
    }

    return cols;
  }, [isEditable, deletingResourceId, assignedResources, consumeResource, removeResourceFromProject, t]);

  const logColumns: DataTableColumn<api.ProjectLedgerEntryResponseDto>[] = useMemo(() => {
    const cols: DataTableColumn<api.ProjectLedgerEntryResponseDto>[] = [
      {
        id: 'date',
        header: t('columns.date'),
        width: '120px',
        render: (entry) => (
          <span className="text-xs text-[var(--text-muted)]">
            {formatLocalDate(entry.postingDate)}
          </span>
        ),
      },
      {
        id: 'resource',
        header: t('columns.resourceName'),
        render: (entry) => {
          const matchedRes = resources.find((r) => r.resourceId === entry.resourceId);
          return (
            <div>
              <span className="font-semibold text-xs text-[var(--text-primary)] block">
                {matchedRes?.name || entry.description || '—'}
              </span>
              {matchedRes?.serviceProduct?.name && (
                <span className="text-[11px] text-[var(--text-muted)] block">
                  {matchedRes.serviceProduct.name}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'task',
        header: t('labels.task'),
        render: (entry) => {
          const matchedTask = tasks.find((tk) => tk.projectTaskId === entry.projectTaskId);
          return (
            <span className="text-xs text-[var(--text-primary)]">
              {matchedTask
                ? `${matchedTask.taskCode ? `${matchedTask.taskCode} ` : ''}${matchedTask.name}`
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'quantity',
        header: t('columns.quantity'),
        align: 'right',
        render: (entry) => {
          const matchedRes = resources.find((r) => r.resourceId === entry.resourceId);
          const uom = matchedRes?.baseUom || 'Hours';
          return (
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {`${Number(entry.quantity || 0).toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              })} ${uom}`}
            </span>
          );
        },
      },
      {
        id: 'notes',
        header: t('columns.notes'),
        render: (entry) => (
          <span className="text-xs text-[var(--text-primary)] line-clamp-1" title={entry.description || ''}>
            {entry.description || '—'}
          </span>
        ),
      },
      {
        id: 'createdBy',
        header: t('columns.createdBy'),
        width: '130px',
        render: (entry) => (
          <span className="text-xs text-[var(--text-muted)]">
            {entry.createdBy || '—'}
          </span>
        ),
      },
    ];

    if (isEditable && (updateLedgerEntry || deleteLedgerEntry)) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        align: 'right',
        width: '100px',
        render: (entry) => renderLogActionButtons(entry),
      });
    }

    return cols;
  }, [isEditable, deletingLedgerId, resources, tasks, updateLedgerEntry, deleteLedgerEntry, t]);

  return (
    <div className="space-y-6">
      {/* Planned Resources / Staffing Roster Section */}
      <div id="resources-summary-section" className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="section-heading !mb-0">
            <span className="material-symbols-outlined">badge</span>
            {t('tabs.resources')}
          </h3>
          {isEditable && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {assignResourceToProject && (
                <Button size="sm" variant="secondary" onClick={() => setShowAssignSlideOver(true)}>
                  {t('buttons.assignResource')}
                </Button>
              )}
              {consumeResource && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setPrefilledResourceId(null);
                    setShowConsumeSlideOver(true);
                  }}
                >
                  {t('buttons.consumeResource')}
                </Button>
              )}
            </div>
          )}
        </div>

        <DataTable<ResourceSummaryRow>
          columns={summaryColumns}
          data={resourceSummaries}
          keyExtractor={(row) => row.resourceId}
          emptyMessage="No resources assigned to this project yet."
          mobileCard={(row) => (
            <MobileLineItemCard
              title={row.name}
              subtitle={row.resourceCode || undefined}
              topRightBadge={
                <span className="badge badge-secondary text-xs uppercase font-medium">
                  {formatResourceType(row.resourceType)}
                </span>
              }
              details={[
                ...(row.serviceName
                  ? [
                      {
                        label: t('columns.service'),
                        value: row.serviceName,
                      },
                    ]
                  : []),
                ...(row.notes
                  ? [
                      {
                        label: t('columns.notes'),
                        value: row.notes,
                      },
                    ]
                  : []),
                {
                  label: t('columns.tasksWorked'),
                  value: row.tasksWorked.length > 0 ? row.tasksWorked.join(', ') : '—',
                },
                {
                  label: t('columns.consumed'),
                  value: `${row.consumedHours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${row.baseUom ? ` ${row.baseUom}` : ''}`,
                  isHighlighted: true,
                },
                {
                  label: t('columns.lastActivity'),
                  value: row.lastPostingDate ? formatLocalDate(row.lastPostingDate) : '—',
                },
              ]}
              actions={renderResourceActionButtons(row)}
            />
          )}
        />
      </div>

      {/* Logged Time & Usage Log Card */}
      <div id="resources-log-section" className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-heading !mb-0">
            <span className="material-symbols-outlined">schedule</span>
            {t('sections.timeLog')}
          </h3>
        </div>

        <DataTable<api.ProjectLedgerEntryResponseDto>
          columns={logColumns}
          data={effectiveResourceEntries}
          keyExtractor={(entry, idx) => entry.ledgerId || `log-${idx}`}
          emptyMessage={t('placeholders.noTimeEntries')}
          mobileCard={(entry) => {
            const matchedRes = resources.find((r) => r.resourceId === entry.resourceId);
            const matchedTask = tasks.find((tk) => tk.projectTaskId === entry.projectTaskId);

            return (
              <MobileLineItemCard
                title={matchedRes?.name || entry.description || 'Resource Entry'}
                subtitle={
                  matchedTask
                    ? `${matchedTask.taskCode ? `${matchedTask.taskCode} ` : ''}${matchedTask.name}`
                    : undefined
                }
                topRightBadge={
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {`${Number(entry.quantity || 0).toLocaleString()}${matchedRes?.baseUom ? ` ${matchedRes.baseUom}` : ''}`}
                  </span>
                }
                details={[
                  {
                    label: t('columns.date'),
                    value: formatLocalDate(entry.postingDate),
                  },
                  {
                    label: t('columns.notes'),
                    value: entry.description || '—',
                  },
                  {
                    label: t('columns.createdBy'),
                    value: entry.createdBy || '—',
                  },
                ]}
                actions={renderLogActionButtons(entry)}
              />
            );
          }}
        />

        {hasMore && (
          <div className="flex items-center justify-center pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingEntries}
              onClick={() => fetchResourceLedger(nextCursor, true)}
            >
              {loadingEntries
                ? t('buttons.loadingMore') || 'Loading...'
                : t('buttons.loadMoreEntries') || `Load More Entries (${totalCount > paginatedResourceEntries.length ? `${paginatedResourceEntries.length} of ${totalCount}` : 'More'})`}
            </Button>
          </div>
        )}
      </div>

      {/* SlideOver: Consume Resource / Log Time */}
      {consumeResource && (
        <ConsumeProjectResourceSlideOver
          isOpen={showConsumeSlideOver}
          onClose={() => {
            setShowConsumeSlideOver(false);
            setPrefilledResourceId(null);
          }}
          projectId={projectId}
          projectNumber={projectNumber}
          tasks={tasks}
          resources={resources}
          assignedResourceIds={assignedResourceIds}
          budgetLines={budgetLines}
          ledgerEntries={ledgerEntries}
          currency={_currency}
          defaultResourceId={prefilledResourceId}
          discountPercentage={discountPercentage}
          consumeResource={consumeResource}
          onSuccess={async () => {
            await fetchResourceLedger();
            if (reloadProject) await reloadProject();
          }}
        />
      )}

      {/* SlideOver: Assign Resource to Project */}
      {assignResourceToProject && (
        <AssignProjectResourceSlideOver
          isOpen={showAssignSlideOver}
          onClose={() => setShowAssignSlideOver(false)}
          projectId={projectId}
          assignedResourceIds={assignedResourceIds}
          resources={resources}
          currency={_currency}
          onAssign={assignResourceToProject}
          onSuccess={async () => {
            if (reloadProject) await reloadProject();
          }}
        />
      )}

      {/* SlideOver: Edit Resource Usage Entry */}
      {updateLedgerEntry && (
        <EditResourceUsageSlideOver
          isOpen={editingLedgerEntry !== null}
          onClose={() => setEditingLedgerEntry(null)}
          entry={editingLedgerEntry}
          tasks={tasks}
          resources={resources}
          budgetLines={budgetLines}
          ledgerEntries={ledgerEntries}
          currency={_currency}
          onSubmit={async (ledgerId, dto) => {
            await updateLedgerEntry(ledgerId, dto);
          }}
          onSuccess={async () => {
            await fetchResourceLedger();
            if (reloadProject) await reloadProject();
          }}
        />
      )}
    </div>
  );
}
