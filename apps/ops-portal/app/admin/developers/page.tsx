'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMemo } from 'react';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import PageNav from '@/components/shared/PageNav';
import { useTranslations } from 'next-intl';
import { useHelp } from '@/components/help/HelpContext';
import { useDevelopers } from './hooks/useDevelopers';
import { RateLimitsSection } from './components/RateLimitsSection';
import { ApiKeysSection } from './components/ApiKeysSection';
import { WebhooksSection } from './components/WebhooksSection';
import { SecretModal } from './components/SecretModal';

export default function DevelopersPage() {
  useDocumentTitle('Developers');
  const tDev = useTranslations('admin.developers');
  const { openHelp } = useHelp();

  const {
    appForm,
    setAppForm,
    appLoading,
    updateAppField,
    apiKeys,
    roles,
    createApiKey,
    revokeApiKey,
    webhooks,
    availableEvents,
    createWebhook,
    deleteWebhook,
    newSecret,
    setNewSecret,
  } = useDevelopers();

  const navSections = useMemo(
    () => [
      { id: 'rate-limits', label: 'Rate Limits', show: true },
      { id: 'api-keys', label: 'API Keys', show: true },
      { id: 'webhooks', label: 'Webhooks', show: true },
    ],
    [],
  );

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="Developers"
        subtitle="Manage API access, webhooks, and rate limits"
        actions={[
          {
            label: tDev('webhooksGuide'),
            onClick: () => openHelp('webhooks-api'),
            variant: 'secondary',
          },
          {
            label: tDev('apiReference'),
            onClick: () => openHelp('api-reference'),
            variant: 'secondary',
          },
          {
            label: tDev('swaggerUi'),
            onClick: () => window.open('/api/docs', '_blank', 'noopener,noreferrer'),
            variant: 'secondary',
          },
        ]}
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>

      <div className="flex flex-col gap-6">
        <RateLimitsSection
          appForm={appForm}
          setAppForm={setAppForm}
          appLoading={appLoading}
          updateAppField={updateAppField}
        />

        <ApiKeysSection
          apiKeys={apiKeys}
          roles={roles}
          createApiKey={createApiKey}
          revokeApiKey={revokeApiKey}
        />

        <WebhooksSection
          webhooks={webhooks}
          availableEvents={availableEvents}
          createWebhook={createWebhook}
          deleteWebhook={deleteWebhook}
        />
      </div>

      <SecretModal secret={newSecret} onClose={() => setNewSecret(null)} />
    </div>
  );
}
