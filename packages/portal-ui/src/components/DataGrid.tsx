'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type ColDefField, type GridReadyEvent, type FirstDataRenderedEvent, type RowClickedEvent } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface DataGridProps<T> {
  /** API endpoint to fetch data from (appended with ?page=&limit=&search= params) */
  endpoint: string;
  /** AG Grid column definitions */
  columns: ColDef<T>[];
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** File name prefix for CSV export (default: "export") */
  exportFileName?: string;
  /** Authenticated fetch function — must accept a URL and return parsed JSON with a `data` array */
  apiFetch: <R = unknown>(path: string) => Promise<R>;
  /** Error reporter — called when data fetching fails */
  onError?: (err: unknown, component: string) => void;
  /** Optional callback when a row is clicked */
  onRowClicked?: (data: T) => void;
}

/** Format numbers: integers stay as integers, decimals get 2 places */
function numericFormatter(params: { value: unknown }) {
  if (params.value == null) return '';
  const n = Number(params.value);
  if (isNaN(n)) return String(params.value);
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DataGrid<T>({ endpoint, columns, searchPlaceholder, exportFileName, apiFetch, onError, onRowClicked }: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 200;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);

    apiFetch<{ data: T[] }>(`${endpoint}?${params}`)
      .then((res) => setData(res.data))
      .catch((err) => onError?.(err, 'DataGrid'))
      .finally(() => setLoading(false));
  }, [endpoint, search, page, apiFetch, onError]);

  /** Enhance columns: add header tooltips, cell tooltips, and numeric parsing */
  const enhancedColumns = useMemo(() =>
    columns.map((col) => {
      const isNumeric = col.type === 'numericColumn';
      const base: ColDef<T> = {
        ...col,
        headerTooltip: col.headerTooltip ?? col.headerName ?? (col.field as string) ?? undefined,
        // Cell tooltips for text columns — show full value on hover
        ...((!isNumeric && col.field && !col.tooltipField) ? { tooltipField: col.field as ColDefField<T> } : {}),
      };
      if (!isNumeric || !col.field) return base;
      const field = col.field;
      return {
        ...base,
        // Only add default valueGetter/valueFormatter if the column doesn't already have custom ones
        ...(col.valueGetter ? {} : {
          valueGetter: (params: { data?: Record<string, unknown> }) => {
            const v = params.data?.[field];
            if (v == null || v === '') return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
          },
        }),
        ...(col.valueFormatter ? {} : { valueFormatter: numericFormatter }),
        filter: 'agNumberColumnFilter',
      } as ColDef<T>;
    }), [columns]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  }), []);

  /** Auto-size columns to fit content after data loads */
  const onGridReady = useCallback((event: GridReadyEvent) => {
    event.api.autoSizeAllColumns();
  }, []);

  /** Also auto-size when new data arrives */
  const onFirstDataRendered = useCallback((event: FirstDataRenderedEvent) => {
    event.api.autoSizeAllColumns();
  }, []);

  /** CSV export handler */
  const handleExport = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `${exportFileName ?? 'export'}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  }, [exportFileName]);

  /** Row click handler */
  const handleRowClicked = useCallback((event: RowClickedEvent<T>) => {
    if (onRowClicked && event.data) {
      onRowClicked(event.data);
    }
  }, [onRowClicked]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3">
        <input
          className="px-3 py-2 rounded-lg text-sm flex-1 max-w-md outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          placeholder={searchPlaceholder ?? 'Search…'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${data.length} rows`}
        </span>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 rounded text-xs cursor-pointer"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          title="Export current data as CSV"
        >⬇ Export CSV</button>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >← Prev</button>
          <span className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={data.length < limit}
            className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >Next →</button>
        </div>
      </div>
      <div className="ag-theme-alpine-dark flex-1 min-h-0">
        <AgGridReact<T>
          ref={gridRef}
          rowData={data}
          columnDefs={enhancedColumns}
          defaultColDef={defaultColDef}
          animateRows
          rowSelection="single"
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onRowClicked={onRowClicked ? handleRowClicked : undefined}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
