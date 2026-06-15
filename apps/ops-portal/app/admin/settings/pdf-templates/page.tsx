'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';

export default function ReportingPage() {
  const t = useTranslations('admin.reporting');
  useDocumentTitle(t('title'));
  const router = useRouter();

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: t('grid.columns.templateName'), flex: 1, minWidth: 200 },
    { field: 'slug', headerName: t('grid.columns.systemToken'), width: 200 },
    { field: 'description', headerName: t('grid.columns.description'), flex: 2, minWidth: 250 },
    { field: 'outputNamePattern', headerName: t('grid.columns.outputFilename'), width: 220 },
    {
      field: 'lastModifiedOn',
      headerName: t('grid.columns.lastModified'),
      width: 150,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
    {
      field: 'createdOn',
      headerName: t('grid.columns.createdOn'),
      width: 150,
      hide: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    },
  ], []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRowClicked = useCallback((row: any) => {
    router.push(`/admin/settings/pdf-templates/${row.id}`);
  }, [router]);

  return (
    <>
      <>
            <DataGrid
              endpoint="/api/pdf-templates"
              columns={columns}
              gridKey="admin-reports"
              searchPlaceholder={t('grid.searchPlaceholder')}
              exportFileName="reports"
              fetchAll
              rowIdField="id"
              onRowClicked={handleRowClicked}
              pageTitle={t('title')}
              headerActions={
                <Link href="/admin/settings/pdf-templates/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 ml-2 lg:ml-0 whitespace-nowrap">
                  {t('grid.createButton')}
                </Link>
              }
            />
      </>
    </>
  );
}
