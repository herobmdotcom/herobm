'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';

export interface FinancialExportMenuProps {
  onExportCsv: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
  label?: string;
}

export function FinancialExportMenu({
  onExportCsv,
  onExportExcel,
  disabled = false,
  className = '',
  align = 'right',
  label,
}: FinancialExportMenuProps) {
  const tGrid = useTranslations('common.grid');
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayLabel = label || `${tGrid('export')}...`;

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleExportCsv = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      setIsExporting(true);
      await onExportCsv();
    } finally {
      setIsExporting(false);
    }
  }, [onExportCsv]);

  const handleExportExcel = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      setIsExporting(true);
      await onExportExcel();
    } finally {
      setIsExporting(false);
    }
  }, [onExportExcel]);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || isExporting}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`whitespace-nowrap !py-1.5 !text-xs cursor-pointer transition-colors shadow-none ${
          isOpen ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)] border-[var(--accent)]' : ''
        } ${className}`}
        title={displayLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
      </Button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 z-50 min-w-[160px] shadow-2xl flex flex-col gap-0.5 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
          role="menu"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon="description"
            iconClassName="text-[var(--text-muted)] text-[12px]"
            onClick={handleExportCsv}
            disabled={disabled || isExporting}
            className="w-full justify-start font-normal text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] px-2.5 py-1.5 h-auto rounded-md shadow-none border-0"
            role="menuitem"
          >
            <span>{tGrid('exportCsv')}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon="table_view"
            iconClassName="text-[var(--text-muted)] text-[12px]"
            onClick={handleExportExcel}
            disabled={disabled || isExporting}
            className="w-full justify-start font-normal text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] px-2.5 py-1.5 h-auto rounded-md shadow-none border-0"
            role="menuitem"
          >
            <span>{tGrid('exportExcel')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default FinancialExportMenu;
