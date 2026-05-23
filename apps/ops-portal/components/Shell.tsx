'use client';

import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
export default function Shell({ children }: { children: React.ReactNode }) {
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
