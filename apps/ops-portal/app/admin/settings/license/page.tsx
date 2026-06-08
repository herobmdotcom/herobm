/* eslint-disable i18next/no-literal-string, no-restricted-syntax */
'use client';

import React, { useState } from 'react';
import { useLicense } from '@/components/LicenseProvider';
import { licenseControllerApplyLicense } from '@modbm/sdk';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export default function LicensePage() {
  const { status, isLoading, reloadStatus } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations(); // Using global or common translations if needed, but we'll use raw text here for simplicity.

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">License Management</h1>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
          System Details
        </h2>
        <div className="grid grid-cols-[150px_1fr] gap-4">
          <div className="text-slate-500 font-medium">System ID:</div>
          <div className="font-mono text-sm bg-slate-50 dark:bg-slate-950 p-2 rounded flex items-center justify-between">
            {status?.systemId || 'N/A'}
            <button 
              className="text-primary-600 hover:text-primary-700"
              onClick={() => {
                if (status?.systemId) {
                  navigator.clipboard.writeText(status.systemId);
                  toast.success('Copied to clipboard');
                }
              }}
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>
          
          <div className="text-slate-500 font-medium">Status:</div>
          <div>
            {status?.state === 'active' && <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">Active</span>}
            {status?.state === 'warning' && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 rounded-full text-xs font-bold uppercase tracking-wider">Warning</span>}
            {status?.state === 'read_only' && <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">Read Only</span>}
          </div>

          <div className="text-slate-500 font-medium">License Type:</div>
          <div className="capitalize">{status?.type || 'None'}</div>

          {status?.expiresAt && (
            <>
              <div className="text-slate-500 font-medium">Expires At:</div>
              <div>{new Date(status.expiresAt).toLocaleDateString()}</div>
            </>
          )}

          {status?.warningMessage && (
            <div className="col-span-2 mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-900/50">
              {status.warningMessage}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
          Apply New License
        </h2>
        <p className="text-sm text-slate-500">
          Paste your new license key below. Make sure it was issued for your exact System ID ({status?.systemId}).
        </p>
        
        <textarea
          className="w-full h-32 p-3 font-mono text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 rounded focus:ring-2 focus:ring-primary-500 outline-none"
          placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
        />
        
        <div className="flex justify-end">
          <button
            onClick={handleApply}
            disabled={!licenseKey.trim() || isSubmitting}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Applying...' : 'Apply License'}
          </button>
        </div>
      </div>
    </div>
  );
}
