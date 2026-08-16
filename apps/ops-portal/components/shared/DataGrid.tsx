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
import { useAuth } from './AuthGate';
import { apiFetch } from '../../lib/api';
import { Button } from './Button';

ModuleRegistry.registerModules([AllCommunityModule]);

import { 
  saveGridState, loadGridState, clearGridState, STORAGE_PREFIX,
  saveScrollState, loadScrollState, SCROLL_STORAGE_PREFIX, clearScrollState
} from "./datagrid/DataGridStateHelpers";
import { numericFormatter } from "./datagrid/DataGridFormatters";
import { GenericMobileCard } from "./datagrid/GenericMobileCard";

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
  onRowClicked?: (data: T, event?: MouseEvent | KeyboardEvent) => void;
  /** Optional function returning a URL for a row. Automatically handles normal clicks (push) vs control-clicks (new tab). Mutually exclusive with onRowClicked. */
  rowHref?: (data: T) => string;
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
  /** Whether to hide the global search input */
  hideSearch?: boolean;
  /** Whether to hide the secondaryHeader wrapper on mobile to remove empty vertical space */
  hideSecondaryHeaderOnMobile?: boolean;
}


export default function DataGrid<T>({
  endpoint,
  rowData,
  columns,
  gridKey: providedGridKey,
  searchPlaceholder,
  exportFileName = "export",
  onError,
  onRowClicked,
  rowHref,
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
  hideSearch,
  hideSecondaryHeaderOnMobile = false,
}: DataGridProps<T>) {
  const tGrid = useTranslations('common.grid');
  const gridRef = useRef<AgGridReact<T>>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const gridKey = providedGridKey || (pathname ? `grid-${pathname.replace(/\//g, '-')}` : "default-grid");

  const qParam = urlPrefix ? `${urlPrefix}_q` : 'q';
  const cursorParam = urlPrefix ? `${urlPrefix}_cursor` : 'cursor';
  const dirParam = urlPrefix ? `${urlPrefix}_dir` : 'dir';
  const archivedParam = urlPrefix ? `${urlPrefix}_archived` : 'archived';
  const limitParam = urlPrefix ? `${urlPrefix}_limit` : 'limit';

  // Merge saved grid state (columns etc. from localStorage) + scroll (from sessionStorage)
  // into a single initialState — read once on mount
  // Merge saved grid state (columns etc. from localStorage) + scroll (from sessionStorage)
  // into a single initialState — read once on mount
  const savedInitialState = useMemo(() => {
    const gridState = gridKey ? loadGridState(gridKey) : null;
    
    const scroll = gridKey ? loadScrollState(gridKey) : null;
    if (!gridState && !scroll && !defaultSortModel) return undefined;
    
    const state: GridState = {
      ...(gridState ?? {}),
      ...(scroll ? { scroll } : {}),
      partialColumnState: true, // we may not have all column properties
    };

    // The grid's page size is controlled by the 'limit' React state (which syncs with the URL).
    // If we restore pagination state here, it will override the React prop.
    if (state.pagination) {
      delete state.pagination;
    }

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

  const [isCustomView, setIsCustomView] = useState(false);
  const [displayedRowCount, setDisplayedRowCount] = useState<number>(0);
  const [internalLoading, setInternalLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  // Initialize state from URL params if available, falling back to sessionStorage, then defaults
  const [search, setSearch] = useState(() => {
    const urlVal = searchParams?.get(qParam);
    if (urlVal != null) return urlVal;
    if (typeof window !== 'undefined' && gridKey) {
      try {
        const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${gridKey}-search`);
        if (saved != null) return saved;
      } catch {
        /* ignore */
      }
    }
    return initialSearch ?? "";
  });
  const [includeArchived, setIncludeArchived] = useState(() => {
    const urlVal = searchParams?.get(archivedParam);
    if (urlVal != null) return urlVal === 'true';
    if (typeof window !== 'undefined' && gridKey) {
      try {
        const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${gridKey}-archived`);
        if (saved != null) return saved === 'true';
      } catch {
        /* ignore */
      }
    }
    return false;
  });
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
          // Don't restore 99999 from localStorage, and don't use desktop limits on mobile
          if (parsed !== 99999 && (!initialIsMobile || parsed <= 50)) {
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
  const [previousLimit, setPreviousLimit] = useState<number | null>(null);

  const isGridFilteredRef = useRef(false);
  const lastActionRef = useRef<string | null>(null);


  useEffect(() => {
    if (gridKey && typeof window !== 'undefined') {
      try {
        if (limit !== 99999) {
          localStorage.setItem(`${STORAGE_PREFIX}${gridKey}-limit`, String(limit));
        }
        if (search) {
          sessionStorage.setItem(`${STORAGE_PREFIX}${gridKey}-search`, search);
        } else {
          sessionStorage.removeItem(`${STORAGE_PREFIX}${gridKey}-search`);
        }
        if (includeArchived) {
          sessionStorage.setItem(`${STORAGE_PREFIX}${gridKey}-archived`, 'true');
        } else {
          sessionStorage.removeItem(`${STORAGE_PREFIX}${gridKey}-archived`);
        }
      } catch (e) {
        /* ignore */
      }
    }
  }, [limit, search, includeArchived, gridKey]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  // We are fully restored from URL synchronously
  const isRestored = true;

  // Sync state FROM URL to local state (e.g., when user hits Back button)
  useEffect(() => {
    const qFromUrl = searchParams?.get(qParam);
    if (qFromUrl != null) {
      setSearch(qFromUrl);
    } else if (gridKey && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${gridKey}-search`);
        setSearch(saved ?? initialSearch ?? "");
      } catch {
        setSearch(initialSearch ?? "");
      }
    } else {
      setSearch(initialSearch ?? "");
    }

    const archivedFromUrl = searchParams?.get(archivedParam);
    if (archivedFromUrl != null) {
      setIncludeArchived(archivedFromUrl === 'true');
    } else if (gridKey && typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${gridKey}-archived`);
        setIncludeArchived(saved === 'true');
      } catch {
        setIncludeArchived(false);
      }
    } else {
      setIncludeArchived(false);
    }
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
            if (parsed !== 99999 && (!initialIsMobile || parsed <= 50)) {
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
  }, [searchParams, qParam, archivedParam, cursorParam, dirParam, initialSearch, limitParam, gridKey]);

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

  const isClientData = Boolean(rowData) || fetchAll;
  const [clientPage, setClientPage] = useState(0);
  const [clientTotalPages, setClientTotalPages] = useState(1);
  const effectiveFetchAll = limit === 99999;

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [colRevision, setColRevision] = useState(0);
  const { permissions } = useAuth();
  const canExport = permissions?.some(p => p.resource === 'data-export' && p.action === 'read' && p.effect === 'allow');
  const containerRef = useRef<HTMLDivElement>(null);
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
        const stateToSave = { ...event.state };
        if (stateToSave.pagination) {
          delete stateToSave.pagination;
        }
        saveGridState(gridKey, stateToSave);
      if (event.state.scroll) {
        if (event.state.scroll.top === 0) {
          clearScrollState(gridKey);
        } else {
          saveScrollState(gridKey, event.state.scroll);
        }
      }
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

  const getExportValue = (col: ColDef, row: Record<string, unknown>) => {
    if (col.valueGetter && typeof col.valueGetter === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We don't have the full ValueGetterParams object to mock here
      return col.valueGetter({ data: row, colDef: col, api: gridRef.current?.api } as any);
    }
    return row[col.field as string];
  };

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

  const effectiveData = useMemo(() => {
    if (rowData) return rowData;
    if (swrResponse) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const body = swrResponse as any;
      return Array.isArray(body) ? body : (body?.data || []);
    }
    return data;
  }, [rowData, swrResponse, data]);

  const loading = externalLoading !== undefined 
    ? externalLoading 
    : (swrResponse ? false : internalLoading);

  useEffect(() => {
    if (!isRestored) return;

    if (rowData) {
      setData(rowData);
      onDataLoaded?.(rowData);
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
      onDataLoaded?.(safeData);
      setNextCursor(body?.nextCursor ?? null);
      setPrevCursor(body?.prevCursor ?? null);
      setInternalLoading(false);
    }
  }, [isRestored, rowData, endpoint, swrResponse, swrIsLoading, swrError, onError]);

  // Ensure AG Grid reacts to limit changes and data loads dynamically
  useEffect(() => {
    if (gridRef.current?.api && isClientData) {
      if (limit === 99999) {
        if (typeof gridRef.current.api.setGridOption === 'function') {
          gridRef.current.api.setGridOption('pagination', false);
        }
      } else {
        if (typeof gridRef.current.api.setGridOption === 'function') {
          gridRef.current.api.setGridOption('pagination', true);
          gridRef.current.api.setGridOption('paginationPageSize', limit);
        }
      }
    }
  }, [limit, isClientData, effectiveData]);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!loading && effectiveData && effectiveData.length > 0 && gridKey) {
      if (isMobile) {
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
      } else {
        const scroll = loadScrollState(gridKey);
        if (scroll && containerRef.current) {
          const viewport = containerRef.current.querySelector('.ag-body-viewport') as HTMLElement;
          if (viewport) {
            requestAnimationFrame(() => {
              viewport.scrollTop = scroll.top;
              viewport.scrollLeft = scroll.left;
            });
          }
        }
      }
    }
  }, [loading, effectiveData, gridKey, isMobile]);

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
          // Default boolean values to simple text 'true' / 'false' to minimize rendering cost
          ...(!col.valueFormatter && !col.cellRenderer
            ? {
                valueFormatter: (params: import('ag-grid-community').ValueFormatterParams<T>) => {
                  if (typeof params.value === 'boolean') {
                    return params.value ? 'true' : 'false';
                  }
                  return params.value;
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
      // Force sync pagination state dynamically for React strict mode / prop binding quirks
      if (isClientData) {
        if (limit === 99999) {
          if (typeof event.api.setGridOption === 'function') {
            event.api.setGridOption('pagination', false);
          }
        } else {
          if (typeof event.api.setGridOption === 'function') {
            event.api.setGridOption('pagination', true);
            event.api.setGridOption('paginationPageSize', limit);
          }
        }
      }

      // Only auto-size if there's no saved state — otherwise initialState
      // has already applied the saved column widths/order
      if (!gridKey || !loadGridState(gridKey)) {
        event.api.autoSizeAllColumns();
      }
      setColRevision((r) => r + 1);
    },
    [gridKey, isClientData, limit],
  );

  /** Also auto-size when new data arrives (only if no saved state) */
  const onFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent) => {
      if (gridKey && loadGridState(gridKey)) return; // saved state takes priority
      event.api.autoSizeAllColumns();
    },
    [gridKey],
  );

  const [isExporting, setIsExporting] = useState(false);

  const resetScroll = useCallback(() => {
    if (gridKey) clearScrollState(gridKey);
    if (isMobile) {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    } else {
      if (containerRef.current) {
        const viewport = containerRef.current.querySelector('.ag-body-viewport') as HTMLElement;
        if (viewport) {
          viewport.scrollTop = 0;
        }
      }
    }
  }, [gridKey, isMobile]);

  /** CSV export handler */
  const handleExport = useCallback(async () => {
    if (isClientData || effectiveFetchAll) {
      gridRef.current?.api?.exportDataAsCsv({
        fileName: `${exportFileName ?? "export"}_${new Date().toISOString().slice(0, 10)}.csv`,
      });
      return;
    }

    if (!endpoint) return;
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (includeArchived) params.set("includeArchived", "true");
      
      const [baseEndpoint, queryString] = endpoint.split('?');
      if (queryString) {
         const existingParams = new URLSearchParams(queryString);
         for (const [k, v] of existingParams.entries()) {
           params.append(k, v);
         }
      }
      params.set("limit", "999999");
      
      const url = `${baseEndpoint}?${params.toString()}`;
      
      const data = await apiFetch<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>(url);
      const safeData = Array.isArray(data) ? data : (data?.data || []);
      
      const visibleCols = enhancedColumns.filter(c => !c.hide);
      const headers = visibleCols.map(c => c.headerName || c.field).join(',');
      const rows = safeData.map((row: Record<string, unknown>) => {
        return visibleCols.map(col => {
          let val = getExportValue(col, row);
          if (val === null || val === undefined) val = '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
      });
      const csv = [headers, ...rows].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      link.setAttribute("href", objUrl);
      link.setAttribute("download", `${exportFileName ?? "export"}_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  }, [exportFileName, isClientData, effectiveFetchAll, endpoint, search, includeArchived, enhancedColumns]);

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
        try {
          if (typeof event.api.getState === 'function') {
            const state = event.api.getState();
            if (state && state.scroll) {
              saveScrollState(gridKey, state.scroll);
            }
          }
        } catch (e) {
          console.warn("Failed to get grid state:", e);
        }
      }
      if (rowHref && event.data) {
        const url = rowHref(event.data);
        if (event.event && ((event.event as MouseEvent).ctrlKey || (event.event as MouseEvent).metaKey)) {
          window.open(url, '_blank');
        } else {
          router.push(url);
        }
      } else if (onRowClicked && event.data) {
        onRowClicked(event.data, event.event as MouseEvent | KeyboardEvent);
      }
    },
    [onRowClicked, rowHref, gridKey, router],
  );

  const searchInputNode = hideSearch ? null : (
    <div className="relative flex items-center w-full">
      {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
      <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] absolute left-3 pointer-events-none">search</span>
      <input
        className={`w-full pl-9 py-2 rounded-lg text-sm outline-none transition-all duration-300 bg-white border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] ${!search ? 'pr-0 placeholder-transparent lg:placeholder-slate-400 focus:placeholder-slate-400 lg:pr-4 focus:pr-4' : 'pr-4'}`}
        placeholder={searchPlaceholder ?? "Search…"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.trimStart());
          setCursor(null);
          resetScroll();
        }}
        onBlur={(e) => {
          setSearch(e.target.value.trim());
        }}
      />
    </div>
  );

  const optionsButtonNode = (
    <div ref={colPickerRef} className="relative">
      <Button
        onClick={() => setColPickerOpen((v) => !v)}
        className={`px-3 py-1.5 rounded text-xs cursor-pointer transition-colors text-[var(--text-secondary)] border border-[var(--border)] ${
          colPickerOpen ? 'bg-[var(--bg-card-hover)]' : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
        }`}
        title={tGrid('options')}
      >
        {tGrid('options')}
      </Button>
      {colPickerOpen && (
        <div
          className={`absolute top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg py-1.5 z-50 min-w-[200px] max-h-[400px] overflow-y-auto shadow-2xl ${
            isMobile ? 'left-1/2 -translate-x-1/2' : 'left-0'
          }`}
        >
          {/* 1. Export Section */}
          {canExport && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setColPickerOpen(false);
                handleExport();
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 bg-transparent border-0 cursor-pointer text-[13px] text-[var(--text-primary)] text-left hover:bg-[var(--bg-card-hover)]"
            >
              <span aria-hidden>⬇</span>{' '}{tGrid('exportCsv')}
            </Button>
          )}

          {/* 2. Columns Section */}
          {gridKey && (
            <>
              <div className="h-px bg-[var(--border)] my-1.5" />
              <div className="px-3 pt-0.5 pb-1 text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.05em]">
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
                    className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-[13px] hover:bg-[var(--bg-card-hover)] ${
                      visible ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) =>
                        toggleColumnVisible(colId, e.target.checked)
                      }
                      className="accent-[var(--accent)]"
                    />
                    {col.headerName ?? colId}
                  </label>
                );
              })}
              <Button
                onClick={() => {
                  handleResetColumns();
                  setColPickerOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 bg-transparent border-0 cursor-pointer text-[13px] text-[var(--text-primary)] text-left hover:bg-[var(--bg-card-hover)]"
              >
                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
                <span aria-hidden>↻</span>{' '}{tGrid('resetColumns')}
              </Button>
            </>
          )}

          {/* 3. Rows Section */}
          {showArchivedToggle && (
            <>
              <div className="h-px bg-[var(--border)] my-1.5" />
              <div className="px-3 pt-0.5 pb-1 text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.05em]">
                {tGrid('rowCountLabel')}
              </div>
              <label
                className="flex items-center gap-2 w-full px-3 py-1.5 cursor-pointer text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
              >
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setCursor(null);
                  }}
                  className="accent-[var(--accent)]"
                />
                {tGrid('includeArchived')}
              </label>
            </>
          )}

          {/* 4. Pagination Section */}
          <div className="h-px bg-[var(--border)] my-1.5" />
          <div className="px-3 pt-0.5 pb-1 text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.05em]">
            {tGrid('pageSize')}
          </div>
          {[10, 25, 50, 100, 200, 99999].map((size) => (
            <label
              key={size}
              className={`flex items-center gap-2 w-full px-3 py-1.5 cursor-pointer text-[13px] hover:bg-[var(--bg-card-hover)] ${
                limit === size ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <input
                type="radio"
                name={`${gridKey}-pageSize`}
                checked={limit === size}
                onChange={() => {
                  setLimit(size);
                  if (size === 99999) {
                    setIsCustomView(false);
                  }
                  if (isClientData && gridRef.current?.api) {
                    if (size !== 99999) {
                      gridRef.current.api.paginationGoToPage(0);
                    }
                  }
                  setCursor(null);
                  setColPickerOpen(false);
                  resetScroll();
                }}
                className="accent-[var(--accent)]"
              />
              {size === 99999 ? tGrid('all') : size}
            </label>
          ))}
        </div>
      )}
    </div>
  );


  const handlePrev = useCallback(() => {
    if (isClientData) {
      gridRef.current?.api?.paginationGoToPreviousPage();
      resetScroll();
    } else {
      setCursor(prevCursor);
      setDirection('prev');
      resetScroll();
    }
  }, [isClientData, prevCursor, resetScroll]);

  const handleNext = useCallback(() => {
    if (isClientData) {
      gridRef.current?.api?.paginationGoToNextPage();
      resetScroll();
    } else {
      setCursor(nextCursor);
      setDirection('next');
      resetScroll();
    }
  }, [isClientData, nextCursor, resetScroll]);

  const isPrevDisabled = isClientData
    ? clientPage <= 0 || limit === 99999
    : !cursor || !prevCursor;

  const isNextDisabled = isClientData
    ? clientPage >= clientTotalPages - 1 || limit === 99999
    : !nextCursor;

  const prevButton = (
    <Button
      onClick={handlePrev}
      disabled={isPrevDisabled}
      className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]"
    >
      <span aria-hidden>←</span>{' '}{tGrid('prev')}
    </Button>
  );

  const nextButton = (
    <Button
      onClick={handleNext}
      disabled={isNextDisabled}
      className="px-3 py-1.5 rounded text-xs cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]"
    >
      {tGrid('next')}{' '}<span aria-hidden>→</span>
    </Button>
  );

  const shouldShowPagination = limit !== 99999;

  const renderPaginationControls = (isMobileView: boolean) => {
    if (!shouldShowPagination || !mounted) return null;
    
    const wrapperClass = isMobileView 
      ? 'lg:hidden flex items-center justify-between w-full p-2 bg-white rounded-xl -[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200 shrink-0'
      : 'flex gap-1 shrink-0';

    return (
      <div className={wrapperClass}>
        {prevButton}
        {nextButton}
      </div>
    );
  };

  const gridContent = (
    <div className={`flex-1 flex flex-col relative w-full ${domLayout === 'autoHeight' ? '' : 'lg:min-h-0 lg:h-full'}`}>
      <div className="flex flex-col-reverse lg:flex-row lg:items-center justify-between w-full px-4 pt-2 pb-2 lg:pt-1 lg:pb-2 bg-white shrink-0 min-h-[48px] gap-2 lg:gap-4 rounded-xl lg:rounded-none -[0_2px_8px_rgba(0,0,0,0.04)] lg:border lg:border-t-0 lg:border-x-0 lg:border-b-transparent">
        <div className="flex items-center justify-between w-full lg:w-auto gap-2 lg:gap-3 shrink-0">
          {(shouldShowPagination && mounted) && prevButton}
          
          {optionsButtonNode}
          
          {(shouldShowPagination && mounted) && nextButton}
          {(isCustomView) && (
            <>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{tGrid('customViewMessage', { fallback: 'All records' })}</span>
                <Button 
                  onClick={() => {
                    const api = gridRef.current?.api;
                    if (!api) return;
                    api.setFilterModel(null);
                    api.applyColumnState({ defaultState: { sort: null } });
                    if (defaultSortModel) {
                      api.applyColumnState({ state: defaultSortModel });
                    }
                    if (previousLimit !== null) {
                      setLimit(previousLimit);
                    } else {
                      setLimit(fetchAll && !isMobile ? 99999 : (isMobile ? 25 : 200));
                    }
                    setIsCustomView(false);
                  }}
                  className="hover:text-slate-800 focus:outline-none flex items-center justify-center rounded hover:bg-slate-100 px-1 py-0.5 transition-colors"
                >
                  {tGrid('clearCustomView', { fallback: 'x' })}
                </Button>
              </div>
            </>
          )}
        </div>
        {secondaryHeader && (
          <div className={`items-center overflow-x-auto whitespace-nowrap w-full lg:w-auto ${hideSecondaryHeaderOnMobile ? 'hidden lg:flex' : 'flex'}`}>
            {secondaryHeader}
          </div>
        )}
      </div>
      <div className={`hidden lg:block flex-1 w-full relative ${domLayout === 'autoHeight' ? '' : 'min-h-0 h-full'}`}>
        <div ref={containerRef} className={`${gridTheme} ${domLayout === 'autoHeight' ? 'w-full' : 'absolute inset-0'}`}>
          <AgGridReact<T>
            ref={gridRef}
            rowData={effectiveData}
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
            pagination={isClientData && limit !== 99999}
            paginationPageSize={isClientData && limit !== 99999 ? limit : undefined}
            paginationPageSizeSelector={false}
            suppressPaginationPanel={true}
            onPaginationChanged={(e) => {
              if (isClientData) {
                setClientPage(e.api.paginationGetCurrentPage());
                setClientTotalPages(e.api.paginationGetTotalPages());
              }
            }}
            onGridReady={onGridReady}
            onFirstDataRendered={onFirstDataRendered}
            onStateUpdated={onStateUpdated}
            onBodyScroll={(e) => {
              if (gridKey && e.top === 0) {
                clearScrollState(gridKey);
              }
            }}
            onSortChanged={(e) => { lastActionRef.current = e.source ?? null; }}
            onFilterChanged={(e) => { lastActionRef.current = e.source ?? null; }}
            onModelUpdated={(e) => {
              setDisplayedRowCount(e.api.getDisplayedRowCount());
              if (isClientData) {
                setClientPage(e.api.paginationGetCurrentPage());
                setClientTotalPages(e.api.paginationGetTotalPages());
              }
              const nodes: T[] = [];
              e.api.forEachNodeAfterFilterAndSort(node => {
                if (node.data) nodes.push(node.data);
              });
              setSortedData(nodes);

              const filterModel = e.api.getFilterModel();
              const sortModel = e.api.getColumnState().filter(c => c.sort);
              
              let isSortedOrFiltered = Object.keys(filterModel).length > 0;
              if (sortModel.length > 0) {
                if (defaultSortModel && sortModel.length === defaultSortModel.length) {
                  const isDefaultSort = sortModel.every((sm, i) => sm.colId === defaultSortModel[i].colId && sm.sort === defaultSortModel[i].sort);
                  if (!isDefaultSort) isSortedOrFiltered = true;
                } else {
                  isSortedOrFiltered = true;
                }
              }
              
              const wasSortedOrFiltered = isGridFilteredRef.current;
              isGridFilteredRef.current = isSortedOrFiltered;
              
              if (!isClientData) {
                if (isSortedOrFiltered && !wasSortedOrFiltered) {
                  if (limit !== 99999) {
                    setPreviousLimit(limit);
                    setLimit(99999);
                  }
                } else if (!isSortedOrFiltered && wasSortedOrFiltered) {
                  if (limit === 99999) {
                    if (previousLimit !== null) {
                      setLimit(previousLimit);
                    } else if (!fetchAll || isMobile) {
                      setLimit(isMobile ? 25 : 200);
                    }
                  }
                }
              }
              
              setIsCustomView(!isClientData && (isSortedOrFiltered || (limit === 99999 && !fetchAll)));
              
              lastActionRef.current = null;
            }}
            onRowClicked={(onRowClicked || rowHref) ? handleRowClicked : undefined}
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
            quickFilterText={isClientData ? search : ""}
            {...(overlayNoRowsTemplate ? { overlayNoRowsTemplate: overlayNoRowsTemplate } : {})}
          />
        </div>
      </div>

      {/* Mobile Generic Card View */}
      <div className="lg:hidden flex-1 w-full flex flex-col gap-3 pb-24 mt-2">
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

          const isClientPaginated = isClientData && limit !== 99999;
          const dataToMap = sortedData.length > 0 ? sortedData : (effectiveData || []);
          const paginatedDataToMap = isClientPaginated
            ? dataToMap.slice(clientPage * limit, (clientPage + 1) * limit)
            : dataToMap;

          return paginatedDataToMap.map((row: T, idx: number) => {
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
            onRowClicked={(onRowClicked || rowHref) ? (r, e) => {
              const main = document.querySelector('main');
              if (main && gridKey) {
                sessionStorage.setItem(`datagrid-mobile-scroll-${gridKey}`, String(main.scrollTop));
              }
              if (rowHref) {
                const url = rowHref(r);
                if (e && (e.ctrlKey || e.metaKey)) {
                  window.open(url, '_blank');
                } else {
                  router.push(url);
                }
              } else if (onRowClicked) {
                onRowClicked(r, e as unknown as MouseEvent);
              }
            } : undefined} 
          />;
          });
        })()}
        {effectiveData && effectiveData.length > 0 && renderPaginationControls(true)}
      </div>
    </div>
  );

  if (pageTitle) {
    return (
      <div className="lg:h-full flex flex-col relative p-4 lg:p-6">
        <div className="relative lg:h-full flex flex-col">
          <div className="flex-1 lg:min-h-0 flex flex-col z-10 lg:bg-white lg:rounded-xl lg:-[0_2px_8px_rgba(0,0,0,0.04)] lg:border lg:border-[rgba(196,198,205,0.4)] lg:overflow-hidden transition-all">
             <div className="flex flex-col lg:flex-row lg:items-center justify-between lg:px-6 pt-4 pb-2 lg:pt-4 lg:pb-2 gap-4">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between lg:justify-start gap-4 w-full lg:w-auto">
                  <div className="flex items-center justify-between w-full lg:w-auto gap-4 min-w-0">
                    <div className="flex items-center gap-4 min-w-0">
                      <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] truncate min-w-0">
                        {pageTitle}
                      </h2>
                      <div className="hidden lg:block h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0"></div>
                      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase">
                          {tGrid('rowCountLabel')}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? '...' : displayedRowCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                      {headerActions && (
                        <div className="lg:hidden flex-1 flex items-center justify-end min-w-0 ml-4">
                          {headerActions}
                        </div>
                      )}
                  </div>
                </div>
                
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 w-full lg:w-auto relative pb-1 -mb-1">
                  <div className={`transition-all duration-300 lg:bg-transparent rounded-lg shrink-0 lg:shrink lg:min-w-[140px] ${search ? 'w-full lg:w-auto lg:flex-1 lg:max-w-[280px] lg:ml-6' : 'w-[44px] focus-within:w-full lg:focus-within:w-auto lg:w-auto lg:flex-1 lg:max-w-[280px] lg:ml-6'}`}>
                    {searchInputNode}
                  </div>
                  {(headerFilters || headerActions) && (
                    <div className={`w-full lg:w-auto flex-1 lg:flex-none ml-auto flex items-center justify-end gap-3 ${headerFilters ? '' : 'hidden lg:flex'}`}>
                      {headerFilters && (
                        <div className={`transition-all duration-500 rounded-lg ${isCustomView ? 'ring-2 ring-amber-500/40 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : ''}`}>
                          {headerFilters}
                        </div>
                      )}
                      {headerActions && (
                        <div className="hidden lg:block shrink-0">
                          {headerActions}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {gridContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col lg:bg-white relative ${domLayout === 'autoHeight' ? '' : 'lg:h-full flex-1 min-h-0'}`}>
      {renderHeader ? (
        renderHeader!({ searchInput: searchInputNode, optionsButton: null, rowCount: displayedRowCount, loading })
      ) : (
        <div className="flex items-center gap-3">
          {searchInputNode}
          <span className="text-xs text-[var(--text-muted)]">
            {loading ? tGrid('loadingEllipsis') : tGrid('rows', { count: String(displayedRowCount) })}
          </span>
        </div>
      )}
      {gridContent}
    </div>
  );
}
