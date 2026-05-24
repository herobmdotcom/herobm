'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation (path changes)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <AuthGate>
      <div className="flex h-[100dvh] overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-[9998] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Container */}
        <div 
          className={`fixed inset-y-0 left-0 z-[9999] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block print:hidden ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar />
        </div>

        <main className="flex-1 flex flex-col overflow-y-auto w-full lg:w-auto">
          {children}
        </main>

        {/* Floating Toggle Button for Mobile/Tablet */}
        <button 
          className="fixed bottom-6 left-6 z-[9999] lg:hidden w-14 h-14 rounded-full flex items-center justify-center print:hidden shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 cursor-pointer"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle Navigation"
        >
          <span className="material-symbols-outlined text-[28px]">
            {isSidebarOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>
    </AuthGate>
  );
}
