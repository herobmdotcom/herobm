'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import * as api from '@herobm/sdk';
import { useLicense } from '@/components/LicenseProvider';
import React from 'react';

export default function VersionPage() {
  const t = useTranslations('admin.version');
  useDocumentTitle(t('title'));
  const { status, isLoading: licenseLoading } = useLicense();
  
  const [backendInfo, setBackendInfo] = useState<api.SystemVersionResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        setLoading(true);
        const res = await api.systemControllerGetSystemVersion();
        setBackendInfo(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load backend version');
      } finally {
        setLoading(false);
      }
    };
    fetchVersion();
  }, []);

  const frontendInfo = {
    appVersion: process.env.APP_VERSION || 'Unknown',
    buildTime: process.env.BUILD_TIME || 'Unknown',
    nodeEnv: process.env.NODE_ENV,
    reactVersion: React.version,
  };

  return (
    <div className="w-full p-6 lg:p-8 flex flex-col">
      <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 flex flex-col">
        <ContentPageHeader
          title={t('title')}
          subtitle={t('subtitle')}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {/* Frontend Card */}
          <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--bg-card)]">
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">{t('labels.frontend')}</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.appVersion')}</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{frontendInfo.appVersion}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.buildTime')}</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{frontendInfo.buildTime}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.environment')}</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{frontendInfo.nodeEnv}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.reactVersion')}</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{frontendInfo.reactVersion}</dd>
              </div>
            </dl>
          </div>

          {/* Backend Card */}
          <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--bg-card)]">
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">{t('labels.backend')}</h3>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : backendInfo ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.apiVersion')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{backendInfo.apiVersion}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.buildTime')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{backendInfo.apiBuildTime}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.nodeVersion')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{backendInfo.nodeVersion}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.osPlatform')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{backendInfo.osPlatform}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.osRelease')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{backendInfo.osRelease}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Unavailable</p>
            )}
          </div>

          {/* Platform/License Card */}
          <div className="border border-[var(--border)] rounded-lg p-6 bg-[var(--bg-card)]">
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">{t('labels.platform')}</h3>
            {licenseLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            ) : status ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.systemId')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)] break-all">{status.systemId || t('fields.na')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--text-muted)]">{t('fields.licenseHash')}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)] break-all">{status.licenseHash || t('fields.unlicensed')}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No license data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
