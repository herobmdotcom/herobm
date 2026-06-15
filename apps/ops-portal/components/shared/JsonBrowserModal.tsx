'use client';

import React, { useEffect, useState } from 'react';
import SlideOver from './SlideOver';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface JsonBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  hookSlug: string;
  type: 'record' | 'report';
}

export default function JsonBrowserModal({ isOpen, onClose, hookSlug, type }: JsonBrowserModalProps) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  // Default to English if translations aren't available for this specific shared component yet
  const t = useTranslations('admin.reporting.form');

  useEffect(() => {
    if (isOpen && hookSlug) {
      setLoading(true);
      const fetchPromise = type === 'record' 
        ? api.dataSourcesControllerGetSampleRecord(hookSlug)
        : api.dataSourcesControllerGetSampleReport(hookSlug);

      fetchPromise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) => {
          setData(res.data?.data || res.data || res);
          setIsMockData(res.data?.isMockData === true || res.isMockData === true);
        })
        .catch(err => {
          reportError(err, 'JsonBrowserModal.fetch');
          setData({ error: "Failed to fetch data structure" });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, hookSlug, type]);

  return (
    <SlideOver 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Data Structure: ${hookSlug}`}
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-4 h-full">
        {isMockData && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md flex items-start gap-3">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
            <div>
              <h4 className="text-sm font-bold text-amber-800">{t('jsonBrowser.sampleData')}</h4>
              <p className="text-xs text-amber-700 mt-1">
                {t('jsonBrowser.sampleDataDesc')}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 bg-[#282c34] text-[#abb2bf] rounded-lg p-4 font-mono text-xs overflow-auto shadow-inner border border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined animate-spin mr-2">autorenew</span>
              Loading...
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
