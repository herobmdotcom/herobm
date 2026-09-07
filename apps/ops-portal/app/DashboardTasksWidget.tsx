'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type { CrmActivityResponseDto } from '@herobm/sdk';
import { reportError } from '@/lib/api';
import LogActivityModal from '@/components/shared/LogActivityModal';
import { Button } from '@/components/shared/Button';
import { CrmActivityCard } from '@/components/shared/CrmActivityCard';

export default function DashboardTasksWidget() {
  const t = useTranslations('dashboard.tasks');
  const tCommon = useTranslations('common');
  const [tasks, setTasks] = useState<CrmActivityResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<CrmActivityResponseDto | null>(null);

  // Order tasks by Due Date, soonest first (nulls last, tie-breaker createdOn descending)
  const sortedTasks = useMemo(() => {
    const getTime = (dateStr?: string | null) => (dateStr ? new Date(dateStr).getTime() : 0);
    return [...tasks].sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const diff = getTime(a.dueDate) - getTime(b.dueDate);
        if (diff !== 0) return diff;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return getTime(b.createdOn) - getTime(a.createdOn);
    });
  }, [tasks]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: responseBody } = await api.crmActivitiesControllerFindAll({
        status: 'open',
        myTasks: 'true',
        limit: 10,
      });
      setTasks(responseBody?.data || []);
    } catch (err) {
      toast.error(t('failedToLoad'));
      reportError(err, 'DashboardTasksWidget - fetchTasks');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleComplete = async (act: CrmActivityResponseDto) => {
    // Optimistic removal from open list
    setTasks((prev) => prev.filter((item) => item.activityId !== act.activityId));

    try {
      await api.crmActivitiesControllerComplete(act.activityId, {});
      toast.success(t('taskCompleted'));
      fetchTasks();
    } catch {
      toast.error(t('failedToComplete'));
      fetchTasks();
    }
  };

  const handleOpenCreate = () => {
    setActivityToEdit(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (act: CrmActivityResponseDto) => {
    setActivityToEdit(act);
    setIsCreateOpen(true);
  };

  return (
    <div className="w-full flex flex-col">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50 text-[var(--text-primary)]">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {t('title')}
        </div>

        <Button
          variant="primary"
          size="sm"
          className="h-7 text-xs px-2.5 font-medium"
          onClick={handleOpenCreate}
        >
          {t('newTask')}
        </Button>
      </div>

      {/* Cards / Empty State */}
      {loading ? (
        <div className="flex items-center justify-center p-4 rounded-xl border bg-[var(--bg-card)] border-[var(--border)] text-xs text-[var(--text-muted)]">
          <span className="material-symbols-outlined animate-spin mr-2 text-[16px]">progress_activity</span>
          {tCommon('loadingEllipsis')}
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="p-3.5 sm:p-4 rounded-xl border bg-[var(--bg-card)] border-[var(--border)] text-center text-[12px] text-[var(--text-muted)] leading-tight">
          {t('empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedTasks.map((task) => (
            <CrmActivityCard
              key={task.activityId}
              activity={task}
              showOpportunity={true}
              onToggleComplete={handleToggleComplete}
              onEdit={handleOpenEdit}
            />
          ))}
        </div>
      )}

      <LogActivityModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setActivityToEdit(null);
        }}
        onSuccess={fetchTasks}
        defaultType="task"
        activityToEdit={activityToEdit}
      />
    </div>
  );
}
