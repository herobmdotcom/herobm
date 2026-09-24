import { exportDataToExcel } from '../datagrid/DataGridExportHelpers';
import writeXlsxFile from 'write-excel-file/browser';
import type { ColDef } from 'ag-grid-community';

jest.mock('write-excel-file/browser', () => {
  const mockToFile = jest.fn().mockResolvedValue(undefined);
  const mockToBlob = jest.fn().mockResolvedValue(new Blob([]));
  const mockFn = jest.fn().mockReturnValue({
    toFile: mockToFile,
    toBlob: mockToBlob,
  });
  return {
    __esModule: true,
    default: mockFn,
  };
});

describe('DataGridExportHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('correctly constructs sheet data with formatted headers and typed cells', async () => {
    const columns: ColDef[] = [
      { field: 'sku', headerName: 'SKU' },
      { field: 'price', headerName: 'Price', type: 'numericColumn' },
      { field: 'inStock', headerName: 'In Stock' },
      { field: 'createdAt', headerName: 'Created At' },
    ];

    const testDate = new Date('2026-01-15T00:00:00Z');
    const data = [
      {
        sku: 'WIDGET-01',
        price: 49.99,
        inStock: true,
        createdAt: testDate,
      },
      {
        sku: 'GADGET-02',
        price: '120.50',
        inStock: false,
        createdAt: null,
      },
    ];

    const getExportValue = (col: ColDef, row: Record<string, unknown>) => {
      return row[col.field as string];
    };

    await exportDataToExcel({
      fileName: 'products_export.xlsx',
      columns,
      data,
      getExportValue,
    });

    expect(writeXlsxFile).toHaveBeenCalledTimes(1);

    const [sheetData, options] = (writeXlsxFile as jest.Mock).mock.calls[0];

    // Verify Header Row
    expect(sheetData[0]).toEqual([
      { value: 'SKU', fontWeight: 'bold', backgroundColor: '#F1F5F9', align: 'left' },
      { value: 'Price', fontWeight: 'bold', backgroundColor: '#F1F5F9', align: 'right' },
      { value: 'In Stock', fontWeight: 'bold', backgroundColor: '#F1F5F9', align: 'left' },
      { value: 'Created At', fontWeight: 'bold', backgroundColor: '#F1F5F9', align: 'left' },
    ]);

    // Verify First Data Row (typed Number, Boolean, Date, String)
    expect(sheetData[1]).toEqual([
      { type: String, value: 'WIDGET-01' },
      { type: Number, value: 49.99, align: 'right' },
      { type: Boolean, value: true },
      { type: Date, value: testDate, format: 'yyyy-mm-dd' },
    ]);

    // Verify Second Data Row (numeric string parsed to Number, null handled)
    expect(sheetData[2]).toEqual([
      { type: String, value: 'GADGET-02' },
      { type: Number, value: 120.50, align: 'right' },
      { type: Boolean, value: false },
      null,
    ]);

    // Verify Options
    expect(options.sheet).toBe('Data');
    expect(options.stickyRowsCount).toBe(1);
    expect(options.columns).toBeDefined();
    expect(options.columns.length).toBe(4);
  });
});
