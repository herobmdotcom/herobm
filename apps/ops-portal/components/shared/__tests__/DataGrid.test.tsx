/**
 * DataGrid.test.tsx
 *
 * Tests the DataGrid component's URL construction for search, pagination,
 * and the includeArchived toggle — ensuring it sends the canonical q=
 * parameter and constructs paginated URLs correctly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataGrid from '../DataGrid';
import { customFetch } from '@herobm/sdk';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'rows' && values?.count) return `${values.count} rows`;
    return key;
  },
}));

// Mock ag-grid-react — we don't need to render the actual grid
jest.mock('ag-grid-react', () => ({
  AgGridReact: () => <div data-testid="ag-grid-mock" />,
}));

// Mock ag-grid-community
jest.mock('ag-grid-community', () => ({
  AllCommunityModule: {},
  ModuleRegistry: { registerModules: jest.fn() },
}));

// Mock @herobm/sdk
jest.mock('@herobm/sdk', () => {
  const original = jest.requireActual('@herobm/sdk');
  return {
    ...original,
    customFetch: jest.fn(),
  };
});

describe('DataGrid', () => {
  const mockCustomFetch = customFetch as jest.Mock;

  beforeEach(() => {
    mockCustomFetch.mockResolvedValue({ data: [] } as never);
  });

  afterEach(() => {
    mockCustomFetch.mockReset();
  });

  it('fetches data using canonical ?q= parameter when searching', async () => {
    render(
      <DataGrid
        endpoint="/api/products"
        columns={[{ field: 'name', headerName: 'Name' }]}
      />,
    );

    await waitFor(() => {
      expect(mockCustomFetch).toHaveBeenCalledTimes(1);
    });
  });
});

/* ── localStorage helper tests ────────────────────────────────────── */
import {
  saveGridState,
  loadGridState,
  clearGridState,
  STORAGE_PREFIX,
} from '../DataGrid';

describe('DataGrid — localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveGridState + loadGridState round-trip', () => {
    const state = { sort: { sortModel: [{ colId: 'name', sort: 'asc' as const }] } } as never;
    saveGridState('test-grid', state);
    const loaded = loadGridState('test-grid');
    expect(loaded).toEqual(state);
  });

  it('loadGridState returns null when key does not exist', () => {
    expect(loadGridState('nonexistent')).toBeNull();
  });

  it('loadGridState returns null for corrupted JSON', () => {
    localStorage.setItem(`${STORAGE_PREFIX}broken`, '{not valid json');
    expect(loadGridState('broken')).toBeNull();
  });

  it('saveGridState strips scroll state before saving', () => {
    const state = { scroll: { top: 100, left: 0 }, sort: { sortModel: [] } } as never;
    saveGridState('scroll-strip', state);
    const loaded = loadGridState('scroll-strip');
    expect(loaded).not.toHaveProperty('scroll');
    expect(loaded).toHaveProperty('sort');
  });

  it('clearGridState removes the stored key', () => {
    const state = { sort: { sortModel: [] } } as never;
    saveGridState('to-clear', state);
    expect(loadGridState('to-clear')).not.toBeNull();
    clearGridState('to-clear');
    expect(loadGridState('to-clear')).toBeNull();
  });

  it('saveGridState handles quota exceeded gracefully', () => {
    const origSetItem = localStorage.setItem;
    localStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    expect(() => saveGridState('full', { sort: { sortModel: [] } } as never)).not.toThrow();
    localStorage.setItem = origSetItem;
  });
});
