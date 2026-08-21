'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import { formatLocalDate } from '@/lib/date';
import * as api from '@herobm/sdk';
import { ApiKey } from '../hooks/useDevelopers';

interface ApiKeysSectionProps {
  apiKeys: ApiKey[];
  roles: api.RoleDetailsDto[];
  createApiKey: (name: string, role: string) => Promise<void>;
  revokeApiKey: (apiKeyId: string) => Promise<void>;
}

export function ApiKeysSection({
  apiKeys,
  roles,
  createApiKey,
  revokeApiKey,
}: ApiKeysSectionProps) {
  const tCommon = useTranslations('admin.common');
  const tDev = useTranslations('admin.developers');

  return (
    <div id="api-keys" className="card relative">
      <h3 className="section-heading mb-4">
        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
        <span className="material-symbols-outlined">key</span>
        {tDev('apiKeys')}
      </h3>
      <InlineSettingsTable
        data={apiKeys || []}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
        rowKey={(r: any) => r.apiKeyId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
        onSave={async (row: any, isNew: boolean) => {
          if (isNew) {
            await createApiKey(row.name, row.role);
          }
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
        onDelete={async (row: any) => {
          await revokeApiKey(row.apiKeyId);
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
        onAdd={() => ({ name: '', role: 'agent', prefix: 'Will be generated...', createdOn: new Date().toISOString() } as any)}
        canEdit={() => false}
        canDelete={() => true}
        addLabel={tDev('createKey')}
        emptyLabel={tDev('noApiKeysFound')}
        columns={[
          {
            key: 'name',
            title: tCommon('name'),
            type: 'text',
            validate: (v) => (v ? null : 'Required'),
          },
          {
            key: 'role',
            title: 'Role',
            type: 'select',
            options: [
              { value: 'agent', label: tDev('roleAgent') },
              { value: 'viewer', label: tDev('roleViewer') },
              { value: 'admin', label: tDev('roleAdmin') },
              ...roles
                .filter((r) => !['agent', 'viewer', 'admin'].includes(r.role))
                .map((r) => ({ value: r.role, label: r.role })),
            ],
          },
          {
            key: 'prefix',
            title: tCommon('prefix'),
            type: 'text',
            disabled: true,
          },
          {
            key: 'createdOn',
            title: tCommon('created'),
            type: 'custom',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- InlineSettingsTable uses generic any rows to support mixed entity types
            render: (row: any) => <span>{formatLocalDate(row.createdOn)}</span>,
          },
        ]}
      />
    </div>
  );
}
