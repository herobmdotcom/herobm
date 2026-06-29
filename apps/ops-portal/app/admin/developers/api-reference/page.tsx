'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

export default function ApiReferencePage() {
  useDocumentTitle('API Reference');
  const router = useRouter();

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="API Reference"
          subtitle="Interactive API documentation"
          showPrint={false}
        />
      }
    >
      <div className="card p-0 overflow-hidden bg-white min-h-[800px] flex flex-col">
        {/* Render the backend's native Swagger UI directly via iframe, relying on the Next.js /api/* proxy */}
        <iframe 
          src="/api/docs" 
          className="w-full flex-1 border-0"
          title="API Documentation"
        />
      </div>
    </DetailsLayout>
  );
}
