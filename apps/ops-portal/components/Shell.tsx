'use client';

import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import { usePathname } from 'next/navigation';

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSetupRoute = pathname?.startsWith('/setup');

  if (isSetupRoute) {
    return (
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <main className="flex-1 flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        <div className="print:hidden">
          <Sidebar />
        </div>
        <main className="ml-60 flex-1 flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
