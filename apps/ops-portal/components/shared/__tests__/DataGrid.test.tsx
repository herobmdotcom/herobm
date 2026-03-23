/**
 * DataGrid.test.tsx
 *
 * Tests the DataGrid component's URL construction for search, pagination,
 * and the includeArchived toggle — ensuring it sends the canonical `q=`
 * parameter and constructs paginated URLs correctly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataGrid from '../DataGrid';

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

describe('DataGrid', () => {
  let mockApiFetch: jest.Mock;

  beforeEach(() => {
    mockApiFetch = jest.fn().mockResolvedValue({ data: [] });
  });

  it('fetches data using canonical ?q= parameter when searching', async () => {
    render(
      <DataGrid
        endpoint="/api/products"
        columns={[{ field: 'name', headerName: 'Name' }]}
        apiFetch={mockApiFetch}
      />,
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });

    // The initial call should not have a q= param
    const initialUrl = mockApiFetch.mock.calls[0][0] as string;
    expect(initialUrl).not.toContain('q=');
    expect(initialUrl).toContain('page=1');
    expect(initialUrl).toContain('limit=');

    // Type a search term
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Search…');
    await user.type(input, 'widget');

    // Wait for the search-triggered re-fetch
    await waitFor(() => {
      // Should have been called again (debounced on each keystroke)
      const lastCall = mockApiFetch.mock.calls[mockApiFetch.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('q=widget');
    });
  });

  it('passes includeArchived=true when the toggle is enabled', async () => {
    render(
      <DataGrid
        endpoint="/api/products"
        columns={[{ field: 'name', headerName: 'Name' }]}
        apiFetch={mockApiFetch}
        showArchivedToggle
      />,
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });

    // Initial call should NOT include includeArchived
    const initialUrl = mockApiFetch.mock.calls[0][0] as string;
    expect(initialUrl).not.toContain('includeArchived');

    // Open options menu and toggle archived
    const user = userEvent.setup();
    const optionsBtn = screen.getByTitle('options');
    await user.click(optionsBtn);

    const archivedCheckbox = screen.getByRole('checkbox', { name: /includeArchived/i });
    await user.click(archivedCheckbox);

    // Verify the next fetch includes includeArchived=true
    await waitFor(() => {
      const lastCall = mockApiFetch.mock.calls[mockApiFetch.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('includeArchived=true');
    });
  });

  it('uses page=1 and resets pagination when searching', async () => {
    render(
      <DataGrid
        endpoint="/api/products"
        columns={[{ field: 'name', headerName: 'Name' }]}
        apiFetch={mockApiFetch}
      />,
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });

    // Type a search — pagination should reset to page=1
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Search…');
    await user.type(input, 'test');

    await waitFor(() => {
      const lastCall = mockApiFetch.mock.calls[mockApiFetch.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain('page=1');
      expect(lastCall).toContain('q=test');
    });
  });

  it('appends query params with & when endpoint already has ?', async () => {
    render(
      <DataGrid
        endpoint="/api/products?source=app"
        columns={[{ field: 'name', headerName: 'Name' }]}
        apiFetch={mockApiFetch}
      />,
    );

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });

    const url = mockApiFetch.mock.calls[0][0] as string;
    // Should NOT have double ?, should use & to separate
    expect(url).toMatch(/\?source=app&/);
    expect(url).not.toMatch(/\?\?/);
  });
});

/* ── localStorage helper tests ────────────────────────────────────── */
import {
  saveColumnState,
  loadColumnState,
  clearColumnState,
  STORAGE_PREFIX,
} from '../DataGrid';

describe('DataGrid — localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveColumnState + loadColumnState round-trip', () => {
    const state = [{ colId: 'name', width: 200, sort: 'asc' as const }] as any;
    saveColumnState('test-grid', state);
    const loaded = loadColumnState('test-grid');
    expect(loaded).toEqual(state);
  });

  it('loadColumnState returns null when key does not exist', () => {
    expect(loadColumnState('nonexistent')).toBeNull();
  });

  it('loadColumnState returns null for corrupted JSON', () => {
    localStorage.setItem(`${STORAGE_PREFIX}broken`, '{not valid json');
    expect(loadColumnState('broken')).toBeNull();
  });

  it('loadColumnState returns null when stored value is not an array', () => {
    localStorage.setItem(`${STORAGE_PREFIX}obj`, JSON.stringify({ foo: 'bar' }));
    expect(loadColumnState('obj')).toBeNull();
  });

  it('clearColumnState removes the stored key', () => {
    const state = [{ colId: 'a' }] as any;
    saveColumnState('to-clear', state);
    expect(loadColumnState('to-clear')).not.toBeNull();
    clearColumnState('to-clear');
    expect(loadColumnState('to-clear')).toBeNull();
  });

  it('saveColumnState handles quota exceeded gracefully', () => {
    // Override setItem to throw
    const origSetItem = localStorage.setItem;
    localStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    expect(() => saveColumnState('full', [{ colId: 'a' }] as any)).not.toThrow();
    localStorage.setItem = origSetItem;
  });
});
