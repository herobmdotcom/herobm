'use client';

/**
 * Local DataGrid wrapper that injects the ops-portal API client.
 * Pages import this instead of the raw shared component.
 */
import SharedDataGrid from '@/components/shared/DataGrid';
import type { DataGridProps } from '@/components/shared/DataGrid';
import { apiFetch, reportError } from '@/lib/api';

type LocalProps<T> = Omit<DataGridProps<T>, 'apiFetch' | 'onError'>;

export default function DataGrid<T>(props: LocalProps<T>) {
  return <SharedDataGrid<T> {...props} apiFetch={apiFetch} onError={reportError} />;
}
