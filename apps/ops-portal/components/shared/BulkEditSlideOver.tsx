'use client';

import React, { useState, useEffect } from 'react';
import SlideOver from './SlideOver';
import { Button } from './Button';
import { getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export type FieldMode = 'unchanged' | 'set' | 'clear';

export interface BulkEditOption {
  label: string;
  value: string | number;
}

export interface BulkEditFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: BulkEditOption[];
  nullable?: boolean; // Defaults to true; if false, "clear" mode is unavailable
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
}

export interface BulkEditSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  selectedCount: number;
  fields: BulkEditFieldDef[];
  onApply: (payload: Record<string, unknown>) => Promise<{ updatedCount: number; skippedCount: number }>;
  onSuccess?: () => void;
}

export default function BulkEditSlideOver({
  isOpen,
  onClose,
  entityName,
  selectedCount,
  fields,
  onApply,
  onSuccess,
}: BulkEditSlideOverProps) {
  const t = useTranslations('common.bulkEdit');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMode>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setStep('edit');
      const initialModes: Record<string, FieldMode> = {};
      const initialValues: Record<string, unknown> = {};
      for (const f of fields) {
        initialModes[f.key] = 'unchanged';
        initialValues[f.key] = f.defaultValue !== undefined ? f.defaultValue : (f.type === 'boolean' ? false : '');
      }
      setFieldModes(initialModes);
      setFieldValues(initialValues);
    }
  }, [isOpen, fields]);

  const handleModeChange = (key: string, mode: FieldMode) => {
    setFieldModes((prev) => ({ ...prev, [key]: mode }));
  };

  const handleValueChange = (key: string, val: unknown) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }));
  };

  // Compute changed fields
  const changedFields = fields.filter((f) => {
    const mode = fieldModes[f.key] || 'unchanged';
    return mode !== 'unchanged';
  });

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const f of changedFields) {
      const mode = fieldModes[f.key];
      if (mode === 'clear') {
        payload[f.key] = null;
      } else if (mode === 'set') {
        const val = fieldValues[f.key];
        if (f.type === 'number') {
          payload[f.key] = val === '' || val === null || val === undefined ? null : Number(val);
        } else if (f.type === 'boolean') {
          payload[f.key] = Boolean(val);
        } else {
          payload[f.key] = val;
        }
      }
    }
    return payload;
  };

  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      const payload = buildPayload();
      const res = await onApply(payload);
      toast.success(
        t('success', { updated: res.updatedCount, entity: entityName }) +
          (res.skippedCount > 0 ? ` (${res.skippedCount} unchanged)` : '')
      );
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderValuePreview = (field: BulkEditFieldDef) => {
    const mode = fieldModes[field.key];
    if (mode === 'clear') {
      return <span className="text-[var(--text-muted)] italic">{t('clearInherit')}</span>;
    }
    const val = fieldValues[field.key];
    if (field.type === 'boolean') {
      return (
        <span className="font-semibold text-[var(--text-primary)]">
          {val ? t('yesEnabled') : t('noDisabled')}
        </span>
      );
    }
    if (field.options) {
      const opt = field.options.find((o) => String(o.value) === String(val));
      return (
        <span className="font-semibold text-[var(--text-primary)]">
          {opt ? opt.label : String(val)}
        </span>
      );
    }
    return <span className="font-semibold text-[var(--text-primary)]">{String(val || '—')}</span>;
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'edit'
          ? t('title', { count: selectedCount, entity: entityName })
          : t('confirmTitle')
      }
      subtitle={
        step === 'edit'
          ? `Select the fields you wish to update across all ${selectedCount} selected records.`
          : `Review the changes that will be applied to all ${selectedCount} selected records.`
      }
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {step === 'edit' ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={changedFields.length === 0}
                onClick={() => setStep('confirm')}
              >
                {t('reviewChanges', { count: changedFields.length })}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => setStep('edit')}
              >
                {t('backToEdit')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isSubmitting}
                loading={isSubmitting}
                onClick={handleConfirmSubmit}
              >
                {t('confirmApply', { count: selectedCount, entity: entityName })}
              </Button>
            </>
          )}
        </div>
      }
    >
      {step === 'edit' ? (
        <div className="space-y-6 py-2">
          {fields.map((field) => {
            const mode = fieldModes[field.key] || 'unchanged';
            const isNullable = field.nullable !== false;

            return (
              <div
                key={field.key}
                className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-sm font-semibold text-[var(--text-primary)]">
                      {field.label}
                    </label>
                    {field.helpText && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{field.helpText}</p>
                    )}
                  </div>
                  <div className="inline-flex rounded-md shadow-xs bg-[var(--bg-card)] border border-[var(--border)] p-0.5 shrink-0">
                    <Button
                      type="button"
                      size="xs"
                      variant={mode === 'unchanged' ? 'primary' : 'ghost'}
                      onClick={() => handleModeChange(field.key, 'unchanged')}
                    >
                      {t('noChange')}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant={mode === 'set' ? 'primary' : 'ghost'}
                      onClick={() => handleModeChange(field.key, 'set')}
                    >
                      {t('setValue')}
                    </Button>
                    {isNullable && (
                      <Button
                        type="button"
                        size="xs"
                        variant={mode === 'clear' ? 'primary' : 'ghost'}
                        onClick={() => handleModeChange(field.key, 'clear')}
                      >
                        {t('clearInherit')}
                      </Button>
                    )}
                  </div>
                </div>

                {mode === 'set' && (
                  <div className="pt-2 border-t border-[var(--border)]/60">
                    {field.type === 'select' && field.options ? (
                      <select
                        value={String(fieldValues[field.key] ?? '')}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className="w-full h-9 px-3 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="">{field.placeholder || `Select ${field.label}...`}</option>
                        {field.options.map((opt) => (
                          <option key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={Boolean(fieldValues[field.key])}
                          onChange={(e) => handleValueChange(field.key, e.target.checked)}
                          className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span className="text-sm text-[var(--text-primary)]">
                          Enable {field.label}
                        </span>
                      </label>
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        placeholder={field.placeholder || 'Enter value...'}
                        value={fieldValues[field.key] !== undefined ? String(fieldValues[field.key]) : ''}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className="w-full h-9 px-3 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={field.placeholder || 'Enter value...'}
                        value={String(fieldValues[field.key] ?? '')}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className="w-full h-9 px-3 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    )}
                  </div>
                )}

                {mode === 'clear' && (
                  <p className="text-xs text-amber-500 pt-1">
                    {t('clearNotice')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Confirmation Screen */
        <div className="space-y-6 py-2">
          {/* Prominent Warning Banner */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">
              warning
            </span>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {t('warningBanner', { count: selectedCount, entity: entityName })}
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {t('warningNotice', { count: selectedCount })}
              </p>
            </div>
          </div>

          {/* Diff Summary Table */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t('changesSummary', { count: changedFields.length })}
            </h5>
            <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)]">
              {changedFields.map((field) => (
                <div
                  key={field.key}
                  className="px-4 py-3 flex items-center justify-between bg-[var(--bg-card)] text-sm"
                >
                  <span className="font-medium text-[var(--text-primary)]">{field.label}</span>
                  <div className="text-right">{renderValuePreview(field)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}
