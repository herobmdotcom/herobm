/* eslint-disable no-restricted-syntax -- Type casting for complex, mathematically proven algorithms where TypeScript's type system falls short. */
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
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
  type SelectionChangedEvent,
  type StateUpdatedEvent,
  type GridState,
  type ScrollState,
} from "ag-grid-community";
import * as api from '@herobm/sdk';
import useSWR from 'swr';

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
  endpoint?: string;
  /** Local static row data array (mutually exclusive with endpoint) */
  rowData?: T[];
  /** AG Grid column definitions */
  columns: ColDef<T>[];
  /** Stable key for persisting column layout to localStorage (e.g. "ops-products") */
  gridKey?: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** File name prefix for CSV export (default: "export") */
  exportFileName?: string;
  /** Error reporter — called when data fetching fails */
  onError?: (err: unknown, component: string) => void;
  /** Optional callback when a row is clicked */
  onRowClicked?: (data: T) => void;
  /** When true, fetch the entire dataset in one request (no pagination). AG Grid handles sorting/filtering client-side. */
  fetchAll?: boolean;
  /** Whether to show a toggle to include archived records */
  /** Whether to show a toggle to include archived records */
  showArchivedToggle?: boolean;
  /** Built-in responsive header: The title of the page. If provided, DataGrid automatically wraps itself in the standard page layout. */
  pageTitle?: string | React.ReactNode;
  /** Built-in responsive header: Custom actions (e.g., Create Button) */
  headerActions?: React.ReactNode;
  /** Secondary header row rendered below the primary header actions. */
  secondaryHeader?: React.ReactNode;
  /** Built-in responsive header: Custom filters (e.g., date dropdown) */
  headerFilters?: React.ReactNode;
  /** If provided, customizes the entire top bar rendering (mutually exclusive with pageTitle) */
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
  /** Selection mode for rows */
  rowSelection?: "single" | "multiple";
  /** Callback when selection changes */
  onSelectionChanged?: (selectedRows: T[]) => void;
  /** Number to trigger a refresh without unmounting the grid */
  refreshTrigger?: number;
  /** Context object passed directly into AgGridReact context to be available to cell renderers */
  context?: unknown;
  /** Callback to determine if a row is selectable */
  isRowSelectable?: (node: import('ag-grid-community').IRowNode<T>) => boolean;
  /** Callback when data is successfully loaded */
  onDataLoaded?: (data: T[]) => void;
  /** AG Grid domLayout — use 'autoHeight' when the grid is inside a container without a resolved pixel height (e.g. slideovers) */
  domLayout?: 'normal' | 'autoHeight' | 'print';
  /** Optional prefix for URL query parameters to avoid collisions when multiple grids exist on the same page */
  urlPrefix?: string;
  /** Default sort model to apply when no saved state exists */
  defaultSortModel?: { colId: string; sort: 'asc' | 'desc' }[];
  /** Custom HTML string for the empty state */
  overlayNoRowsTemplate?: string;
  /** Explicitly override the loading state (useful when managing fetching outside) */
  loading?: boolean;
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

function getCellValue<T>(col: ColDef<T>, row: T) {
  let rawValue = col.field ? (row as Record<string, unknown>)[col.field] : undefined;
  if (col.valueGetter) {
    if (typeof col.valueGetter === 'function') {
      rawValue = col.valueGetter({ data: row, getValue: () => undefined } as never);
    }
  }

  let formattedValue = rawValue;
  if (col.valueFormatter) {
    if (typeof col.valueFormatter === 'function') {
      formattedValue = col.valueFormatter({ value: rawValue, data: row } as never);
    }
  }

  if (col.cellRenderer) {
    if (typeof col.cellRenderer === 'function') {
      const Renderer = col.cellRenderer as React.ElementType;
      return <Renderer value={rawValue} data={row} />;
    }
  }

  return formattedValue ?? rawValue;
}

