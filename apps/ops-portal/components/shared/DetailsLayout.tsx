'use client';

import React from 'react';

export default function DetailsLayout({ header, children }: { header: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 shrink-0 pb-6 border-b border-[rgba(196,198,205,0.2)] bg-white">
        <div className="w-full">
          {header}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pt-6 pb-12 bg-white detail-content">
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
