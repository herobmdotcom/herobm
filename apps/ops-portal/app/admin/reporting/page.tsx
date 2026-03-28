'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

export default function ReportingPage() {
  const router = useRouter();

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Template Name', flex: 1, minWidth: 200 },
    { field: 'slug', headerName: 'System Token', width: 200 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 250 },
    { field: 'outputNamePattern', headerName: 'Output Filename', width: 220 },
    {
      field: 'lastModifiedOn',
      headerName: 'Last Modified',
      width: 150,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
    {
      field: 'createdOn',
      headerName: 'Created On',
      width: 150,
      hide: true,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
  ], []);

  const handleRowClicked = useCallback((row: any) => {
    router.push(`/admin/reporting/${row.id}`);
  }, [router]);

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
            <DataGrid
              endpoint="/api/reports"
              columns={columns}
              gridKey="admin-reports"
              searchPlaceholder="Search Typst templates..."
              exportFileName="reports"
              fetchAll
              rowIdField="id"
              onRowClicked={handleRowClicked}
              renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Reporting Templates
                    </h2>
                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                      <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Total Templates
                      </span>
                      <span className="text-[11px] font-bold text-[#006b5c]">
                        {loading ? '...' : rowCount.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex-1 ml-6 max-w-md">
                      {searchInput}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {optionsButton}
                    <Link href="/admin/reporting/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110">
                      Create Template
                    </Link>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
