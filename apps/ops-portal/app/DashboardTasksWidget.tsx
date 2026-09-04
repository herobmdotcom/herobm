'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type { CrmActivityResponseDto } from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import LogActivityModal from '@/components/shared/LogActivityModal';
import { Button } from '@/components/shared/Button';

export default function DashboardTasksWidget() {
  const t = useTranslations('dashboard.tasks');
  const tCrm = useTranslations('crm.activities');
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const [tasks, setTasks] = useState<CrmActivityResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: responseBody } = await api.crmActivitiesControllerFindAll({
        status: 'open',
        ...(filter === 'mine' ? { myTasks: 'true' } : { type: 'task' }),
        limit: 10,
      });
      setTasks(responseBody.data || []);
    } catch (err) {
      toast.error(t('failedToLoad'));
      reportError(err, 'DashboardTasksWidget - fetchTasks');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleComplete = async (taskId: string) => {
    // Optimistic removal from open list
    setTasks((prev) => prev.filter((item) => item.activityId !== taskId));

    try {
      await api.crmActivitiesControllerComplete(taskId, {});
      toast.success(t('taskCompleted'));
      fetchTasks();
    } catch {
      toast.error(t('failedToComplete'));
      fetchTasks();
    }
  };

  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      low: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    };
    return (
      <span
        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
          colors[priority] || colors.medium
        }`}
      >
        {tCrm(`priorities.${priority}` as `priorities.${'low' | 'medium' | 'high' | 'urgent'}`)}
      </span>
    );
  };

  return (
    <div className="card flex flex-col h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--accent)]">
            check_circle
          </span>
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">
            {filter === 'mine' ? t('myTasks') : t('allOpen')}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Filter Switch */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-lg text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilter('mine')}
              className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
                filter === 'mine'
                  ? '!bg-[var(--bg-card)] !text-[var(--text-primary)] font-semibold shadow-xs'
                  : '!text-[var(--text-muted)] hover:!text-[var(--text-secondary)]'
              }`}
            >
              {t('myTasks')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilter('all')}
              className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
                filter === 'all'
                  ? '!bg-[var(--bg-card)] !text-[var(--text-primary)] font-semibold shadow-xs'
                  : '!text-[var(--text-muted)] hover:!text-[var(--text-secondary)]'
              }`}
            >
              {t('allOpen')}
            </Button>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="h-7 text-xs px-2 font-medium"
            onClick={() => setIsCreateOpen(true)}
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>{t('newTask')}</span>
          </Button>
        </div>
      </div>

      {/* Content / Task List */}
      <div className="p-3 flex-1 overflow-y-auto min-h-[220px]">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-xs text-[var(--text-muted)]">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            {t('failedToLoad')}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center p-4">
            <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-2">
              task_alt
            </span>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const isOverdue =
                task.dueDate && new Date(task.dueDate).getTime() < Date.now();
              return (
                <div
                  key={task.activityId}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-black/[0.01] dark:bg-white/[0.01] hover:border-[var(--border-strong)] transition-all"
                >
                  <input
                    type="checkbox"
                    onChange={() => handleComplete(task.activityId)}
                    className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    title={t('completed')}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {task.subject}
                      </span>
                      {priorityBadge(task.priority)}
                    </div>

                    {task.description && (
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata: Linked entity & Due date */}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-secondary)] flex-wrap">
                      {task.dueDate && (
                        <span
                          className={`flex items-center gap-1 ${
                            isOverdue
                              ? 'text-red-600 font-bold'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            calendar_today
                          </span>
                          <span>
                            {isOverdue ? `${t('overdue')}: ` : `${t('due')}: `}
                            {formatLocalDate(task.dueDate)}
                          </span>
                        </span>
                      )}

                      {task.actorId && task.actorName && (
                        <Link
                          href={`/crm/actors/${task.actorId}`}
                          className="text-[var(--accent)] hover:underline flex items-center gap-0.5"
                        >
                          {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                          <span className="material-symbols-outlined text-[13px]">domain</span>
                          <span>{task.actorName}</span>
                        </Link>
                      )}

                      {task.contacts && task.contacts.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {task.contacts.map((c) => (
                            <Link
                              key={c.contactId}
                              href={`/crm/contacts/${c.contactId}`}
                              className="text-[var(--accent)] hover:underline flex items-center gap-0.5"
                            >
                              {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                              <span className="material-symbols-outlined text-[13px]">person</span>
                              <span>{c.fullName}</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {task.opportunityId && task.opportunityName && (
                        <Link
                          href={`/crm/opportunities/${task.opportunityId}`}
                          className="text-[var(--accent)] hover:underline flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-[13px]">trending_up</span>
                          <span>{task.opportunityName}</span>
                        </Link>
                      )}

                      {filter === 'all' && task.assignedToName && (
                        <span className="text-[var(--text-muted)] ml-auto">
                          {t('assignedTo')}: {task.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LogActivityModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchTasks}
        defaultType="task"
      />
    </div>
  );
}
