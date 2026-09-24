import writeXlsxFile, { type Cell, type Row, type SheetData } from 'write-excel-file/browser';
import type { ColDef } from 'ag-grid-community';

export interface ExportToExcelOptions<T> {
  fileName: string;
  columns: ColDef<T>[];
  data: Record<string, unknown>[];
  getExportValue: (col: ColDef<T>, row: Record<string, unknown>) => unknown;
  sheetName?: string;
}

/**
 * Exports tabular data to an Excel (.xlsx) spreadsheet in the browser.
 */
export async function exportDataToExcel<T>({
  fileName,
  columns,
  data,
  getExportValue,
  sheetName = 'Data',
}: ExportToExcelOptions<T>): Promise<void> {
  // 1. Header Row
  const headerRow: Row = columns.map((col) => ({
    value: (col.headerName || col.field || '') as string,
    fontWeight: 'bold',
    backgroundColor: '#F1F5F9',
    align: col.type === 'numericColumn' ? 'right' : 'left',
  }));

  // 2. Data Rows
  const dataRows: Row[] = data.map((row) => {
    return columns.map((col) => {
      const rawVal = getExportValue(col, row);

      if (rawVal === null || rawVal === undefined || rawVal === '') {
        return null;
      }

      if (typeof rawVal === 'number') {
        return {
          type: Number,
          value: rawVal,
          align: 'right',
        } as Cell;
      }

      if (col.type === 'numericColumn' && typeof rawVal === 'string' && !isNaN(Number(rawVal)) && rawVal.trim() !== '') {
        return {
          type: Number,
          value: Number(rawVal),
          align: 'right',
        } as Cell;
      }

      if (typeof rawVal === 'boolean') {
        return {
          type: Boolean,
          value: rawVal,
        } as Cell;
      }

      if (rawVal instanceof Date) {
        return {
          type: Date,
          value: rawVal,
          format: 'yyyy-mm-dd',
        } as Cell;
      }

      return {
        type: String,
        value: String(rawVal),
      } as Cell;
    });
  });

  const sheetData: SheetData = [headerRow, ...dataRows];

  // 3. Estimate Column Widths
  const columnWidths = columns.map((col) => {
    const headerText = (col.headerName || col.field || '').toString();
    let maxLen = headerText.length;
    const sampleSize = Math.min(data.length, 100);
    for (let r = 0; r < sampleSize; r++) {
      const row = data[r];
      if (!row) continue;
      const cellVal = getExportValue(col, row);
      if (cellVal != null) {
        const str = String(cellVal);
        if (str.length > maxLen) {
          maxLen = str.length;
        }
      }
    }
    return { width: Math.min(Math.max(maxLen + 3, 10), 50) };
  });

  // 4. Generate & Download
  const excelHandler = writeXlsxFile(sheetData, {
    sheet: sheetName,
    stickyRowsCount: 1,
    columns: columnWidths,
  });

  if (excelHandler && typeof excelHandler.toFile === 'function') {
    await excelHandler.toFile(fileName);
  }
}
