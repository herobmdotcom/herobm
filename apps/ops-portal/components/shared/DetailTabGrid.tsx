'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import DataGrid from '@/components/DataGrid';
import type { DataGridProps } from '@/components/shared/DataGrid';

export interface DetailTabGridProps<T> extends Omit<DataGridProps<T>, 'renderHeader'> {
  /** Section title rendered in the sub-page header */
  title: string | React.ReactNode;
  /** Optional action buttons or controls rendered on the right side of the header */
  headerActions?: React.ReactNode;
}

export default function DetailTabGrid<T>({
  title,
  headerActions,
  domLayout = 'normal',
  ...dataGridProps
}: DetailTabGridProps<T>) {
  const tCommon = useTranslations('common');

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-[500px] pb-6">
      <div className="flex-1 flex flex-col z-10 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden transition-all h-full min-h-0">
        <DataGrid<T>
          domLayout={domLayout}
          renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-3">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <h2 className="text-[1.2rem] sm:text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] shrink-0">
                  {title}
                </h2>
                <div className="hidden sm:block h-5 w-px bg-[var(--border)] shrink-0 mx-1"></div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shrink-0">
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">
                    {tCommon('grid.rowCountLabel')}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                    {loading ? '...' : rowCount.toLocaleString()}
                  </span>
                </div>
                <div className="w-full sm:w-auto sm:flex-1 sm:ml-4 sm:max-w-md">
                  {searchInput}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 justify-end">
                {optionsButton}
                {headerActions}
              </div>
            </div>
          )}
          {...dataGridProps}
        />
      </div>
    </div>
  );
}
