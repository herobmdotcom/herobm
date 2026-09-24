'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { formatAmount } from '@/lib/currency';
import { PROJECT_TASK_STATE, ProjectTaskState } from '@herobm/shared';
import { CreateTaskSlideOver } from './CreateTaskSlideOver';
import { EditTaskSlideOver } from './EditTaskSlideOver';

interface ProjectTasksTabProps {
  tasks: api.ProjectTaskResponseDto[];
  isEditable: boolean;
  isProjectActive?: boolean;
  saving: boolean;
  createTask: (dto: api.CreateProjectTaskDto) => Promise<void>;
  updateTask: (taskId: string, dto: api.UpdateProjectTaskDto) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
}

export function ProjectTasksTab({
  tasks,
  isEditable,
  isProjectActive,
  saving,
  createTask,
  updateTask,
  deleteTask,
}: ProjectTasksTabProps) {
  const t = useTranslations('projects');
  const tConfirm = useTranslations('confirm');
  const [showCreateSlideOver, setShowCreateSlideOver] = useState(false);
  const [editingTask, setEditingTask] = useState<api.ProjectTaskResponseDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleComplete = async (task: api.ProjectTaskResponseDto) => {
    const confirmMsg = tConfirm('completeTask');
    if (!window.confirm(confirmMsg)) return;
    await updateTask(task.projectTaskId, {
      stateCode: PROJECT_TASK_STATE.COMPLETED as ProjectTaskState,
    });
  };

  const handleDelete = async (task: api.ProjectTaskResponseDto) => {
    if (!deleteTask) return;
    const confirmMsg = t('confirmDeleteTask') || `Are you sure you want to delete task ${task.taskCode}?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(task.projectTaskId);
    try {
      await deleteTask(task.projectTaskId);
    } finally {
      setDeletingId(null);
    }
  };

  const renderActionButtons = (task: api.ProjectTaskResponseDto) => {
    const isDeleting = deletingId === task.projectTaskId;
    const isCompleted = task.stateCode === PROJECT_TASK_STATE.COMPLETED;

    return (
      <div className="flex items-center justify-end gap-2">
        {task.stateCode === PROJECT_TASK_STATE.NOT_STARTED && isEditable && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saving || !isProjectActive || isDeleting}
            title={!isProjectActive ? 'Project must be active to start tasks' : undefined}
            onClick={() => updateTask(task.projectTaskId, { stateCode: PROJECT_TASK_STATE.IN_PROGRESS as ProjectTaskState })}
          >
            Start
          </Button>
        )}
        {task.stateCode === PROJECT_TASK_STATE.IN_PROGRESS && isEditable && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving || isDeleting}
            onClick={() => handleComplete(task)}
          >
            Complete
          </Button>
        )}
        {isEditable && !isCompleted && (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="!px-2.5 !py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title={t('buttons.editTask')}
              disabled={saving || isDeleting}
              onClick={() => setEditingTask(task)}
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </Button>
            {deleteTask && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!px-2.5 !py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                title={t('buttons.deleteTask')}
                disabled={saving || isDeleting}
                onClick={() => handleDelete(task)}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  const columns: DataTableColumn<api.ProjectTaskResponseDto>[] = useMemo(
    () => [
      {
        id: 'taskCode',
        header: t('columns.taskCode') || 'Code',
        width: '100px',
        render: (task) => (
          <span className="font-mono font-semibold text-xs text-[var(--accent)]">
            {task.taskCode}
          </span>
        ),
      },
      {
        id: 'name',
        header: t('columns.taskName') || 'Task Name',
        render: (task) => (
          <div>
            <span className="font-medium text-[var(--text-primary)]">{task.name}</span>
            {task.description && (
              <p className="text-xs text-[var(--text-muted)] truncate max-w-xs">{task.description}</p>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: t('columns.status') || 'Status',
        width: '130px',
        render: (task) => <StateBadge state={task.stateCode as ValidState} />,
      },
      {
        id: 'milestone',
        header: t('labels.isMilestone') || 'Milestone',
        width: '110px',
        render: (task) => (
          <span className="text-xs">
            {task.isMilestone ? <span className="font-medium text-[var(--accent)]">Milestone</span> : <span>—</span>}
          </span>
        ),
      },
      {
        id: 'billable',
        header: t('labels.isBillable') || 'Billable',
        width: '110px',
        render: (task) => (
          <span className="text-xs">
            {task.isBillable ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Billable</span> : <span>Internal</span>}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        width: '140px',
        render: (task) => renderActionButtons(task),
      },
    ],
    [t, saving, isProjectActive, deletingId, isEditable]
  );

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="section-heading !mb-0">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined">checklist</span>
          {t('tabs.wbs')}
        </h3>
        {isEditable && (
          <div className="self-start sm:self-auto">
            <Button size="sm" variant="primary" onClick={() => setShowCreateSlideOver(true)}>
              {t('buttons.addTask')}
            </Button>
          </div>
        )}
      </div>

      <DataTable<api.ProjectTaskResponseDto>
        columns={columns}
        data={tasks}
        keyExtractor={(task) => task.projectTaskId}
        emptyMessage="No tasks defined for this project yet. Click &quot;Add Task&quot; to begin building your WBS."
        mobileCard={(task) => (
          <MobileLineItemCard
            title={
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-sm text-[var(--accent)]">{task.taskCode}</span>
                <span className="font-semibold text-sm text-[var(--text-primary)]">{task.name}</span>
              </div>
            }
            subtitle={task.description || undefined}
            topRightBadge={<StateBadge state={task.stateCode as ValidState} />}
            details={[
              {
                label: t('labels.isMilestone') || 'Milestone',
                value: task.isMilestone ? (
                  <span className="font-medium text-[var(--accent)]">Milestone</span>
                ) : (
                  '—'
                ),
              },
              {
                label: t('labels.isBillable') || 'Billable',
                value: task.isBillable ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Billable</span>
                ) : (
                  'Internal'
                ),
              },
            ]}
            actions={renderActionButtons(task)}
          />
        )}
      />

      {/* SlideOver: Create Task */}
      <CreateTaskSlideOver
        isOpen={showCreateSlideOver}
        onClose={() => setShowCreateSlideOver(false)}
        tasks={tasks}
        onSubmit={createTask}
      />

      {/* SlideOver: Edit Task */}
      <EditTaskSlideOver
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        tasks={tasks}
        onSubmit={updateTask}
      />
    </div>
  );
}
