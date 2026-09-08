'use client';

import React from 'react';
import PrintButton from './PrintButton';

export type DetailsLayoutMaxWidth =
  | 'full'
  | '7xl'
  | '6xl'
  | '5xl'
  | '4xl'
  | '1600'
  | string;

export type DetailsLayoutAlign = 'left' | 'center';

export interface DetailsLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  /** Show the print button at the bottom of the details page — defaults to true */
  showPrint?: boolean;
  /** Maximum width constraint for content and header. Defaults to 'full'. */
  maxWidth?: DetailsLayoutMaxWidth;
  /** Horizontal alignment when maxWidth is constrained ('left' | 'center'). Defaults to 'left'. */
  align?: DetailsLayoutAlign;
}

const MAX_WIDTH_MAP: Record<string, string> = {
  full: 'w-full',
  '7xl': 'max-w-7xl w-full',
  '6xl': 'max-w-6xl w-full',
  '5xl': 'max-w-5xl w-full',
  '4xl': 'max-w-4xl w-full',
  '1600': 'max-w-[1600px] w-full',
};

export default function DetailsLayout({
  header,
  children,
  footerActions,
  showPrint = true,
  maxWidth = 'full',
  align = 'left',
}: DetailsLayoutProps) {
  const widthClass = MAX_WIDTH_MAP[maxWidth] || maxWidth;
  const alignClass = align === 'center' ? 'mx-auto' : '';
  const containerClass = `${widthClass} ${alignClass}`.trim();

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 lg:px-6 py-4 lg:py-6 shrink-0 border-b border-[var(--border)] bg-[var(--bg-primary)]">
        <div className={containerClass}>
          {header}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] detail-content flex flex-col min-h-0">
        <div className={`px-4 lg:px-6 pt-4 flex flex-col flex-1 min-h-full min-h-[500px] relative ${containerClass}`}>
          {children}
          {(footerActions || showPrint) && (
            <div className="flex items-center justify-between mt-6 mb-4 pt-4 border-t border-[var(--border)]">
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
