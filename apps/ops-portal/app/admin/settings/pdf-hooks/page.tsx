'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportingHooksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings/pdf-templates?tab=hooks');
  }, [router]);

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] flex items-center justify-center p-8">
      <div className="text-[var(--text-muted)] text-sm">Redirecting to PDF Templates & Hooks...</div>
    </div>
  );
}
