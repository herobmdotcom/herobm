'use client';

import { use, useEffect, useState } from 'react';
import TemplateForm from '../TemplateForm';
import { apiFetch } from '@/lib/api';

export default function EditTemplatePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<{ data: any }>(`/api/reports/${params.id}`)
      .then(res => setInitialData(res.data))
      .catch((e) => {
        console.error(e);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <><div className="p-8 font-bold text-gray-400">Loading template data...</div></>;
  
  if (error || !initialData) {
    return (
      <>
        <div className="p-8 text-red-500 font-bold">Error: Template not found or unauthorized access logging in.</div>
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
