'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';

export default function BusinessReportsConfigPage() {
  useDocumentTitle('Configuration');
  const router = useRouter();
  const t = useTranslations('admin.reporting');

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Report Name', flex: 1, minWidth: 200 },
    { field: 'slug', headerName: 'System Token', width: 200 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 250 },
    { field: 'dataSourceHook', headerName: 'Data Source', width: 220 },
    {
      field: 'isSystem',
      headerName: 'System Core',
      width: 150,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (p: any) => p.value ? 'Yes' : 'No',
    }
  ], []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRowClicked = useCallback((row: any) => {
    router.push(`/reporting/config/${row.id}`);
  }, [router]);

  return (
    <>
      <DataGrid
        endpoint="/api/business-reports"
        columns={columns}
        gridKey="admin-business-reports"
        searchPlaceholder="Search reports..."
        exportFileName="business-reports-config"
        fetchAll
        rowIdField="id"
        onRowClicked={handleRowClicked}
        pageTitle="Configuration"
        headerActions={
          <Link href="/reporting/config/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 ml-2 lg:ml-0 whitespace-nowrap">
            {t('grid.createButton')}
          </Link>
        }
      />
    </>
  );
}
