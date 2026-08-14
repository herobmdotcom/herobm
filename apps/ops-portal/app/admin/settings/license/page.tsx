
'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLicense } from '@/components/LicenseProvider';
import { licenseControllerApplyLicense, LicenseStatusDtoState, LicenseStatusDtoType } from '@herobm/sdk';
import toast from 'react-hot-toast';
import { formatLocalDate } from '@/lib/date';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { Button } from '@/components/shared/Button';
import PageNav from '@/components/shared/PageNav';
import EntityBanner from '@/components/shared/EntityBanner';
import { useRouter } from 'next/navigation';

export default function LicensePage() {
  const tPortal = useTranslations('portal');
  useDocumentTitle('License Management');
  const { status, isLoading, reloadStatus } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations(); 
  const router = useRouter();

  const handleApply = async () => {
    if (!licenseKey.trim()) return;
    setIsSubmitting(true);
    try {
      await licenseControllerApplyLicense({ licenseKey });
      toast.success('License applied successfully');
      await reloadStatus();
      setLicenseKey('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply license');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const navSections = [
    { id: 'system-details', label: 'System Details', show: true },
    { id: 'apply-license', label: 'Apply License', show: true },
  ];

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="License Management"
        subtitle="View system details and apply license keys"
      >
        <PageNav sections={navSections} />
      </ContentPageHeader>
      <div className="flex flex-col gap-6">
        <div id="system-details" className="card">
          <h3 className="section-heading mb-4">
            {tPortal('systemDetails')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tPortal('systemId')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="input font-mono text-sm flex-1"
                    value={status?.systemId || 'N/A'}
                    disabled
                  />
                  <Button 
                    variant="secondary"
                    className="h-10 px-3"
                    onClick={() => {
                      if (status?.systemId) {
                        navigator.clipboard.writeText(status.systemId);
                        toast.success('Copied to clipboard');
                      }
                    }}
                    title="Copy to clipboard"
                  >
        
                    { }
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tPortal('status')}
                  </label>
                  <div className="flex items-center h-10 text-sm gap-2">
                    {/* Replace raw strings with imported enums */}
                    {status?.state === LicenseStatusDtoState.read_only && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">{tPortal('readOnly')}</span>
                    )}
                    {status?.state !== LicenseStatusDtoState.read_only && status?.type === LicenseStatusDtoType.perpetual && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">{tPortal('licensed')}</span>
                    )}
                    {status?.state === LicenseStatusDtoState.active && status?.type !== LicenseStatusDtoType.perpetual && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">{tPortal('trial')}</span>
                    )}
                    {status?.state === LicenseStatusDtoState.warning && status?.type !== LicenseStatusDtoType.perpetual && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">{tPortal('trialExpiring')}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tPortal('licenseType')}
                  </label>
                  <div className="text-sm font-semibold mt-1 bg-[var(--bg-primary)] px-3 py-2 rounded-lg border border-[var(--border-color)]">
                    {status?.type || tPortal('notAvailable')}
                  </div>
                </div>
              </div>

              {status?.expiresAt && (
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {status.type === LicenseStatusDtoType.none ? tPortal('gracePeriodEnds') : tPortal('expiresAt')}
                  </label>
                  <div className="flex items-center h-10 text-sm">
                    {formatLocalDate(status.expiresAt)}
                  </div>
                </div>
              )}

              {status?.warningMessage && (
                <EntityBanner
                  type="error"
                  title="License Warning"
                  description={status.warningMessage}
                />
              )}
            </div>
          </div>
        </div>

        <div id="apply-license" className="card">
          <h3 className="section-heading mb-4">
            {tPortal('applyNewLicense')}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {tPortal('pasteLicenseKey', { systemId: status?.systemId || '' })}
          </p>
          
          <textarea
            className="w-full h-32 p-3 font-mono text-sm border border-[rgba(196,198,205,0.4)] rounded focus:ring-2 focus:ring-primary-500 outline-none mb-4"
            placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
          />
          
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={!licenseKey.trim() || isSubmitting}
              className="disabled:opacity-50"
            >
              {isSubmitting ? tPortal('applying') : tPortal('applyNewLicense')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
