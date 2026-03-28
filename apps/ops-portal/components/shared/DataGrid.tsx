"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ColDefField,
  type GridReadyEvent,
  type FirstDataRenderedEvent,
  type RowClickedEvent,
  type StateUpdatedEvent,
  type GridState,
  type ScrollState,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ── localStorage grid-state helpers (columns, sort, filter — NOT scroll) ─ */

export const STORAGE_PREFIX = "datagrid-state-";

/** Save grid state (excluding scroll) to localStorage */
export function saveGridState(gridKey: string, state: GridState): void {
  try {
    // Strip scroll — it lives in sessionStorage separately
    const { scroll: _scroll, ...rest } = state;
    localStorage.setItem(`${STORAGE_PREFIX}${gridKey}`, JSON.stringify(rest));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

/** Load saved grid state from localStorage */
export function loadGridState(gridKey: string): GridState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gridKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GridState;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Clear saved grid state */
export function clearGridState(gridKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gridKey}`);
  } catch {
    /* ignore */
  }
}

/* ── sessionStorage scroll-state helpers (session-only) ──────────── */

export const SCROLL_STORAGE_PREFIX = "datagrid-scroll-";

export function saveScrollState(gridKey: string, scroll: ScrollState): void {
  try {
    sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${gridKey}`, JSON.stringify(scroll));
  } catch {
    /* ignore */
  }
}

