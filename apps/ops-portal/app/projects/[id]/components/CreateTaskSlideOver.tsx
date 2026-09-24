'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

interface CreateTaskSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: api.ProjectTaskResponseDto[];
  onSubmit: (dto: api.CreateProjectTaskDto) => Promise<void>;
}

export function CreateTaskSlideOver({
  isOpen,
  onClose,
  tasks,
  onSubmit,
}: CreateTaskSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    taskCode: '',
    name: '',
    description: '',
    parentTaskId: '',
    plannedStartDate: '',
    plannedEndDate: '',
    isMilestone: false,
    isBillable: true,
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        taskCode: '',
        name: '',
        description: '',
        parentTaskId: '',
        plannedStartDate: '',
        plannedEndDate: '',
        isMilestone: false,
        isBillable: true,
      });
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskCode.trim() || !form.name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        taskCode: form.taskCode.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        parentTaskId: form.parentTaskId || undefined,
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate: form.plannedEndDate || undefined,
        isMilestone: form.isMilestone,
        isBillable: form.isBillable,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('createTaskTitle')}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            variant="primary"
            loading={submitting}
            disabled={submitting}
          >
            {submitting ? t('buttons.saving') : t('buttons.addTask')}
          </Button>
        </div>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.taskCode')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              className="input w-full text-xs"
              placeholder={t('placeholders.taskCode')}
              value={form.taskCode}
              onChange={(e) => setForm((p) => ({ ...p, taskCode: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.taskName')} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              className="input w-full text-xs"
              placeholder={t('placeholders.taskName')}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
            {t('labels.description')}
          </label>
          <textarea
            rows={3}
            className="input w-full text-xs pt-2"
            placeholder={t('placeholders.taskDescription')}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {tasks.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.parentTask')}
            </label>
            <select
              className="input w-full text-xs"
              value={form.parentTaskId}
              onChange={(e) => setForm((p) => ({ ...p, parentTaskId: e.target.value }))}
            >
              <option value="">{t('labels.noneTopLevel')}</option>
              {tasks.map((tk) => (
                <option key={tk.projectTaskId} value={tk.projectTaskId}>
                  {tk.taskCode ? `${tk.taskCode} — ` : ''}{tk.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.startDate')}
            </label>
            <input
              type="date"
              className="input w-full text-xs"
              value={form.plannedStartDate}
              onChange={(e) => setForm((p) => ({ ...p, plannedStartDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.endDate')}
            </label>
            <input
              type="date"
              className="input w-full text-xs"
              value={form.plannedEndDate}
              onChange={(e) => setForm((p) => ({ ...p, plannedEndDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
              checked={form.isMilestone}
              onChange={(e) => setForm((p) => ({ ...p, isMilestone: e.target.checked }))}
            />
            <span className="text-sm text-[var(--text-primary)]">
              {t('labels.isMilestone')}
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
              checked={form.isBillable}
              onChange={(e) => setForm((p) => ({ ...p, isBillable: e.target.checked }))}
            />
            <span className="text-sm text-[var(--text-primary)]">
              {t('labels.isBillable')}
            </span>
          </label>
        </div>
      </form>
    </SlideOver>
  );
}
