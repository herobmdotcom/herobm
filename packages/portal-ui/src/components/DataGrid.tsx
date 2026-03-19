"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ColDefField,
  type GridReadyEvent,
  type FirstDataRenderedEvent,
  type RowClickedEvent,
  type ColumnState,
  type ColumnMovedEvent,
  type ColumnResizedEvent,
  type ColumnVisibleEvent,
  type SortChangedEvent,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ── localStorage column-state helpers ────────────────────────────── */

const STORAGE_PREFIX = "datagrid-cols-";

function saveColumnState(gridKey: string, state: ColumnState[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${gridKey}`, JSON.stringify(state));
  } catch {
    /* quota exceeded – silently ignore */
  }
}

function loadColumnState(gridKey: string): ColumnState[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gridKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clearColumnState(gridKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gridKey}`);
  } catch {
    /* ignore */
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
  showArchivedToggle?: boolean;
}

/** Format numbers: integers stay as integers, decimals get 2 places */
function numericFormatter(params: { value: unknown }) {
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
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const limit = fetchAll ? 99999 : 200;

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
    // persistColumnState will fire via the onColumnVisible event
  }, []);

  /* Debounce timer ref for column state persistence */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persist current column state (debounced) */
  const persistColumnState = useCallback(() => {
    if (!gridKey) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const api = gridRef.current?.api;
      if (!api) return;
      const state = api.getColumnState();
      if (state) saveColumnState(gridKey, state);
    }, 500);
  }, [gridKey]);

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

    apiFetch<{ data: T[] }>(`${endpoint}?${params}`)
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

  /** Auto-size columns to fit content after data loads, then restore saved state */
  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      event.api.autoSizeAllColumns();
      // Restore saved column state if a gridKey is provided
      if (gridKey) {
        const saved = loadColumnState(gridKey);
        if (saved) {
          event.api.applyColumnState({ state: saved, applyOrder: true });
        }
      }
    },
    [gridKey],
  );

  /** Also auto-size when new data arrives (only if no saved state) */
  const onFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent) => {
      if (gridKey && loadColumnState(gridKey)) return; // saved state takes priority
      event.api.autoSizeAllColumns();
    },
    [gridKey],
  );

  /** Column event handlers — persist state on move / resize / visibility */
  const onColumnMoved = useCallback(
    (e: ColumnMovedEvent) => {
      if (e.finished) persistColumnState();
    },
    [persistColumnState],
  );

  const onColumnResized = useCallback(
    (e: ColumnResizedEvent) => {
      if (e.finished) persistColumnState();
    },
    [persistColumnState],
  );

  const onColumnVisible = useCallback(
    (_e: ColumnVisibleEvent) => {
      persistColumnState();
    },
    [persistColumnState],
  );

  const onSortChanged = useCallback(
    (_e: SortChangedEvent) => {
      persistColumnState();
    },
    [persistColumnState],
  );

  /** CSV export handler */
  const handleExport = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv({
      fileName: `${exportFileName ?? "export"}_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  }, [exportFileName]);

  /** Reset columns to default layout */
  const handleResetColumns = useCallback(() => {
    if (gridKey) clearColumnState(gridKey);
    gridRef.current?.api?.resetColumnState();
    gridRef.current?.api?.autoSizeAllColumns();
  }, [gridKey]);

  /** Row click handler */
  const handleRowClicked = useCallback(
    (event: RowClickedEvent<T>) => {
      if (onRowClicked && event.data) {
        onRowClicked(event.data);
      }
    },
    [onRowClicked],
  );

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3">
        <input
          className="px-3 py-2 rounded-lg text-sm flex-1 max-w-md outline-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          placeholder={searchPlaceholder ?? "Search…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${data.length} rows`}
        </span>
        {/* ⚙ Grid menu — export, column visibility, reset */}
        <div ref={colPickerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setColPickerOpen((v) => !v)}
            className="px-3 py-1.5 rounded text-xs cursor-pointer"
            style={{
              background: colPickerOpen
                ? "var(--bg-card-hover)"
                : "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            title="Grid options"
          >
            ⚙ Options
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
              {/* Include Archived toggle */}
              {showArchivedToggle && (
                <>
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
                    Include Archived
                  </label>
                  <div
                    style={{
                      height: 1,
                      background: "var(--border)",
                      margin: "6px 0",
                    }}
                  />
                </>
              )}
              {/* Action items */}
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
                ⬇ Export CSV
              </button>
              {gridKey && (
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
                  ↻ Reset Columns
                </button>
              )}
              {/* Divider + column visibility */}
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
                    Columns
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
                </>
              )}
            </div>
          )}
        </div>
        {!fetchAll && (
          <div className="flex gap-1 ml-auto">
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
              ← Prev
            </button>
            <span
              className="px-3 py-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Page {page}
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
              Next →
            </button>
          </div>
        )}
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
          onColumnMoved={onColumnMoved}
          onColumnResized={onColumnResized}
          onColumnVisible={onColumnVisible}
          onSortChanged={onSortChanged}
          onRowClicked={onRowClicked ? handleRowClicked : undefined}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