function GenericMobileCard<T>({ 
  row, 
  columns, 
  onRowClicked,
  selectable,
  selected,
  onToggleSelect
}: { 
  row: T; 
  columns: ColDef<T>[]; 
  onRowClicked?: (row: T) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleCols = columns.filter(c => !c.hide);
  if (visibleCols.length === 0) return null;

  const primaryCol = visibleCols[0];
  const primaryVal = getCellValue(primaryCol, row);

  const secondaryCol = visibleCols.length > 1 ? visibleCols[1] : null;
  const secondaryVal = secondaryCol ? getCellValue(secondaryCol, row) : null;

  const restCols = visibleCols.slice(2);
  let validRestCols = restCols.map(col => ({ col, val: getCellValue(col, row) }));
  
  if (onRowClicked) {
    validRestCols = validRestCols.filter(item => item.val != null && item.val !== '');
  } else {
    validRestCols = validRestCols.map(item => {
      if (item.val == null || item.val === '') item.val = <span className="text-slate-300">—</span>;
      return item;
    });
  }

  const displayLimit = 3;
  const isTruncated = validRestCols.length > displayLimit;
  const displayedCols = expanded ? validRestCols : validRestCols.slice(0, displayLimit);

  return (
    <div 
      className={`p-4 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200 flex flex-col gap-3 transition-transform ${onRowClicked ? 'cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={() => onRowClicked?.(row)}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-[13px] text-slate-500 font-medium whitespace-nowrap mb-0.5">{primaryVal as React.ReactNode}</div>
          <div className="text-[11px] text-slate-400 max-w-[200px] truncate">{secondaryVal as React.ReactNode}</div>
        </div>
        {selectable && (
          <div 
            className="flex items-center justify-center pt-1 shrink-0" 
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            <input 
              type="checkbox" 
              checked={selected || false} 
              readOnly 
              style={{ accentColor: "var(--accent)", width: 18, height: 18, cursor: onToggleSelect ? 'pointer' : 'not-allowed', opacity: onToggleSelect ? 1 : 0.5 }} 
            />
          </div>
        )}
      </div>
      
      {displayedCols.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
          {displayedCols.map(({col, val}, idx) => (
            <div key={col.field || col.headerName || idx} className="flex justify-between items-start gap-4 text-[13px]">
              <span className="text-slate-500">{col.headerName}</span>
              <span className="font-medium text-[#041627] text-right">{val as React.ReactNode}</span>
            </div>
          ))}
          {isTruncated && (
            <div 
              className="text-[13px] font-bold text-[var(--accent)] mt-1 pt-2 border-t border-slate-50 flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? 'Show Less' : `+ ${validRestCols.length - displayLimit} More`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataGrid<T>({
  endpoint,
  rowData,
  columns,
  gridKey = "default-grid",
  searchPlaceholder,
  exportFileName = "export",
  onError,
  onRowClicked,
  fetchAll = false,
  showArchivedToggle = false,
  pageTitle,
  headerActions,
  headerFilters,
  renderHeader,
  gridTheme = "ag-theme-alpine-dark",
  initialSearch,
  rowIdField,
  rowSelection = "single",
  onSelectionChanged,
  refreshTrigger = 0,
  context,
  isRowSelectable,
  onDataLoaded,
  domLayout,
  urlPrefix,
  secondaryHeader,
  defaultSortModel,
  overlayNoRowsTemplate,
  loading: externalLoading,
}: DataGridProps<T>) {
  const tGrid = useTranslations('common.grid');
  const gridRef = useRef<AgGridReact<T>>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qParam = urlPrefix ? `${urlPrefix}_q` : 'q';
  const cursorParam = urlPrefix ? `${urlPrefix}_cursor` : 'cursor';
  const dirParam = urlPrefix ? `${urlPrefix}_dir` : 'dir';
  const archivedParam = urlPrefix ? `${urlPrefix}_archived` : 'archived';
  const limitParam = urlPrefix ? `${urlPrefix}_limit` : 'limit';

  // Merge saved grid state (columns etc. from localStorage) + scroll (from sessionStorage)
  // into a single initialState — read once on mount
  const savedInitialState = useMemo<GridState | undefined>(() => {
    const gridState = gridKey ? loadGridState(gridKey) : null;
    const scroll = gridKey ? loadScrollState(gridKey) : null;
    if (!gridState && !scroll && !defaultSortModel) return undefined;
    
    const state: GridState = {
      ...(gridState ?? {}),
      ...(scroll ? { scroll } : {}),
      partialColumnState: true, // we may not have all column properties
    };

    if ((!gridState || !gridState.sort || gridState.sort.sortModel?.length === 0) && defaultSortModel) {
      state.sort = { sortModel: defaultSortModel };
    }

    return state;
  }, [gridKey, defaultSortModel]);

  const [data, setData] = useState<T[] | undefined>(undefined);
  const [sortedData, setSortedData] = useState<T[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [internalRefresh, setInternalRefresh] = useState(0);

  useEffect(() => {
    if (!gridKey) return;
    const handler = () => setInternalRefresh((prev) => prev + 1);
    window.addEventListener(`grid-refresh-${gridKey}`, handler);
    return () => window.removeEventListener(`grid-refresh-${gridKey}`, handler);
  }, [gridKey]);

  const [displayedRowCount, setDisplayedRowCount] = useState<number>(0);
  const [internalLoading, setInternalLoading] = useState(true);
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  // Initialize state from URL params if available, falling back to defaults
  const [search, setSearch] = useState(() => searchParams?.get(qParam) ?? initialSearch ?? "");
  const [includeArchived, setIncludeArchived] = useState(() => searchParams?.get(archivedParam) === 'true');
  const [cursor, setCursor] = useState<string | null>(() => searchParams?.get(cursorParam) ?? null);
  const [direction, setDirection] = useState<'next' | 'prev'>(() => (searchParams?.get(dirParam) as 'next' | 'prev') ?? 'next');
  const [limit, setLimit] = useState<number>(() => {
    const fromUrl = searchParams?.get(limitParam);
    if (fromUrl) return Number(fromUrl);
    
    const initialIsMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;

    if (gridKey && typeof window !== 'undefined') {
      try {
        const savedLimit = localStorage.getItem(`${STORAGE_PREFIX}${gridKey}-limit`);
        if (savedLimit) {
          const parsed = Number(savedLimit);
          // Don't use desktop's large limits on mobile
          if (!initialIsMobile || parsed <= 50) {
            return parsed;
          }
        }
      } catch (e) {
        /* ignore */
      }
    }

    if (fetchAll && !initialIsMobile) return 99999;
    return initialIsMobile ? 25 : 200;
  });

  useEffect(() => {
    if (gridKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${gridKey}-limit`, String(limit));
      } catch (e) {
        /* ignore */
      }
    }
  }, [limit, gridKey]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  // We are fully restored from URL synchronously
  const isRestored = true;

  // Sync state FROM URL to local state (e.g., when user hits Back button)
  useEffect(() => {
    setSearch(searchParams?.get(qParam) ?? initialSearch ?? "");
    setIncludeArchived(searchParams?.get(archivedParam) === 'true');
    setCursor(searchParams?.get(cursorParam) ?? null);
    setDirection((searchParams?.get(dirParam) as 'next' | 'prev') ?? 'next');
    const fromUrl = searchParams?.get(limitParam);
    if (fromUrl) {
      setLimit(Number(fromUrl));
    } else {
      let savedLimit: number | null = null;
      const initialIsMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
      if (gridKey && typeof window !== 'undefined') {
        try {
          const val = localStorage.getItem(`${STORAGE_PREFIX}${gridKey}-limit`);
          if (val) {
            const parsed = Number(val);
            if (!initialIsMobile || parsed <= 50) {
              savedLimit = parsed;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }
      if (savedLimit) {
        setLimit(savedLimit);
      } else {
        setLimit(initialIsMobile ? 25 : 200);
      }
    }
  }, [searchParams, qParam, archivedParam, cursorParam, dirParam, initialSearch, limitParam]);

  // Sync local state TO URL (e.g., when user types or clicks next page)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    // We only update if the local state actually differs from what's currently in the URL
    // to avoid infinite loops when syncing back from URL
    const currentQ = searchParams?.get(qParam) ?? "";
    const currentArchived = searchParams?.get(archivedParam) === 'true';
    const currentCursor = searchParams?.get(cursorParam) ?? null;
    const currentDir = searchParams?.get(dirParam) ?? 'next';
    const currentLimit = searchParams?.get(limitParam);
    
    // Check if the current URL matches the local limit state.
    // If the URL has no limit param, it's considered to match if the limit is the default limit.
    const defaultLimit = isMobile ? 25 : 200;
    const isDefaultLimit = limit === defaultLimit || (fetchAll && !isMobile && limit === 99999);
    const urlLimitMatches = currentLimit 
      ? Number(currentLimit) === limit 
      : isDefaultLimit;

    if (
      search === currentQ && 
      includeArchived === currentArchived && 
      cursor === currentCursor && 
      direction === currentDir &&
      urlLimitMatches
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    
    if (search) params.set(qParam, search);
    else params.delete(qParam);

    if (includeArchived) params.set(archivedParam, 'true');
    else params.delete(archivedParam);

    if (cursor) {
      params.set(cursorParam, cursor);
      params.set(dirParam, direction);
    } else {
      params.delete(cursorParam);
      params.delete(dirParam);
    }

    if (limit !== (isMobile ? 25 : 200) && !(fetchAll && !isMobile && limit === 99999)) {
      params.set(limitParam, String(limit));
    } else {
      params.delete(limitParam);
    }

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    router.replace(newUrl, { scroll: false });
  }, [search, includeArchived, cursor, direction, limit, qParam, archivedParam, cursorParam, dirParam, limitParam, searchParams, router, isMobile, fetchAll]);

  /* ── Column picker dropdown state ────────────────────────────────── */
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const effectiveFetchAll = limit === 99999;

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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

  const swrKey = useMemo(() => {
    if (rowData || !endpoint || !isRestored) return null;
    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
      params.set("direction", direction);
    }
    params.set("limit", String(limit));
    if (search) params.set("q", search);
    if (includeArchived) params.set("includeArchived", "true");
    
    if (refreshTrigger || internalRefresh) {
      params.set("_refresh", String((refreshTrigger || 0) + (internalRefresh || 0)));
    }
    
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint.replace('/api', '')}${separator}${params}`;
  }, [rowData, endpoint, isRestored, cursor, direction, limit, search, includeArchived, refreshTrigger, internalRefresh]);

  const { data: swrResponse, error: swrError, isLoading: swrIsLoading } = useSWR(
    swrKey,
    (url: string) => {
      const cleanUrl = url.replace(/([&?])_refresh=\d+&?/, '$1').replace(/&$/, '').replace(/\?$/, '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      return api.customFetch(cleanUrl, { method: 'GET' }).then((res: any) => res.data);
    },
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  useEffect(() => {
    if (!isRestored) return;

    if (rowData) {
      setData(rowData);
      setDisplayedRowCount(rowData.length);
      setInternalLoading(false);
      return;
    }

    if (!endpoint) return;

    if (swrError) {
      if (onError) onError(swrError, 'DataGrid');
      setInternalLoading(false);
      return;
    }

    if (swrIsLoading && !swrResponse) {
      setInternalLoading(true);
      return;
    }

    if (swrResponse) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const body = swrResponse as any;
      const safeData = Array.isArray(body) ? body : (body?.data || []);
      setData(safeData);
      setNextCursor(body?.nextCursor ?? null);
      setPrevCursor(body?.prevCursor ?? null);
      setDisplayedRowCount(safeData.length);
      setInternalLoading(false);
    }
  }, [isRestored, rowData, endpoint, swrResponse, swrIsLoading, swrError, onError]);

  // Restore scroll position on mobile after data loads
  useEffect(() => {
    if (!loading && data && data.length > 0 && gridKey && isMobile) {
      const key = `datagrid-mobile-scroll-${gridKey}`;
      const savedScroll = sessionStorage.getItem(key);
      if (savedScroll) {
        const main = document.querySelector('main');
        if (main) {
          requestAnimationFrame(() => {
            main.scrollTop = parseInt(savedScroll, 10);
          });
          sessionStorage.removeItem(key);
        }
      }
    }
  }, [loading, data, gridKey, isMobile]);

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
      setColRevision((r) => r + 1);
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
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
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
      {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
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
          setSearch(e.target.value.trimStart());
          setCursor(null);
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border)";
          setSearch(e.target.value.trim());
        }}
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
        {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
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
                    {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
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
                        setCursor(null);
                      }}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {tGrid('includeArchived')}
                  </label>
                </>
              )}

              {/* 4. Pagination Section */}
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
                {tGrid('pageSize')}
              </div>
              {[10, 25, 50, 100, 200, 99999].map((size) => (
                <label
                  key={size}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: limit === size ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-card-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <input
                    type="radio"
                    name={`${gridKey}-pageSize`}
                    checked={limit === size}
                    onChange={() => {
                      setLimit(size);
                      setCursor(null); // Reset to first page
                      setColPickerOpen(false); // Optionally close the menu, but keeping it open is fine too
                    }}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  {size === 99999 ? tGrid('all') : size}
                </label>
              ))}
            </div>
          )}
        </div>
  );


  const renderPaginationControls = (isMobileView: boolean) => {
    if (effectiveFetchAll || !mounted) return null;
    
    const wrapperClass = isMobileView 
      ? 'lg:hidden flex items-center justify-between w-full p-2 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200 shrink-0'
      : 'hidden lg:flex gap-1 ml-auto shrink-0 mb-3 absolute top-0 right-0 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-100';

    return (
      <div className={wrapperClass}>
        <button
          onClick={() => {
            setCursor(prevCursor);
            setDirection('prev');
          }}
          disabled={!cursor || !prevCursor}
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
          className="px-3 py-1.5 text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {/* Using grid metadata if we want, or just empty space */}
        </span>
        <button
          onClick={() => {
            setCursor(nextCursor);
            setDirection('next');
          }}
          disabled={!nextCursor}
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
    );
  };

  const gridContent = (
    <div className="flex-1 lg:min-h-0 flex flex-col relative w-full lg:h-full">
      {renderPaginationControls(false)}
      <div className="hidden lg:block flex-1 min-h-0 w-full h-full relative">
        <div className={`${gridTheme} absolute inset-0`}>
          <AgGridReact<T>
            ref={gridRef}
            rowData={data}
            loading={loading}
            columnDefs={enhancedColumns}
            defaultColDef={defaultColDef}
            animateRows
            rowSelection={rowSelection}
            isRowSelectable={isRowSelectable}
            context={context}
            {...(rowIdField ? { getRowId: (params) => String(params.data[rowIdField as keyof T]) } : {})}
            suppressScrollOnNewData={true}
            initialState={savedInitialState}
            onGridReady={onGridReady}
            onFirstDataRendered={onFirstDataRendered}
            onStateUpdated={onStateUpdated}
            onModelUpdated={(e) => {
              setDisplayedRowCount(e.api.getDisplayedRowCount());
              const nodes: T[] = [];
              e.api.forEachNodeAfterFilterAndSort(node => {
                if (node.data) nodes.push(node.data);
              });
              setSortedData(nodes);
            }}
            onRowClicked={onRowClicked ? handleRowClicked : undefined}
            onSelectionChanged={onSelectionChanged ? (e: SelectionChangedEvent<T>) => {
              if (rowIdField) {
                const selectedNodes = e.api.getSelectedNodes();
                const newIds = new Set<string>();
                selectedNodes.forEach(node => {
                  if (node.id) newIds.add(node.id);
                });
                setSelectedRowIds(newIds);
              }
              onSelectionChanged!(e.api.getSelectedRows());
            } : undefined}
            tooltipShowDelay={300}
            {...(domLayout ? { domLayout } : {})}
            {...(effectiveFetchAll ? { quickFilterText: search } : {})}
            {...(overlayNoRowsTemplate ? { overlayNoRowsTemplate: overlayNoRowsTemplate } : {})}
          />
        </div>
      </div>

      {/* Mobile Generic Card View */}
      <div className="lg:hidden flex-1 w-full flex flex-col gap-3 pb-24">
        {renderPaginationControls(true)}
        {(() => {
          const api = gridRef.current?.api;
          const mobileVisibleCols = api
            ? enhancedColumns.filter(col => {
                const colId = (col.field || col.colId || col.headerName) as string;
                if (!colId) return !col.hide;
                const gridCol = api.getColumn(colId);
                return gridCol ? gridCol.isVisible() : !col.hide;
              })
            : enhancedColumns.filter(c => !c.hide);

          const dataToMap = sortedData.length > 0 ? sortedData : (data || []);

          return dataToMap.map((row, idx) => {
            const key = rowIdField ? String((row as Record<keyof T, unknown>)[rowIdField as keyof T]) : idx;
            const isSelected = selectedRowIds.has(String(key));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            const isSelectable = isRowSelectable ? isRowSelectable({ data: row } as any) : true;
            return <GenericMobileCard 
              key={key} 
              row={row} 
              columns={mobileVisibleCols} 
            selectable={!!onSelectionChanged || rowSelection === 'multiple'}
            selected={isSelected}
            onToggleSelect={isSelectable ? () => {
              if (rowIdField && gridRef.current?.api) {
                const node = gridRef.current.api.getRowNode(String(key));
                if (node) {
                  node.setSelected(!node.isSelected());
                }
              }
            } : undefined}
            onRowClicked={onRowClicked ? (r) => {
              const main = document.querySelector('main');
              if (main && gridKey) {
                sessionStorage.setItem(`datagrid-mobile-scroll-${gridKey}`, String(main.scrollTop));
              }
              onRowClicked(r);
            } : undefined} 
          />;
          });
        })()}
        {data && data.length > 0 && renderPaginationControls(true)}
      </div>
    </div>
  );

  if (pageTitle) {
    return (
      <div className="lg:h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative lg:h-full flex flex-col">
          <div className="flex-1 lg:min-h-0 flex flex-col z-10 lg:bg-white lg:rounded-xl lg:shadow-[0_2px_8px_rgba(0,0,0,0.04)] lg:border lg:border-[rgba(196,198,205,0.4)] lg:overflow-hidden transition-all">
             <div className="flex flex-col lg:flex-row lg:items-center justify-between lg:px-6 py-4 gap-4">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between lg:justify-start gap-4 w-full lg:w-auto">
                  <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {pageTitle}
                    </h2>
                    <div className="hidden lg:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                      <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {tGrid('rowCountLabel')}
                      </span>
                      <span className="text-[11px] font-bold text-[#006b5c]">
                        {loading ? '...' : displayedRowCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {headerActions && (
                    <div className="lg:hidden shrink-0 w-full overflow-x-auto overflow-y-hidden pb-1 pt-1">
                      <div className="flex items-center gap-2">
                        {headerActions}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto relative">
                  <div className="flex-1 lg:max-w-[280px] lg:ml-6 transition-all duration-200 focus-within:absolute focus-within:inset-y-0 focus-within:left-0 focus-within:right-0 focus-within:z-20 lg:focus-within:static bg-[#f8fafc] lg:bg-transparent rounded-lg">
                    {searchInputNode}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {headerFilters}
                    {optionsButtonNode}
                    {headerActions && (
                      <div className="hidden lg:block shrink-0">
                        {headerActions}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {secondaryHeader && (
                <div className="hidden lg:flex px-6 py-4 justify-end border-t border-[rgba(196,198,205,0.2)]">
                  {secondaryHeader}
                </div>
              )}
             {gridContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-full lg:bg-white relative">
      {renderHeader ? (
        renderHeader!({ searchInput: searchInputNode, optionsButton: optionsButtonNode, rowCount: displayedRowCount, loading })
      ) : (
        <div className="flex items-center gap-3">
          {searchInputNode}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {loading ? tGrid('loadingEllipsis') : tGrid('rows', { count: String(displayedRowCount) })}
          </span>
          {optionsButtonNode}
        </div>
      )}
      {gridContent}
    </div>
  );
}