export function loadScrollState(gridKey: string): ScrollState | null {
  try {
    const raw = sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${gridKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScrollState;
    return typeof parsed.top === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/* ── Component ────────────────────────────────────────────────────── */

export interface DataGridProps<T> {
  /** API endpoint to fetch data from (appended with ?page=&limit=&search= params) */
  endpoint: string;
  /** AG Grid column definitions */
  columns: ColDef<T>[];
  /** Stable key for persisting column layout to localStorage (e.g. "ops-products") */
  gridKey?: string;
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
  /** When true, fetch the entire dataset in one request (no pagination). AG Grid handles sorting/filtering client-side. */
  fetchAll?: boolean;
  /** Whether to show a toggle to include archived records */
  /** Whether to show a toggle to include archived records */
  showArchivedToggle?: boolean;
  /** If provided, customizes the entire top bar rendering */
  renderHeader?: (props: {
    searchInput: React.ReactNode;
    optionsButton: React.ReactNode;
    rowCount: number;
    loading: boolean;
  }) => React.ReactNode;
  /** Optional theme override for AG grid wrapper. Defaults to ag-theme-alpine-dark */
  gridTheme?: string;
  /** Optional initial search term to seed the quick filter */
  initialSearch?: string;
  /** Property on T to use as a unique row identifier, prevents scrolling jump on data load */
  rowIdField?: keyof T;
}

/** Format numbers: integers stay as integers, decimals get 2 places */
export function numericFormatter(params: { value: unknown }) {
  if (params.value == null) return "";
  const n = Number(params.value);
  if (isNaN(n)) return String(params.value);
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

export default function DataGrid<T>({
  endpoint,
  columns,
  gridKey,
  searchPlaceholder,
  exportFileName,
  apiFetch,
  onError,
  onRowClicked,
  fetchAll,
  showArchivedToggle,
  renderHeader,
  gridTheme = "ag-theme-alpine-dark",
  initialSearch,
  rowIdField,
}: DataGridProps<T>) {
  const tGrid = useTranslations('common.grid');
  const gridRef = useRef<AgGridReact<T>>(null);

  // Merge saved grid state (columns etc. from localStorage) + scroll (from sessionStorage)
  // into a single initialState — read once on mount
  const savedInitialState = useMemo<GridState | undefined>(() => {
    if (!gridKey) return undefined;
    const gridState = loadGridState(gridKey);
    const scroll = loadScrollState(gridKey);
    if (!gridState && !scroll) return undefined;
    return {
      ...(gridState ?? {}),
      ...(scroll ? { scroll } : {}),
      partialColumnState: true, // we may not have all column properties
    };
  }, [gridKey]);

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const limit = fetchAll ? 99999 : 200;

  // Sync initialSearch prop changes (e.g. SPA navigation with new query params)
  const prevInitialSearch = useRef(initialSearch);
  useEffect(() => {
    if (initialSearch !== prevInitialSearch.current) {
      prevInitialSearch.current = initialSearch;
      setSearch(initialSearch ?? "");
    }
  }, [initialSearch]);

  /* ── Column picker dropdown state ────────────────────────────────── */
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [colRevision, setColRevision] = useState(0);
  const colPickerRef = useRef<HTMLDivElement>(null);

  /* Close picker when clicking outside */
  useEffect(() => {
    if (!colPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        colPickerRef.current &&
        !colPickerRef.current.contains(e.target as Node)
      ) {
        setColPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colPickerOpen]);

  /** Toggle a single column's visibility via the grid API */
  const toggleColumnVisible = useCallback((colId: string, visible: boolean) => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.setColumnsVisible([colId], visible);
    setColRevision((r) => r + 1); // force re-render so checkbox reflects new state
    // state will be persisted via onStateUpdated
  }, []);

  /* Debounce timer ref for grid state persistence */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Unified state persistence handler — debounced.
   *  Fired by AG Grid whenever any state changes (columns, sort, scroll, etc.) */
  const onStateUpdated = useCallback(
    (event: StateUpdatedEvent) => {
      if (!gridKey) return;
      // Skip the initial state hydration event
      if (event.sources.includes('gridInitializing')) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveGridState(gridKey, event.state);
      }, 500);
    },
    [gridKey],
  );

  /* Cleanup debounce timer on unmount */
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("q", search);
    if (includeArchived) params.set("includeArchived", "true");

    const separator = endpoint.includes('?') ? '&' : '?';
    apiFetch<{ data: T[] }>(`${endpoint}${separator}${params}`)
      .then((res) => setData(res.data))
      .catch((err) => onError?.(err, "DataGrid"))
      .finally(() => setLoading(false));
  }, [endpoint, search, includeArchived, page, apiFetch, onError]);

  /** Enhance columns: add header tooltips, cell tooltips, and numeric parsing */
  const enhancedColumns = useMemo(
    () =>
      columns.map((col, colIndex) => {
        const isNumeric = col.type === "numericColumn";
        const base: ColDef<T> = {
          ...col,
          headerTooltip:
            col.headerTooltip ??
            col.headerName ??
            (col.field as string) ??
            undefined,
          // Cell tooltips for text columns — show full value on hover
          ...(!isNumeric && col.field && !col.tooltipField
            ? { tooltipField: col.field as ColDefField<T> }
            : {}),
          // First column is always bold for visual anchoring
          ...(colIndex === 0
            ? {
              cellStyle: {
                fontWeight: 600,
                ...(typeof col.cellStyle === "object" &&
                  col.cellStyle !== null
                  ? col.cellStyle
                  : {}),
              },
            }
            : {}),
        };
        if (!isNumeric || !col.field) return base;
        const field = col.field;
        return {
          ...base,
          // Only add default valueGetter/valueFormatter if the column doesn't already have custom ones
          ...(col.valueGetter
            ? {}
            : {
              valueGetter: (params: { data?: Record<string, unknown> }) => {
                const v = params.data?.[field];
                if (v == null || v === "") return null;
                const n = Number(v);
                return isNaN(n) ? null : n;
              },
            }),
          ...(col.valueFormatter ? {} : { valueFormatter: numericFormatter }),
          filter: "agNumberColumnFilter",
        } as ColDef<T>;
      }),
    [columns],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 80,
    }),
    [],
  );

  /** Auto-size columns on grid ready (initialState handles restoration) */
  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      // Only auto-size if there's no saved state — otherwise initialState
      // has already applied the saved column widths/order
      if (!gridKey || !loadGridState(gridKey)) {
        event.api.autoSizeAllColumns();
      }
    },
    [gridKey],
  );

  /** Also auto-size when new data arrives (only if no saved state) */
  const onFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent) => {
      if (gridKey && loadGridState(gridKey)) return; // saved state takes priority
      event.api.autoSizeAllColumns();
    },
    [gridKey],
  );

  /** CSV export handler */
  const handleExport = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `${exportFileName ?? "export"}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  }, [exportFileName]);

  /** Reset columns to default layout */
  const handleResetColumns = useCallback(() => {
    if (gridKey) clearGridState(gridKey);
    gridRef.current?.api?.resetColumnState();
    gridRef.current?.api?.autoSizeAllColumns();
  }, [gridKey]);

  /** Row click handler — snapshot scroll state before navigating away */
  const handleRowClicked = useCallback(
    (event: RowClickedEvent<T>) => {
      if (gridKey && event.api) {
        const state = event.api.getState();
        if (state.scroll) {
          saveScrollState(gridKey, state.scroll);
        }
      }
      if (onRowClicked && event.data) {
        onRowClicked(event.data);
      }
    },
    [onRowClicked, gridKey],
  );

  const searchInputNode = (
    <div className="relative flex items-center w-full">
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] absolute left-3 pointer-events-none">search</span>
      <input
        className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
        placeholder={searchPlaceholder ?? "Search…"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
      />
    </div>
  );

  const optionsButtonNode = (
    <div ref={colPickerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setColPickerOpen((v) => !v)}
        className="px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
        style={{
          background: colPickerOpen ? "var(--bg-card-hover)" : "transparent",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}
        onMouseEnter={(e) => { if (!colPickerOpen) e.currentTarget.style.background = "var(--bg-card-hover)" }}
        onMouseLeave={(e) => { if (!colPickerOpen) e.currentTarget.style.background = "transparent" }}
        title={tGrid('options')}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-[18px]">tune</span>{' '}{tGrid('options')}
      </button>
      {colPickerOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 0",
                zIndex: 50,
                minWidth: 200,
                maxHeight: 400,
                overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              {/* 1. Export Section */}
              <div
                style={{
                  padding: "2px 12px 4px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginTop: 4,
                }}
              >
                {tGrid('export')}
              </div>
              <button
                onClick={() => {
                  handleExport();
                  setColPickerOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-card-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span aria-hidden>⬇</span>{' '}{tGrid('exportCsv')}
              </button>

              {/* 2. Columns Section */}
              {gridKey && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: "var(--border)",
                      margin: "6px 0",
                    }}
                  />
                  <div
                    style={{
                      padding: "2px 12px 4px",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tGrid('columns')}
                  </div>
                  {columns.map((col) => {
                    const colId = (col.field ??
                      col.colId ??
                      col.headerName ??
                      "") as string;
                    if (!colId) return null;
                    const gridCol = gridRef.current?.api?.getColumn(colId);
                    const visible = gridCol ? gridCol.isVisible() : true;
                    return (
                      <label
                        key={colId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 12px",
                          cursor: "pointer",
                          fontSize: 13,
                          color: visible
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        }}
                        onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "var(--bg-card-hover)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(e) =>
                            toggleColumnVisible(colId, e.target.checked)
                          }
                          style={{ accentColor: "var(--accent)" }}
                        />
                        {col.headerName ?? colId}
                      </label>
                    );
                  })}
                  <button
                    onClick={() => {
                      handleResetColumns();
                      setColPickerOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-card-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span aria-hidden>↻</span>{' '}{tGrid('resetColumns')}
                  </button>
                </>
              )}

              {/* 3. Rows Section */}
              {showArchivedToggle && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: "var(--border)",
                      margin: "6px 0",
                    }}
                  />
                  <div
                    style={{
                      padding: "2px 12px 4px",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tGrid('rowCountLabel')}
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text-primary)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-card-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => {
                        setIncludeArchived(e.target.checked);
                        setPage(1);
                      }}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {tGrid('includeArchived')}
                  </label>
                </>
              )}
            </div>
          )}
        </div>
  );

  return (
    <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${renderHeader ? '' : 'gap-4'}`}>
      {renderHeader ? (
        renderHeader({ searchInput: searchInputNode, optionsButton: optionsButtonNode, rowCount: data.length, loading })
      ) : (
        <div className="flex items-center gap-3">
          {searchInputNode}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {loading ? tGrid('loadingEllipsis') : tGrid('rows', { count: String(data.length) })}
          </span>
          {optionsButtonNode}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col relative w-full h-full">
        {!fetchAll && (
          <div className="flex gap-1 ml-auto shrink-0 mb-3 absolute top-0 right-0 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <span aria-hidden>←</span>{' '}{tGrid('prev')}
            </button>
            <span
              className="px-3 py-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {tGrid('page', { page: String(page) })}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.length < limit}
              className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {tGrid('next')}{' '}<span aria-hidden>→</span>
            </button>
          </div>
        )}
        <div className={`${gridTheme} flex-1 min-h-0 w-full h-full`}>
          <AgGridReact<T>
          ref={gridRef}
          rowData={data}
          columnDefs={enhancedColumns}
          defaultColDef={defaultColDef}
          animateRows
          rowSelection="single"
          {...(rowIdField ? { getRowId: (params) => String(params.data[rowIdField]) } : {})}
          suppressScrollOnNewData={true}
          initialState={savedInitialState}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onStateUpdated={onStateUpdated}
          onRowClicked={onRowClicked ? handleRowClicked : undefined}
          tooltipShowDelay={300}
          {...(fetchAll ? { quickFilterText: search } : {})}
        />
      </div>
      </div>
    </div>
  );
}
