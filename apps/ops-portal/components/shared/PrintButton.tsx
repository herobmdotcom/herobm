'use client';

import React from 'react';

import { Button } from './Button';

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
    <Button
      id="print-page-btn"
      variant="secondary"
      size="sm"
      className={`print-hidden ${className || ''}`}
      onClick={() => window.print()}
      title={label}
      aria-label={label}
    >
      { }
      <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>print</span>
      {label}
    </Button>
  );
}
