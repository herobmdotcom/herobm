'use client';

import { useCallback, useMemo, useState } from 'react';
import DataGrid from '@/components/shared/DataGrid';
import { Button } from '@/components/shared/Button';
import type { ColDef } from 'ag-grid-community';
import { ContactSlideOver } from '@/components/shared/ContactSlideOver';
import type { ContactResponseDto } from '@herobm/sdk';

export default function ContactsContent() {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactResponseDto | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      valueFormatter: (p: { value?: string | number | Date }) => p.value ? new Date(p.value).toLocaleDateString() : '—',
    }
  ], []);

  const handleRowClicked = useCallback((row: ContactResponseDto) => {
    setSelectedContact(row);
    setSlideOverOpen(true);
  }, []);

  const handleCreateContact = useCallback(() => {
    setSelectedContact(undefined);
    setSlideOverOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setSlideOverOpen(false);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <>
      <DataGrid
        endpoint="/api/contacts"
        columns={columns}
        gridKey="crm-contacts"
        searchPlaceholder="Search contacts..."
        exportFileName="contacts"
        rowIdField="contactId"
        onRowClicked={handleRowClicked}
        pageTitle="Contacts"
        refreshTrigger={refreshTrigger}
        headerActions={
          <Button variant="primary" onClick={handleCreateContact}>
            Create Contact
          </Button>
        }
      />
      <ContactSlideOver
        isOpen={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        onSaved={handleSaved}
        contactId={selectedContact?.contactId}
        existingData={selectedContact}
      />
    </>
  );
}
