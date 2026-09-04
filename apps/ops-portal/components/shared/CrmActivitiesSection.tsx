'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type { CrmActivityResponseDto } from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import LogActivityModal, { type OpportunityContactItem } from './LogActivityModal';
import { Button } from './Button';
import Tabs from './Tabs';

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
    setModalDefaultType(type);
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

  const displayTitle = title || t('title');

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'call':
        return t('types.call');
      case 'meeting':
        return t('types.meeting');
      case 'email':
        return t('types.email');
      case 'task':
        return t('types.task');
      case 'note':
        return t('types.note');
      default:
        return type;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return t('priorities.urgent');
      case 'high':
        return t('priorities.high');
      case 'medium':
        return t('priorities.medium');
      case 'low':
        return t('priorities.low');
      default:
        return priority;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return 'call';
      case 'meeting':
        return 'groups';
      case 'email':
        return 'mail';
      case 'task':
        return 'task_alt';
      case 'note':
      default:
        return 'description';
    }
  };

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
        {filteredActivities.length === 0 ? (
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
          filteredActivities.map((act) => {
            const isTask = act.type === 'task';
            const isDone = act.status === 'completed';
            const isOverdue =
              isTask && !isDone && act.dueDate && new Date(act.dueDate).getTime() < Date.now();

            return (
              <div
                key={act.activityId}
                className={`p-4 rounded-xl border transition-all ${
                  isOverdue
                    ? 'bg-rose-500/[0.02] border-rose-200 dark:border-rose-900/40 shadow-none'
                    : 'bg-[var(--surface)] border-[var(--border)] shadow-none hover:border-[var(--accent)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Task completion toggle or Activity Type Icon */}
                  {isTask ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleTaskComplete(act)}
                      className={`!p-1 !h-auto rounded-md transition-colors mt-0.5 ${
                        isDone
                          ? '!text-emerald-600 dark:!text-emerald-400'
                          : '!text-[var(--text-muted)] hover:!text-[var(--accent)]'
                      }`}
                      title={isDone ? t('actions.markOpen') : t('actions.markComplete')}
                    >
                      {isDone ? (
                        <span className="material-symbols-outlined text-[22px]">check_circle</span>
                      ) : (
                        <span className="material-symbols-outlined text-[22px]">radio_button_unchecked</span>
                      )}
                    </Button>
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[18px]">
                        {getActivityIcon(act.type)}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Subject title: clean without strikethrough */}
                      <span className="font-semibold text-sm text-[var(--text-primary)]">
                        {act.subject}
                      </span>

                      {/* Type Badge */}
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                        {getTypeLabel(act.type)}
                      </span>

                      {/* Priority Tag (only rendered when not completed) */}
                      {!isDone && act.priority && (
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
                            act.priority,
                          )}`}
                        >
                          {getPriorityLabel(act.priority)}
                        </span>
                      )}

                      {/* Due Date for Tasks */}
                      {act.dueDate && (
                        <span
                          className={`text-xs flex items-center gap-1 font-medium ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            calendar_today
                          </span>
                          <span>
                            {isOverdue ? `${t('tasks.overdue')}: ` : `${t('tasks.due')}: `}
                            {formatLocalDate(act.dueDate)}
                          </span>
                        </span>
                      )}

                      {/* Assignee chip */}
                      {act.assignedToName && (
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 ml-auto">
                          {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          <span>{act.assignedToName}</span>
                        </span>
                      )}
                    </div>

                    {/* Attached contacts */}
                    {act.contacts && act.contacts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {act.contacts.map((c) => {
                          const contactLabel = c.fullName || c.email || '';
                          return (
                            <Link
                              key={c.contactId}
                              href={`/crm/contacts/${c.contactId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                            >
                              {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                              <span className="material-symbols-outlined text-[13px] text-[var(--accent)]">person</span>
                              <span>{contactLabel}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* Description / Body text */}
                    {act.description && (
                      <p className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                        {act.description}
                      </p>
                    )}

                    {/* Footer metadata */}
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t('metadata.loggedBy', { user: act.createdBy || t('metadata.unknownUser') })}</span>
                      <span>•</span>
                      <span>{new Date(act.createdOn).toLocaleString()}</span>
                      {act.completedAt && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {t('metadata.completedOn', { date: formatLocalDate(act.completedAt) })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Activity Slideover Modal */}
      {entityId && (
        <LogActivityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            loadActivities();
            if (onActivityLogged) onActivityLogged();
          }}
          defaultType={modalDefaultType}
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          opportunityContacts={opportunityContacts}
        />
      )}
    </div>
  );
}
