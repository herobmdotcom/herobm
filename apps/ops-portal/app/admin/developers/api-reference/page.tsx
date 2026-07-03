'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRouter } from 'next/navigation';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';

export default function ApiReferencePage() {
  useDocumentTitle('API Reference');
  const router = useRouter();

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title="API Reference"
        subtitle="Interactive API documentation"
      />
      <div className="card p-0 overflow-hidden bg-white min-h-[800px] flex flex-col">
        {/* Render the backend's native Swagger UI directly via iframe, relying on the Next.js /api/* proxy */}
        <iframe 
          src="/api/docs" 
          className="w-full flex-1 border-0"
          title="API Documentation"
        />
      </div>
    </div>
  );
}
