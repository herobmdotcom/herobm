'use client';

import React from 'react';

export default function DetailsLayout({ header, children }: { header: React.ReactNode, children: React.ReactNode }) {
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
          {/* Spacer to ensure scroll clearance at the bottom of the details page */}
          <div className="shrink-0 h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
