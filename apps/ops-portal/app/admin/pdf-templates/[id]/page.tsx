'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { use, useEffect, useState } from 'react';
import TemplateForm from '../TemplateForm';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';

import { useTranslations } from 'next-intl';

export default function EditTemplatePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('admin.reporting');
  useDocumentTitle(t('title'));
  const params = use(paramsPromise);
  const [initialData, setInitialData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.pdfTemplatesControllerGetReport(params.id)
      .then(res => {
        setInitialData(res.data);
      })
      .catch((e) => {
        reportError(e, 'EditTemplatePage');
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <><div className="p-8 font-bold text-gray-400">{t('errors.loading')}</div></>;
  
  if (error || !initialData) {
    return (
      <>
        <div className="p-8 text-red-500 font-bold">{t('errors.notFound')}</div>
      </>
    );
  }

  return (
    <>
      <div className="h-full p-4 lg:p-6 overflow-hidden">
        <TemplateForm initialData={initialData} />
      </div>
    </>
  );
}
