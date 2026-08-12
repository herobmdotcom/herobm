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
      <div className="flex-1 flex flex-col z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all h-full min-h-0">
        <DataGrid<T>
          domLayout={domLayout}
          renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-3">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <h2 className="text-[1.2rem] sm:text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {title}
                </h2>
                <div className="hidden sm:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-1"></div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                  <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {tCommon('grid.rowCountLabel')}
                  </span>
                  <span className="text-[11px] font-bold text-[#006b5c]">
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
