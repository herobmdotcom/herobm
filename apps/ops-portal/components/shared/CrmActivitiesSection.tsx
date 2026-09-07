'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type { CrmActivityResponseDto } from '@herobm/sdk';
import LogActivityModal, { type OpportunityContactItem } from './LogActivityModal';
import { Button } from './Button';
import Tabs from './Tabs';
import { CrmActivityCard } from './CrmActivityCard';

export interface CrmActivitiesSectionProps {
  entityType: 'actor' | 'contact' | 'opportunity';
  entityId: string;
  entityName?: string;
  title?: string;
  opportunityContacts?: OpportunityContactItem[];
  onActivityLogged?: () => void;
}

export default function CrmActivitiesSection({
  entityType,
  entityId,
  entityName,
  title,
  opportunityContacts,
  onActivityLogged,
}: CrmActivitiesSectionProps) {
  const t = useTranslations('crm.activities');
  const [filterTab, setFilterTab] = useState<'all' | 'interactions' | 'tasks'>('all');
  const [activities, setActivities] = useState<CrmActivityResponseDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<'call' | 'meeting' | 'email' | 'task'>('call');
  const [activityToEdit, setActivityToEdit] = useState<CrmActivityResponseDto | null>(null);

  const loadActivities = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const query: api.CrmActivitiesControllerFindAllParams = {};
      if (entityType === 'actor') {
        query.actorId = entityId;
      } else if (entityType === 'contact') {
        query.contactId = entityId;
      } else if (entityType === 'opportunity') {
        query.opportunityId = entityId;
      }

      const res = await api.crmActivitiesControllerFindAll(query);
      const items = res.data?.data;
      setActivities(Array.isArray(items) ? items : []);
    } catch {
      toast.error(t('toasts.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, t]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleToggleTaskComplete = async (act: CrmActivityResponseDto) => {
    const isCompleted = act.status === 'completed';
    const originalStatus = act.status;
    const newStatus = isCompleted ? 'open' : 'completed';

    // Optimistic update
    setActivities((prev) =>
      prev.map((a) =>
        a.activityId === act.activityId
          ? { ...a, status: newStatus, completedAt: isCompleted ? null : new Date().toISOString() }
          : a,
      ),
    );

    try {
      if (isCompleted) {
        await api.crmActivitiesControllerUpdate(act.activityId, { status: 'open' });
      } else {
        await api.crmActivitiesControllerComplete(act.activityId, {});
      }
      toast.success(t(isCompleted ? 'toasts.reopened' : 'toasts.completed'));
      if (onActivityLogged) onActivityLogged();
    } catch {
      // Revert optimistic update
      setActivities((prev) =>
        prev.map((a) => (a.activityId === act.activityId ? { ...a, status: originalStatus } : a)),
      );
      toast.error(t('toasts.failedToUpdate'));
    }
  };

  const openLogModal = (type: 'call' | 'meeting' | 'email' | 'task') => {
    setActivityToEdit(null);
    setModalDefaultType(type);
    setIsModalOpen(true);
  };

  const handleEditActivity = (act: CrmActivityResponseDto) => {
    setActivityToEdit(act);
    setIsModalOpen(true);
  };

  // Filter activities based on tab
  const filteredActivities = activities.filter((act) => {
    if (filterTab === 'interactions') {
      return act.type !== 'task';
    }
    if (filterTab === 'tasks') {
      return act.type === 'task';
    }
    return true;
  });

  // Sort activities: all open tasks at the top ordered by due date soonest first, then natural ordering (newest first) for other activities and closed tasks
  const sortedActivities = useMemo(() => {
    const getTime = (dateStr?: string | null) => (dateStr ? new Date(dateStr).getTime() : 0);
    const openTasks: CrmActivityResponseDto[] = [];
    const others: CrmActivityResponseDto[] = [];

    for (const act of filteredActivities) {
      if (act.type === 'task' && act.status !== 'completed') {
        openTasks.push(act);
      } else {
        others.push(act);
      }
    }

    // Open tasks ordered by Due Date, soonest first (nulls last, tie-breaker createdOn descending)
    openTasks.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const diff = getTime(a.dueDate) - getTime(b.dueDate);
        if (diff !== 0) return diff;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return getTime(b.createdOn) - getTime(a.createdOn);
    });

    // Natural ordering for other activities and closed tasks: newest first
    others.sort((a, b) => {
      return getTime(b.createdOn) - getTime(a.createdOn);
    });

    return [...openTasks, ...others];
  }, [filteredActivities]);

  const displayTitle = title || t('title');

  return (
    <div className="card p-6 flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-none">
      {/* Header with Title and Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="section-heading mb-0">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
          <span className="material-symbols-outlined">forum</span>
          {displayTitle}
        </h3>

        {/* Quick action buttons for logging */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openLogModal('call')}
            className="!text-xs !py-1 !px-2.5 flex items-center gap-1"
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined text-[15px] text-blue-500">call</span>
            <span>{t('types.call')}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => openLogModal('meeting')}
            className="!text-xs !py-1 !px-2.5 flex items-center gap-1"
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined text-[15px] text-purple-500">groups</span>
            <span>{t('types.meeting')}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => openLogModal('email')}
            className="!text-xs !py-1 !px-2.5 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-500">mail</span>
            <span>{t('types.email')}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => openLogModal('task')}
            className="!text-xs !py-1 !px-2.5 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px] text-teal-600 dark:text-teal-400">task_alt</span>
            <span>{t('types.task')}</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs using standard Tabs component */}
      <Tabs<'all' | 'interactions' | 'tasks'>
        tabs={[
          {
            id: 'all',
            label: t('filter.all'),
            badge: `(${activities.length})`,
          },
          {
            id: 'interactions',
            label: t('filter.interactions'),
            badge: `(${activities.filter((a) => a.type !== 'task').length})`,
          },
          {
            id: 'tasks',
            label: t('filter.tasks'),
            badge: `(${activities.filter((a) => a.type === 'task').length})`,
          },
        ]}
        activeTab={filterTab}
        onChange={setFilterTab}
        size="sm"
        actions={
          loading ? (
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            </div>
          ) : undefined
        }
      />

      {/* Activity List */}
      <div className="space-y-3 mt-1">
        {sortedActivities.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-muted)]/50">
            <span className="material-symbols-outlined text-[36px] text-[var(--text-muted)] mb-2 block">
              chat_bubble_outline
            </span>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-4">
              {t('empty')}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openLogModal('call')}
              className="inline-flex items-center gap-1.5"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>{t('actions.logInteraction')}</span>
            </Button>
          </div>
        ) : (
          sortedActivities.map((act) => (
            <CrmActivityCard
              key={act.activityId}
              activity={act}
              showOpportunity={entityType !== 'opportunity'}
              onToggleComplete={handleToggleTaskComplete}
              onEdit={handleEditActivity}
            />
          ))
        )}
      </div>

      {/* Log / Edit Activity Slideover Modal */}
      {entityId && (
        <LogActivityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActivityToEdit(null);
          }}
          onSuccess={() => {
            loadActivities();
            if (onActivityLogged) onActivityLogged();
          }}
          defaultType={modalDefaultType}
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          opportunityContacts={opportunityContacts}
          activityToEdit={activityToEdit}
        />
      )}
    </div>
  );
}
