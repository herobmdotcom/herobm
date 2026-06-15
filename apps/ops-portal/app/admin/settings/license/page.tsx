/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';

import React, { useState } from 'react';
import { useLicense } from '@/components/LicenseProvider';
import { licenseControllerApplyLicense } from '@herobm/sdk';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { useRouter } from 'next/navigation';

export default function LicensePage() {
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
    <DetailsLayout
      header={
        <EntityHeader
          title="License Management"
          subtitle="View system details and apply license keys"
          onBack={() => router.push('/admin/settings/system')}
          actions={<PageNav sections={navSections} />}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div id="system-details" className="card">
          <h3 className="section-heading mb-4">

            <span className="material-symbols-outlined">info</span>
            System Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  System ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="input font-mono text-sm bg-slate-50 dark:bg-slate-950 flex-1"
                    value={status?.systemId || 'N/A'}
                    disabled
                  />
                  <button 
                    className="btn btn-secondary h-10 px-3"
                    onClick={() => {
                      if (status?.systemId) {
                        navigator.clipboard.writeText(status.systemId);
                        toast.success('Copied to clipboard');
                      }
                    }}
                    title="Copy to clipboard"
                  >
        
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Status
                  </label>
                  <div className="flex items-center h-10 text-sm gap-2">
                    {status?.state === 'read_only' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">Read-Only</span>
                    )}
                    {status?.state !== 'read_only' && status?.type === 'perpetual' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">Licensed</span>
                    )}
                    {status?.state === 'active' && status?.type !== 'perpetual' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">Trial</span>
                    )}
                    {status?.state === 'warning' && status?.type !== 'perpetual' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">Trial Expiring</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    License Type
                  </label>
                  <div className="flex items-center h-10 capitalize font-medium text-sm">
                    {status?.type || 'None'}
                  </div>
                </div>
              </div>

              {status?.expiresAt && (
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {status.type === 'none' ? 'Grace Period Ends' : 'Expires At'}
                  </label>
                  <div className="flex items-center h-10 text-sm">
                    {new Date(status.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              )}

              {status?.warningMessage && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-900/50">
                  {status.warningMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        <div id="apply-license" className="card">
          <h3 className="section-heading mb-4">

            <span className="material-symbols-outlined">vpn_key</span>
            Apply New License
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Paste your new license key below. Make sure it was issued for your exact System ID ({status?.systemId}).
          </p>
          
          <textarea
            className="w-full h-32 p-3 font-mono text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded focus:ring-2 focus:ring-primary-500 outline-none mb-4"
            placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
          />
          
          <div className="flex justify-end">
            <button
              onClick={handleApply}
              disabled={!licenseKey.trim() || isSubmitting}
              className="btn btn-primary disabled:opacity-50"
            >
              {isSubmitting ? 'Applying...' : 'Apply License'}
            </button>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
