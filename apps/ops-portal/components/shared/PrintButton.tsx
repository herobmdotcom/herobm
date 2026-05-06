'use client';

import React from 'react';

export interface PrintButtonProps {
  /** Optional custom title for the print tooltip */
  title?: string;
  className?: string;
}

/**
 * A shared print button that triggers the browser's native print dialog.
 * Uses @media print CSS rules defined in globals.css to produce clean output
 * by hiding the sidebar, header chrome, buttons, and navigation.
 *
 * The browser print dialog also supports "Save as PDF" on all platforms.
 */
export default function PrintButton({ title, className }: PrintButtonProps) {
  const label = title || 'Print';

  return (
    <button
      id="print-page-btn"
      className={`btn btn-secondary btn-sm print-hidden ${className || ''}`}
      onClick={() => window.print()}
      title={label}
      aria-label={label}
    >
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>print</span>
    </button>
  );
}

