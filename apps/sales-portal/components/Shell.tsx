'use client';

import Sidebar from '@/components/Sidebar';

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="ml-60 flex-1 flex flex-col p-8 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
