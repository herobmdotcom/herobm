'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import JsonBrowserModal from '@/components/shared/JsonBrowserModal';
import { Button } from '@/components/shared/Button';

interface ReportConfigFormProps {
  initialData?: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string;
    dataSourceHook?: string;
    uiConfig?: Record<string, unknown>;
    isSystem?: boolean;
  };
}

export default function ReportConfigForm({ initialData }: ReportConfigFormProps) {
  const router = useRouter();
  const t = useTranslations('admin.businessReports.form');
  const tCommon = useTranslations('admin.common');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSystem, setIsSystem] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    dataSourceHook: '',
    uiConfigText: '{}',
  });

  const [browserOpen, setBrowserOpen] = useState(false);
  const [availableHooks, setAvailableHooks] = useState<string[]>([]);

  useEffect(() => {
    api.businessReportsControllerGetHooks()
      .then(res => setAvailableHooks((res.data as string[]) || []))
      .catch(err => {
        reportError(err, 'Failed to load hooks');
      });
  }, []);

  useEffect(() => {
    if (initialData) {
      setIsSystem(!!initialData.isSystem);
      setFormData({
        name: initialData.name || '',
        slug: initialData.slug || '',
        description: initialData.description || '',
        dataSourceHook: initialData.dataSourceHook || '',
        uiConfigText: initialData.uiConfig ? JSON.stringify(initialData.uiConfig, null, 2) : '{}',
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!formData.name || !formData.slug || !formData.dataSourceHook) {
      toast.error(t('toasts.validationFailed'));
      return;
    }

    let parsedUiConfig = null;
    try {
      parsedUiConfig = JSON.parse(formData.uiConfigText);
    } catch (err) {
      toast.error(t('toasts.invalidJson'));
      return;
    }

    const payload = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      dataSourceHook: formData.dataSourceHook,
      uiConfig: parsedUiConfig,
    };

    setIsSubmitting(true);
    try {
      if (initialData?.id) {
        await api.businessReportsControllerUpdateReport(initialData.id, payload);
        toast.success(t('toasts.updated'));
      } else {
        const res = await api.businessReportsControllerCreateReport(payload);
        toast.success(t('toasts.created'));
        const createdReport = res as { data?: { id?: string }; id?: string };
        router.push(`/reporting/config/${createdReport.data?.id || createdReport.id}`);
        return;
      }
      
      // Navigate back to the list
      router.push('/reporting/config');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.saveFailed'));
      reportError(err, 'ReportConfigForm_save');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, initialData?.id, router]);

  const handleDelete = useCallback(async () => {
    if (!initialData?.id) return;
    if (isSystem) {
      toast.error(t('toasts.systemDeleteError'));
      return;
    }

    if (!confirm(t('toasts.deleteConfirm'))) return;

    setIsSubmitting(true);
    try {
      await api.businessReportsControllerDeleteReport(initialData.id);
      toast.success(t('toasts.deleted'));
      router.push('/reporting/config');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('toasts.deleteFailed'));
      reportError(err, 'ReportConfigForm_delete');
    } finally {
      setIsSubmitting(false);
    }
  }, [initialData?.id, isSystem, router]);

  return (
    <div className="h-full p-4 lg:p-6 overflow-y-auto">
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)]">
              {initialData ? formData.name || t('titles.edit') : t('titles.new')}
            </h2>
          </div>

        {isSystem && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-4 rounded-md flex items-center gap-3">
            <span className="material-symbols-outlined text-[var(--text-muted)] text-[20px]">{`info`}</span>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('systemReportWarning')}
            </p>
          </div>
        )}

          <div className="flex gap-4 mt-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('labels.displayName')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                className="input w-full"
                placeholder={t('placeholders.displayName')}
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('labels.uniqueSlug')}</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => handleChange('slug', e.target.value)}
                className="input w-full"
                placeholder={t('placeholders.uniqueSlug')}
                disabled={isSystem}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('labels.dataSourceHook')}</label>
              <div className="flex gap-2">
                <select
                  value={formData.dataSourceHook}
                  onChange={e => handleChange('dataSourceHook', e.target.value)}
                  className="select flex-1"
                >
                  <option value="">{t('placeholders.selectDataSource')}</option>
                  {availableHooks.map((hook, idx) => (
                    <option key={`${hook}-${idx}`} value={hook}>{hook}</option>
                  ))}
                </select>
                <Button
                  variant="secondary" className="whitespace-nowrap text-[var(--accent)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/10"
                  onClick={() => setBrowserOpen(true)}
                  disabled={!formData.dataSourceHook}
                >
                  View Data
                </Button>
              </div>
            </div>

            <div className="flex-[2]">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('labels.description')}</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
          
          <div className="flex flex-col flex-1 mt-4">
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('labels.uiConfig')}</label>
            <textarea
              value={formData.uiConfigText}
              onChange={e => handleChange('uiConfigText', e.target.value)}
              className="flex-1 w-full border border-[var(--border)] rounded-lg font-mono text-sm leading-relaxed p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] whitespace-pre focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] min-h-[400px] resize-y"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button 
              variant="primary" className="px-8 py-3 text-sm font-bold rounded-lg transition-all btn btn-primary" 
              onClick={handleSave} 
              disabled={isSubmitting}
            >
              {isSubmitting ? t('buttons.saving') : t('buttons.save')}
            </Button>
            {initialData && !isSystem && (
              <Button 
                variant="secondary" className="px-8 py-3 text-sm font-bold rounded-lg border border-red-200 text-red-400 hover:bg-red-500/10 transition-all" 
                onClick={handleDelete} 
                disabled={isSubmitting}
              >
                {t('buttons.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <JsonBrowserModal 
        isOpen={browserOpen} 
        onClose={() => setBrowserOpen(false)} 
        hookSlug={formData.dataSourceHook} 
        type="report"
      />
    </div>
  );
}
