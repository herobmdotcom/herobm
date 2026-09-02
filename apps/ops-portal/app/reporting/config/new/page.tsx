'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ReportConfigForm from '../ReportConfigForm';

export default function NewReportConfigPage() {
  useDocumentTitle('New Report Configuration');

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <ReportConfigForm />
    </div>
  );
}
