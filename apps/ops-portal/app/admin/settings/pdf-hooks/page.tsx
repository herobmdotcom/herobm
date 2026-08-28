'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { useRouter } from 'next/navigation';

interface Assignment {
  hookSlug: string;
  reportId: string | null;
  contextSlug: string | null;
  reportName?: string | null;
}

interface ReportTemplate {
  id: string;
  name: string;
  contexts?: string[];
}

export default function ReportingHooksPage() {
  const t = useTranslations('admin.reporting.hooks');
  useDocumentTitle(t('moduleTitle'));
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assignRes, templRes] = await Promise.all([
        api.pdfTemplatesControllerGetAssignments(),
        api.pdfTemplatesControllerGetAllReports()
      ]);
      setAssignments(assignRes.data || []);
      setTemplates(templRes.data || []);
    } catch (e) {
      reportError(e, 'ReportingHooksPage');
      toast.error('Failed to load hook assignments: ' + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (payload: Assignment, isNew: boolean) => {
    try {
      await api.pdfTemplatesControllerUpdateAssignment(payload.hookSlug, { 
        reportId: payload.reportId || '', 
        contextSlug: payload.contextSlug || '' 
      });
      toast.success(t('toast.success'));
      loadData();
    } catch (e: unknown) {
      reportError(e, 'ReportingHooksRow');
      toast.error(t('errors.updateFailed') + getErrorMessage(e));
      throw e;
    }
  };

  const columns: InlineTableColumn<Assignment>[] = useMemo(() => [
    { 
      key: 'hookSlug', 
      title: t('table.columns.hookSlug'), 
      type: 'text', 
      disabled: true,
      width: 250,
      render: (row) => <span className="font-mono text-xs">{row.hookSlug}</span>
    },
    { 
      key: 'contextSlug', 
      title: t('table.columns.contextResolver'), 
      type: 'text', 
      disabled: true,
      width: 200,
      render: (row) => <span className="text-xs text-gray-500 italic">{row.contextSlug || '—'}</span>
    },
    { 
      key: 'reportId', 
      title: t('table.columns.assignedTemplate'), 
      type: 'select', 
      options: (row) => {
        let available = templates;
        if (row.contextSlug) {
          available = templates.filter(tmpl => tmpl.contexts && tmpl.contexts.includes(row.contextSlug!));
        }
        return available.map(tmpl => ({ value: tmpl.id, label: tmpl.name }));
      },
      emptyLabel: t('table.selectTemplate')
    },
    {
      key: 'actions',
      title: '', 
      width: 150,
      render: (row, isEditing) => {
        if (isEditing || !row.reportId) return null;
        return (
          <div className="flex justify-start">
            <Link 
              href={`/admin/settings/pdf-templates/${row.reportId}`}
              className="text-[11px] font-bold text-[#006b5c] hover:underline uppercase tracking-widest"
            >
              {t('actions.editTemplate')}
            </Link>
          </div>
        );
      }
    }
  ], [t, templates]);

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="card mb-6">
        <InlineSettingsTable
          title={<span className="text-[var(--text-muted)] uppercase tracking-wider text-sm font-semibold">{t('table.title')}</span>}
          columns={columns}
          data={assignments}
          rowKey={row => row.hookSlug}
          onSave={handleSave}
          emptyLabel={loading ? null : t('table.empty')}
        />
      </div>
    </div>
  );
}
