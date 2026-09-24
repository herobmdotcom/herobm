'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { OrderedSettingEditor } from '@/components/shared/OrderedSettingEditor';
import PageNav from '@/components/shared/PageNav';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';

export default function ProjectsSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  useDocumentTitle('Project Settings');
  const t = useTranslations();

  // ── App Settings state ─────────────────────────────────────────────────────
  const [appForm, setAppForm] = useState<Partial<api.AppConfigResponseDto>>({});
  const [appLoading, setAppLoading] = useState(true);

  const loadAppConfig = async () => {
    try {
      setAppLoading(true);
      const res = await api.appConfigControllerGet();
      setAppForm(res.data || {});
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: 'App Config' }) + ': ' + getErrorMessage(err));
    } finally {
      setAppLoading(false);
    }
  };

  const updateAppField = async (field: string, value: unknown) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
      setAppForm((prev: unknown) => ({ ...(prev as Record<string, any>), [field]: value }));
      await api.appConfigControllerUpdate({ [field]: value });
      toast.success(t('common.updated'));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadAppConfig();
  }, []);

  const navSections = useMemo(() => [
    { id: 'stages-section', label: 'Delivery Stages', show: true },
  ], []);

  if (appLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="Project Settings"
        subtitle="Configure operational project delivery stages, milestones, and workflow settings."
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {/* ── Stages Settings ─────────────────────────────────────────────── */}
        <div id="stages-section" className="card">
          <OrderedSettingEditor
            title={
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                <span className="material-symbols-outlined">flag</span>
                Project Delivery Stages
              </h3>
            }
            columnTitle="Stage"
            items={appForm?.projectStages || []}
            onChange={(newStages) => updateAppField('projectStages', newStages)}
          />
        </div>
      </div>
    </div>
  );
}
