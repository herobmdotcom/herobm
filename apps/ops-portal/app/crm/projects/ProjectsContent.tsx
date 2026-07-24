'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/shared/DataGrid';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';

export default function ProjectsContent() {
  const router = useRouter();

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Name' },
    { field: 'status', headerName: 'Status', width: 150 },
    { field: 'type', headerName: 'Type', width: 150 },
    {
      field: 'createdOn',
      headerName: 'Created',
      width: 150,
      valueFormatter: (p: { value?: string | number | Date }) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    }
  ], []);

  const handleRowClicked = useCallback((row: { projectId: string }) => {
    router.push(`/crm/projects/${row.projectId}`);
  }, [router]);

  return (
    <DataGrid
      endpoint="/api/projects"
      columns={columns}
      gridKey="crm-projects"
      searchPlaceholder="Search projects..."
      exportFileName="projects"
      rowIdField="projectId"
      onRowClicked={handleRowClicked}
      pageTitle="Projects"
      headerActions={
        <Button asChild variant="primary">
          <Link href="/crm/projects/new">
            Create Project
          </Link>
        </Button>
      }
    />
  );
}
