'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import { SettingsProvider } from '@/components/SettingsProvider';
import { UserSettingsProvider } from '@/components/UserSettingsProvider';
import { LicenseProvider } from '@/components/LicenseProvider';
import LicenseBanner from '@/components/LicenseBanner';
import { Button } from '@/components/shared/Button';

import { HelpProvider } from '@/components/help/HelpContext';
import { HelpDrawer } from '@/components/help/HelpDrawer';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation (path changes)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <AuthGate>
      <UserSettingsProvider>
        <SettingsProvider>
          <LicenseProvider>
            <HelpProvider>
              <div className="flex flex-col h-[100dvh] overflow-hidden relative">
                <LicenseBanner />
                <div className="flex flex-1 overflow-hidden relative">
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

                  {/* Help Slide-Over Drawer */}
                  <HelpDrawer />

                  {/* Floating Toggle Button for Mobile/Tablet */}
                  <Button
                    variant="primary"
                    className="fixed bottom-6 left-6 z-[9999] lg:hidden w-14 h-14 rounded-full flex items-center justify-center print:hidden shadow-md transition-transform hover:scale-105 cursor-pointer !p-0"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    aria-label="Toggle Navigation"
                  >
                    <span className="material-symbols-outlined text-[28px]">
                      {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
                      {isSidebarOpen ? 'close' : 'menu'}
                    </span>
                  </Button>
                </div>
              </div>
            </HelpProvider>
          </LicenseProvider>
        </SettingsProvider>
      </UserSettingsProvider>
    </AuthGate>
  );
}
