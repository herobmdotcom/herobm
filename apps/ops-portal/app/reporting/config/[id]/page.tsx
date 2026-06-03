'use client';

import { use, useEffect, useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import ReportConfigForm from '../ReportConfigForm';

export default function EditReportConfigPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  useDocumentTitle('Edit Configuration | Business Reports');
  const params = use(paramsPromise);
  const t = useTranslations('admin.reporting');
  const tCommon = useTranslations('common.auth');

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.businessReportsControllerGetReportById(params.id)
      .then(res => {
        setData(res.data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError((err as Error).message || 'Failed to load configuration');
        reportError(err, 'EditReportConfigPage_load');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id]);

  if (loading) return <div className="p-8 font-bold text-gray-400">{tCommon('loading')}</div>;
  if (error || !data) return <div className="p-8 text-red-500 font-bold">{error || t('errors.notFound')}</div>;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <ReportConfigForm initialData={data} />
    </div>
  );
}
