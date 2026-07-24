'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/shared/DataGrid';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';

export default function ActorsContent() {
  const router = useRouter();

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { 
      field: 'tags', 
      headerName: 'Tags', 
      width: 200,
      valueFormatter: (p: { value?: string[] }) => p.value ? p.value.join(', ') : ''
    },
    { field: 'industry', headerName: 'Industry', width: 150 },
    { field: 'legalStatus', headerName: 'Legal Status', width: 150 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'telephone', headerName: 'Telephone', width: 150 },
    { field: 'businessNumber', headerName: 'Business No', width: 150, hide: true },
    { field: 'website', headerName: 'Website', width: 200, hide: true },
    { field: 'isTaxRegistered', headerName: 'Tax Reg', width: 100 },
    {
      field: 'createdOn',
      headerName: 'Created',
      width: 110,
      hide: true,
      valueFormatter: (p: { value?: string | number | Date }) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    }
  ], []);

  const handleRowClicked = useCallback((row: { actorId: string }) => {
    router.push(`/crm/actors/${row.actorId}`);
  }, [router]);

  return (
    <DataGrid
      endpoint="/api/actors"
      columns={columns}
      gridKey="crm-actors"
      searchPlaceholder="Search actors..."
      exportFileName="actors"
      rowIdField="actorId"
      onRowClicked={handleRowClicked}
      pageTitle="Actors"
      headerActions={
        <Button asChild variant="primary">
          <Link href="/crm/actors/new">
            Create Actor
          </Link>
        </Button>
      }
    />
  );
}
