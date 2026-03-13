'use client';

/**
 * Local DataGrid wrapper that injects the sales-portal API client.
 * Pages import this instead of the raw shared component.
 */
import { DataGrid as SharedDataGrid, type DataGridProps } from '@modbm/portal-ui';
import { apiFetch, reportError } from '@/lib/api';

type LocalProps<T> = Omit<DataGridProps<T>, 'apiFetch' | 'onError'>;

export default function DataGrid<T>(props: LocalProps<T>) {
  return <SharedDataGrid<T> {...props} apiFetch={apiFetch} onError={reportError} />;
}
