'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import DataGrid from '@/components/shared/DataGrid';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import type { ContactResponseDto } from '@herobm/sdk';

export default function ContactsContent() {
  const columns = useMemo<ColDef[]>(() => [
    { field: 'lastName', headerName: 'Last Name', flex: 1, minWidth: 150 },
    { field: 'firstName', headerName: 'First Name', flex: 1, minWidth: 150 },
    { field: 'jobTitle', headerName: 'Job Title', width: 150 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { field: 'linkedinProfile', headerName: 'LinkedIn', width: 200, hide: true },
    {
      field: 'createdOn',
      headerName: 'Created',
      width: 150,
      valueFormatter: (p: { value?: string | number | Date }) => formatLocalDate(p.value),
    }
  ], []);

  return (
    <DataGrid
      endpoint="/api/contacts"
      columns={columns}
      gridKey="crm-contacts"
      searchPlaceholder="Search contacts..."
      exportFileName="contacts"
      rowIdField="contactId"
      rowHref={(row: ContactResponseDto) => `/crm/contacts/${row.contactId}`}
      pageTitle="Contacts"
      defaultSortModel={[{ colId: 'lastName', sort: 'asc' }]}
      headerActions={
        <Button asChild variant="primary">
          <Link href="/crm/contacts/new">
            Create Contact
          </Link>
        </Button>
      }
    />
  );
}
