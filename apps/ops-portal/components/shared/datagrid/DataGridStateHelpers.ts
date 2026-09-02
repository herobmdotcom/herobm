import { GridState, ScrollState } from "ag-grid-community";

export const STORAGE_PREFIX = "datagrid-state-";

export function saveGridState(gridKey: string, state: GridState): void {
  try {
    // Strip scroll — it lives in sessionStorage separately
    const { scroll: _scroll, ...rest } = state;
    localStorage.setItem(`${STORAGE_PREFIX}${gridKey}`, JSON.stringify(rest));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function loadGridState(gridKey: string): GridState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gridKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GridState;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    // harmless: corrupt/invalid JSON in storage
    return null;
  }
}

export function clearGridState(gridKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gridKey}`);
  } catch {
    /* ignore */
  }
}

export const SCROLL_STORAGE_PREFIX = "datagrid-scroll-";

export function saveScrollState(gridKey: string, scroll: ScrollState): void {
  try {
    sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${gridKey}`, JSON.stringify(scroll));
  } catch {
    /* ignore */
  }
}

export function clearScrollState(gridKey: string): void {
  try {
    sessionStorage.removeItem(`${SCROLL_STORAGE_PREFIX}${gridKey}`);
    sessionStorage.removeItem(`datagrid-mobile-scroll-${gridKey}`);
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
    // harmless: corrupt/invalid JSON in storage
    return null;
  }
}
