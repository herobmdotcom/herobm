import { renderHook, waitFor } from '@testing-library/react';
import {
  useCustomFieldColumns,
  useEntityCustomFields,
  buildCustomFieldColumns,
  type CustomFieldJsonSchema,
} from '../useCustomFieldColumns';
import * as api from '@herobm/sdk';
import type { ValueGetterParams, ValueFormatterParams } from 'ag-grid-community';

jest.mock('@herobm/sdk', () => ({
  productsControllerGetSettings: jest.fn(),
  organizationsControllerGetSettings: jest.fn(),
  ordersControllerGetSettings: jest.fn(),
  purchaseOrdersControllerGetSettings: jest.fn(),
  workOrdersControllerGetSettings: jest.fn(),
  projectsControllerGetSettings: jest.fn(),
  glControllerGetSettings: jest.fn(),
}));

describe('useCustomFieldColumns', () => {
  const sampleSchema: CustomFieldJsonSchema = {
    type: 'object',
    properties: {
      warrantyMonths: {
        type: 'integer',
        title: 'Warranty (Months)',
      },
      isCertified: {
        type: 'boolean',
        title: 'Certified Product',
      },
      releaseDate: {
        type: 'string',
        format: 'date',
        title: 'Release Date',
      },
      materialGrade: {
        type: 'string',
        enum: ['Grade A', 'Grade B', 'Grade C'],
        title: 'Material Grade',
      },
      internalNotes: {
        type: 'string',
        title: 'Internal Notes',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when schema is null or invalid', () => {
    expect(buildCustomFieldColumns(null)).toEqual([]);
    expect(buildCustomFieldColumns(undefined)).toEqual([]);
    expect(buildCustomFieldColumns({})).toEqual([]);
    expect(buildCustomFieldColumns({ type: 'string' })).toEqual([]);
  });

  it('generates expected column definitions from JSON schema', () => {
    const cols = buildCustomFieldColumns(sampleSchema);
    expect(cols).toHaveLength(5);

    const [warrantyCol, certifiedCol, dateCol, gradeCol, notesCol] = cols;

    expect(warrantyCol.colId).toBe('custom_warrantyMonths');
    expect(warrantyCol.field).toBe('metadata.warrantyMonths');
    expect(warrantyCol.headerName).toBe('Warranty (Months)');
    expect(warrantyCol.type).toBe('numericColumn');
    expect(warrantyCol.hide).toBe(true);

    expect(certifiedCol.colId).toBe('custom_isCertified');
    expect(certifiedCol.headerName).toBe('Certified Product');
    expect(certifiedCol.hide).toBe(true);

    expect(dateCol.colId).toBe('custom_releaseDate');
    expect(dateCol.headerName).toBe('Release Date');

    expect(gradeCol.colId).toBe('custom_materialGrade');
    expect(gradeCol.headerName).toBe('Material Grade');

    expect(notesCol.colId).toBe('custom_internalNotes');
    expect(notesCol.headerName).toBe('Internal Notes');
  });

  it('extracts values using valueGetter correctly from metadata and customFields fallback', () => {
    const cols = buildCustomFieldColumns(sampleSchema);
    const [warrantyCol] = cols;

    const rowWithMetadata = {
      metadata: { warrantyMonths: 24 },
    };
    const rowWithCustomFields = {
      customFields: { warrantyMonths: 12 },
    };
    const rowEmpty = {
      metadata: {},
    };

    const getter = warrantyCol.valueGetter as (params: ValueGetterParams) => unknown;

    expect(getter({ data: rowWithMetadata } as ValueGetterParams)).toBe(24);
    expect(getter({ data: rowWithCustomFields } as ValueGetterParams)).toBe(12);
    expect(getter({ data: rowEmpty } as ValueGetterParams)).toBeNull();
    expect(getter({ data: null } as ValueGetterParams)).toBeNull();
  });

  it('formats numeric values properly with fallback for empty values', () => {
    const cols = buildCustomFieldColumns(sampleSchema);
    const [warrantyCol] = cols;
    const formatter = warrantyCol.valueFormatter as (params: ValueFormatterParams) => string;

    expect(formatter({ value: 36 } as ValueFormatterParams)).toBe('36');
    expect(formatter({ value: null } as ValueFormatterParams)).toBe('—');
    expect(formatter({ value: '' } as ValueFormatterParams)).toBe('—');
  });

  it('formats boolean values with customizable Yes/No labels', () => {
    const cols = buildCustomFieldColumns(sampleSchema, {
      booleanTrueLabel: 'Active',
      booleanFalseLabel: 'Inactive',
    });
    const certifiedCol = cols[1];
    const formatter = certifiedCol.valueFormatter as (params: ValueFormatterParams) => string;

    expect(formatter({ value: true } as ValueFormatterParams)).toBe('Active');
    expect(formatter({ value: false } as ValueFormatterParams)).toBe('Inactive');
    expect(formatter({ value: null } as ValueFormatterParams)).toBe('—');
  });

  it('formats dates properly', () => {
    const cols = buildCustomFieldColumns(sampleSchema);
    const dateCol = cols[2];
    const formatter = dateCol.valueFormatter as (params: ValueFormatterParams) => string;

    const result = formatter({ value: '2026-05-15' } as ValueFormatterParams);
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
    expect(formatter({ value: null } as ValueFormatterParams)).toBe('—');
  });

  it('memoizes correctly inside renderHook', () => {
    const { result, rerender } = renderHook(
      ({ schema }) => useCustomFieldColumns(schema),
      { initialProps: { schema: sampleSchema } },
    );

    expect(result.current).toHaveLength(5);
    const firstCols = result.current;

    rerender({ schema: sampleSchema });
    expect(result.current).toBe(firstCols);
  });

  it('fetches schema dynamically via useEntityCustomFields for given entityType', async () => {
    (api.productsControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        productMetadataSchema: {
          type: 'object',
          properties: {
            brandName: { type: 'string', title: 'Brand' },
          },
        },
      },
    });

    const { result } = renderHook(() => useEntityCustomFields('products'));

    await waitFor(() => {
      expect(result.current.columns).toHaveLength(1);
      expect(result.current.columns[0].headerName).toBe('Brand');
    });
  });
});
