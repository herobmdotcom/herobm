/**
 * numericFormatter.test.ts
 *
 * Tests the pure numericFormatter function exported from DataGrid.
 * This function formats numbers for display in AG Grid cells:
 * - null/undefined → empty string
 * - NaN strings → returned as-is
 * - Integers → locale-formatted without decimals
 * - Decimals → locale-formatted with exactly 2 decimal places
 */
import { numericFormatter } from '../datagrid/DataGridFormatters';

// Mock ag-grid-community (imported by DataGrid at module level)
jest.mock('ag-grid-community', () => ({
  AllCommunityModule: {},
  ModuleRegistry: { registerModules: jest.fn() },
}));

// Mock ag-grid-react
jest.mock('ag-grid-react', () => ({
  AgGridReact: () => null,
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('numericFormatter', () => {
  it('returns empty string for null', () => {
    expect(numericFormatter({ value: null })).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(numericFormatter({ value: undefined })).toBe('');
  });

  it('returns the original string for non-numeric values', () => {
    expect(numericFormatter({ value: 'abc' })).toBe('abc');
  });

  it('formats integers without decimal places', () => {
    const result = numericFormatter({ value: 1000 });
    // toLocaleString may add a comma: "1,000"
    expect(result).toMatch(/1[,.]?000/);
  });

  it('formats decimals with exactly 2 decimal places', () => {
    const result = numericFormatter({ value: 12.5 });
    // Should be something like "12.50"
    expect(result).toMatch(/12[.,]50/);
  });

  it('formats zero as an integer', () => {
    expect(numericFormatter({ value: 0 })).toBe('0');
  });

  it('handles string numbers correctly', () => {
    const result = numericFormatter({ value: '99.9' });
    expect(result).toMatch(/99[.,]90/);
  });

  it('handles negative numbers', () => {
    const result = numericFormatter({ value: -42 });
    expect(result).toMatch(/-42/);
  });
});
