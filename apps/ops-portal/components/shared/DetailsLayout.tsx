'use client';

import React from 'react';
import PrintButton from './PrintButton';

export interface DetailsLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  /** Show the print button at the bottom of the details page — defaults to true */
  showPrint?: boolean;
}

export default function DetailsLayout({
  header,
  children,
  footerActions,
  showPrint = true,
}: DetailsLayoutProps) {
  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 lg:px-6 py-4 lg:py-6 shrink-0 border-b border-[rgba(196,198,205,0.2)] bg-white">
        <div className="w-full">
          {header}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white detail-content flex flex-col min-h-0">
        <div className="w-full px-4 lg:px-6 pt-4 flex flex-col flex-1 h-full min-h-[500px] relative">
          {children}
          {(footerActions || showPrint) && (
            <div className="flex items-center justify-between mt-6 mb-4 pt-4 border-t border-[rgba(196,198,205,0.2)]">
              <div>
                {showPrint && <PrintButton />}
              </div>
              {footerActions && (
                <div className="flex items-center gap-2">
                  {footerActions}
                </div>
              )}
            </div>
          )}
          {/* Spacer to ensure scroll clearance at the bottom of the details page */}
          <div className="shrink-0 h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
