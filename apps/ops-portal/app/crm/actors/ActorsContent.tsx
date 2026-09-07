'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DataGrid from '@/components/shared/DataGrid';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import type { ColDef } from 'ag-grid-community';
import * as api from '@herobm/sdk';
import { useAuth } from '@/components/AuthGate';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

export default function ActorsContent() {
  const router = useRouter();
  const { username } = useAuth();
  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('all');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.usersControllerFindAll();
        setUsers(res.data || []);
      } catch (err) {
        reportError(err, 'ActorsContent - loadUsers');
        toast.error('Failed to load users: ' + getErrorMessage(err));
      }
    };
    loadUsers();
  }, []);

  const currentUserId = useMemo(() => {
    if (!username || !users.length) return null;
    const match = users.find((u) => u.username === username);
    return match ? (match as unknown as { userId: string }).userId || match.userId : null;
  }, [username, users]);

  const endpoint = useMemo(() => {
    if (selectedOwner === 'all') {
      return '/api/actors';
    }
    if (selectedOwner === 'my') {
      return currentUserId ? `/api/actors?ownerId=${encodeURIComponent(currentUserId)}` : '/api/actors';
    }
    return `/api/actors?ownerId=${encodeURIComponent(selectedOwner)}`;
  }, [selectedOwner, currentUserId]);

  const columns = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    {
      field: 'ownerDisplayName',
      headerName: 'Owner',
      width: 160,
      valueGetter: (p: { data?: { ownerDisplayName?: string; owner?: { displayName?: string; username?: string } } }) =>
        p.data?.ownerDisplayName || p.data?.owner?.displayName || p.data?.owner?.username || '—',
    },
    { 
      field: 'tags', 
      headerName: 'Tags', 
      width: 180,
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
      valueFormatter: (p: { value?: string | number | Date }) => formatLocalDate(p.value),
    }
  ], []);

  return (
    <DataGrid
      endpoint={endpoint}
      columns={columns}
      gridKey="crm-actors"
      searchPlaceholder="Search actors..."
      exportFileName="actors"
      rowIdField="actorId"
      rowHref={(row) => `/crm/actors/${row.actorId}`}
      pageTitle="Actors"
      defaultSortModel={[{ colId: 'name', sort: 'asc' }]}
      headerFilters={
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">
            Owner:
          </label>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="input text-sm min-w-[150px]"
          >
            <option value="all">All Owners</option>
            {currentUserId && <option value="my">My Accounts</option>}
            <option value="unassigned">Unassigned</option>
            {users.map((u: api.UserResponseDto) => {
              const uId = (u as unknown as { userId: string }).userId || u.userId;
              return (
                <option key={uId} value={uId}>
                  {u.displayName || u.username}
                </option>
              );
            })}
          </select>
        </div>
      }
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
