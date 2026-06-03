'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ReportConfigForm from '../ReportConfigForm';

export default function NewReportConfigPage() {
  useDocumentTitle('New Configuration | Business Reports');

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <ReportConfigForm />
    </div>
  );
}
