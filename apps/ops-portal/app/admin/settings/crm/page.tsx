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
import { Button } from '@/components/shared/Button';

export default function CRMSettingsPage() {
  const tSettings = useTranslations('admin.settings');
  useDocumentTitle('CRM Settings');
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
    { id: 'roles-section', label: 'Roles', show: true },
    { id: 'projects-section', label: 'Projects', show: true },
    { id: 'referrals-section', label: 'Referrals', show: true },
  ], []);

  const flushCache = async () => {
    try {
      await api.glControllerReloadSettings({});
      toast.success('Settings cache flushed successfully.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  if (appLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="CRM Settings"
        subtitle={tSettings('subtitle')}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        {/* ── Roles Settings ─────────────────────────────────────────────── */}
        <div id="roles-section" className="card">
          <h3 className="section-heading flex items-center gap-2 mb-6">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined">badge</span>
            Tags & Roles
          </h3>
          <div className="flex flex-col gap-8">
            <OrderedSettingEditor
              title="Actor Tags"
              columnTitle="Tag"
              items={appForm?.actorTags || []}
              onChange={(newTags) => updateAppField('actorTags', newTags)}
            />
            <OrderedSettingEditor
              title="Actor Contact Roles"
              columnTitle="Role"
              items={appForm?.actorContactRoles || []}
              onChange={(newRoles) => updateAppField('actorContactRoles', newRoles)}
            />
            <OrderedSettingEditor
              title="Project Contact Roles"
              columnTitle="Role"
              items={appForm?.projectContactRoles || []}
              onChange={(newRoles) => updateAppField('projectContactRoles', newRoles)}
            />
            <OrderedSettingEditor
              title="Project Actor Roles"
              columnTitle="Role"
              items={appForm?.projectActorRoles || []}
              onChange={(newRoles) => updateAppField('projectActorRoles', newRoles)}
            />
          </div>
        </div>

        {/* ── Projects Settings ─────────────────────────────────────────────── */}
        <div id="projects-section" className="card">
          <h3 className="section-heading flex items-center gap-2 mb-6">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined">folder</span>
            Projects
          </h3>
          <div className="flex flex-col gap-8">
            <OrderedSettingEditor
              title="Project Statuses"
              columnTitle="Status"
              items={appForm?.projectStatuses || []}
              onChange={(newStatuses) => updateAppField('projectStatuses', newStatuses)}
            />
            <OrderedSettingEditor
              title="Project Types"
              columnTitle="Type"
              items={appForm?.projectTypes || []}
              onChange={(newTypes) => updateAppField('projectTypes', newTypes)}
            />
          </div>
        </div>

        {/* ── Referrals Settings ─────────────────────────────────────────────── */}
        <div id="referrals-section" className="card">
          <h3 className="section-heading flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined">group_add</span>
            Referrals
          </h3>
          <div className="flex flex-col gap-8">
            <OrderedSettingEditor
              title="Referral Modes"
              columnTitle="Mode"
              items={appForm?.referralModes || []}
              onChange={(newModes) => updateAppField('referralModes', newModes)}
            />
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <Button variant="secondary" onClick={flushCache}>
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined mr-2">refresh</span>
            Refresh Cache
          </Button>
        </div>
      </div>
    </div>
  );
}
