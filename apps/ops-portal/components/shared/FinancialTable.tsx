'use client';

import React, { useImperativeHandle, forwardRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import writeXlsxFile, { type Cell, type Row, type SheetData } from 'write-excel-file/browser';
import { Button } from './Button';
import { FinancialExportMenu } from './FinancialExportMenu';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

export interface FinancialTableColumn<T = Record<string, unknown>> {
  /** Unique column identifier */
  id: string;
  /** Column header text or React node */
  header: React.ReactNode;
  /** Header export text (used if header is a ReactNode, falls back to string header or id) */
  headerExportName?: string;
  /** Property key or accessor function on row object */
  accessor?: keyof T | ((row: T) => unknown);
  /** Custom cell render function */
  render?: (row: T, index: number, sectionIndex?: number) => React.ReactNode;
  /** Custom export value formatter for CSV/Excel */
  exportValue?: (row: T, index: number, sectionIndex?: number) => string | number | null | undefined;
  /** Text alignment (default: 'left' or 'right' if isNumeric) */
  align?: 'left' | 'center' | 'right';
  /** Width specification (e.g. '120px', '25%') */
  width?: string | number;
  /** If true, formats cell with right-align and monospace tabular numbers */
  isNumeric?: boolean;
  /** Custom CSS class for column cells */
  className?: string | ((row: T) => string);
  /** Custom CSS class for column header */
  headerClassName?: string;
  /** Hide column from display and export */
  hidden?: boolean;
}

export interface FinancialTableSubtotal {
  label?: React.ReactNode;
  exportLabel?: string;
  values: Record<string, string | number | React.ReactNode>;
  exportValues?: Record<string, string | number | null | undefined>;
  colSpanLabel?: number;
  className?: string;
}

export interface FinancialTableSection<T = Record<string, unknown>> {
  id: string;
  title?: React.ReactNode;
  exportTitle?: string;
  badge?: React.ReactNode;
  rows: T[];
  subtotal?: FinancialTableSubtotal;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  headerClassName?: string;
}

export interface FinancialTableTotalRow {
  label?: React.ReactNode;
  exportLabel?: string;
  values: Record<string, string | number | React.ReactNode>;
  exportValues?: Record<string, string | number | null | undefined>;
  colSpanLabel?: number;
  className?: string;
}

export interface FinancialReportMetadata {
  title?: string;
  subtitle?: string;
  organization?: string;
  period?: string;
  asOfDate?: string;
  currency?: string;
  generatedAt?: string;
  extra?: Record<string, string>;
}

export interface FinancialTableHandle {
  exportCsv: () => void;
  exportExcel: () => Promise<void>;
}

export interface FinancialTableProps<T = Record<string, unknown>> {
  columns: FinancialTableColumn<T>[];
  /** Flat data array (mutually exclusive with sections) */
  data?: T[];
  /** Sectioned data array (mutually exclusive with flat data) */
  sections?: FinancialTableSection<T>[];
  /** Grand total row(s) for table footer */
  totals?: FinancialTableTotalRow | FinancialTableTotalRow[];
  /** Key extractor function */
  keyExtractor: (row: T, index: number, sectionIndex?: number) => string | number;
  /** Loading state indicator */
  loading?: boolean;
  /** Custom loading message */
  loadingMessage?: React.ReactNode;
  /** Empty state message */
  emptyMessage?: React.ReactNode;
  /** Report metadata for export headers */
  reportMetadata?: FinancialReportMetadata;
  /** Base filename for CSV/Excel download (without extension) */
  exportFileName?: string;
  /** Show built-in export menu button in table header toolbar */
  showExportButton?: boolean;
  /** Custom header actions / controls */
  headerActions?: React.ReactNode;
  /** Table title displayed above the table */
  title?: React.ReactNode;
  /** Custom CSS class for outermost wrapper */
  className?: string;
  /** Custom CSS class for card container */
  cardClassName?: string;
  /** Custom CSS class for table element */
  tableClassName?: string;
  /** Optional row click handler */
  onRowClick?: (row: T, index: number, sectionIndex?: number) => void;
  /** Predicate determining if a row is expanded */
  isRowExpanded?: (row: T, index: number, sectionIndex?: number) => boolean;
  /** Custom renderer for expanded sub-row content */
  renderExpandedRow?: (row: T, index: number, sectionIndex?: number) => React.ReactNode;
  /** Custom CSS class for row */
  rowClassName?: string | ((row: T, index: number, sectionIndex?: number) => string);
  /** Optional callback fired after CSV export triggers */
  onExportCsv?: () => void;
  /** Optional callback fired after Excel export triggers */
  onExportExcel?: () => void;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const FinancialTable = forwardRef(function FinancialTable<T>(
  {
    columns,
    data,
    sections,
    totals,
    keyExtractor,
    loading = false,
    loadingMessage,
    emptyMessage,
    reportMetadata,
    exportFileName = 'financial-report',
    showExportButton = false,
    headerActions,
    title,
    className = '',
    cardClassName = '',
    tableClassName = '',
    onRowClick,
    isRowExpanded,
    renderExpandedRow,
    rowClassName,
    onExportCsv,
    onExportExcel,
  }: FinancialTableProps<T>,
  ref: React.ForwardedRef<FinancialTableHandle>,
) {
  const tCommon = useTranslations('common');
  const visibleCols = columns.filter((col) => !col.hidden);

  const resolveColSpanLabel = useCallback(
    (totalRow: FinancialTableTotalRow | FinancialTableSubtotal) => {
      if (totalRow.colSpanLabel !== undefined) {
        return totalRow.colSpanLabel;
      }
      const firstValIdx = visibleCols.findIndex(
        (col) =>
          (totalRow.values && col.id in totalRow.values && totalRow.values[col.id] !== undefined) ||
          (totalRow.exportValues && col.id in totalRow.exportValues && totalRow.exportValues[col.id] !== undefined),
      );
      return firstValIdx > 0 ? firstValIdx : 1;
    },
    [visibleCols],
  );

  const exportToCsv = useCallback(() => {
    const lines: string[] = [];

    // 1. Report Metadata Header
    if (reportMetadata) {
      if (reportMetadata.organization) lines.push(`Organization:,${escapeCsvCell(reportMetadata.organization)}`);
      if (reportMetadata.title) lines.push(`Report:,${escapeCsvCell(reportMetadata.title)}`);
      if (reportMetadata.subtitle) lines.push(`Subtitle:,${escapeCsvCell(reportMetadata.subtitle)}`);
      if (reportMetadata.period) lines.push(`Fiscal Period:,${escapeCsvCell(reportMetadata.period)}`);
      if (reportMetadata.asOfDate) lines.push(`As Of Date:,${escapeCsvCell(reportMetadata.asOfDate)}`);
      if (reportMetadata.currency) lines.push(`Currency:,${escapeCsvCell(reportMetadata.currency)}`);
      lines.push(`Generated On:,${escapeCsvCell(reportMetadata.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' '))}`);
      if (reportMetadata.extra) {
        for (const [k, v] of Object.entries(reportMetadata.extra)) {
          lines.push(`${escapeCsvCell(k)}:,${escapeCsvCell(v)}`);
        }
      }
      lines.push(''); // Blank line after metadata
    }

    // 2. Table Column Headers
    const headerRow = visibleCols.map((col) => {
      const headerText = col.headerExportName || (typeof col.header === 'string' ? col.header : col.id);
      return escapeCsvCell(headerText);
    });
    lines.push(headerRow.join(','));

    // Helper to format a row into CSV cells
    const formatRowCells = (row: T, rowIndex: number, sectionIndex?: number) => {
      return visibleCols.map((col) => {
        if (col.exportValue) {
          const val = col.exportValue(row, rowIndex, sectionIndex);
          return escapeCsvCell(val);
        }
        if (col.accessor) {
          const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
          return escapeCsvCell(val);
        }
        return '';
      });
    };

    // Helper to format a subtotal/total row into CSV
    const formatTotalRowCells = (totalRow: FinancialTableTotalRow | FinancialTableSubtotal, defaultLabel: string) => {
      const labelText = totalRow.exportLabel || (typeof totalRow.label === 'string' ? totalRow.label : defaultLabel);
      const colSpan = resolveColSpanLabel(totalRow);

      const cells: string[] = [escapeCsvCell(labelText)];
      for (let i = 1; i < colSpan; i++) {
        cells.push('');
      }

      for (let i = colSpan; i < visibleCols.length; i++) {
        const col = visibleCols[i];
        const val = totalRow.exportValues?.[col.id] !== undefined
          ? totalRow.exportValues[col.id]
          : totalRow.values[col.id];
        cells.push(escapeCsvCell(val));
      }

      return cells;
    };

    // 3. Rows
    if (sections && sections.length > 0) {
      sections.forEach((section, sIdx) => {
        if (section.title || section.exportTitle) {
          const sTitle = section.exportTitle || (typeof section.title === 'string' ? section.title : `Section ${sIdx + 1}`);
          lines.push(`"${sTitle.replace(/"/g, '""')}"`);
        }

        section.rows.forEach((row, rIdx) => {
          lines.push(formatRowCells(row, rIdx, sIdx).join(','));
        });

        if (section.subtotal) {
          lines.push(formatTotalRowCells(section.subtotal, 'Subtotal').join(','));
        }
      });
    } else if (data && data.length > 0) {
      data.forEach((row, rIdx) => {
        lines.push(formatRowCells(row, rIdx).join(','));
      });
    }

    // 4. Totals Footer
    if (totals) {
      const totalsList = Array.isArray(totals) ? totals : [totals];
      totalsList.forEach((tot) => {
        lines.push(formatTotalRowCells(tot, 'Total').join(','));
      });
    }

    // 5. Download with UTF-8 BOM
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedFileName = (exportFileName || 'financial-report').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    link.download = `${sanitizedFileName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }

    onExportCsv?.();
  }, [visibleCols, data, sections, totals, reportMetadata, exportFileName, onExportCsv, resolveColSpanLabel]);

  const exportToExcel = useCallback(async () => {
    try {
      const excelRows: Row[] = [];

      // 1. Report Metadata Header
      if (reportMetadata) {
        if (reportMetadata.organization) {
          excelRows.push([{ value: 'Organization:', fontWeight: 'bold' }, { value: reportMetadata.organization }]);
        }
        if (reportMetadata.title) {
          excelRows.push([{ value: 'Report:', fontWeight: 'bold' }, { value: reportMetadata.title }]);
        }
        if (reportMetadata.subtitle) {
          excelRows.push([{ value: 'Subtitle:', fontWeight: 'bold' }, { value: reportMetadata.subtitle }]);
        }
        if (reportMetadata.period) {
          excelRows.push([{ value: 'Fiscal Period:', fontWeight: 'bold' }, { value: reportMetadata.period }]);
        }
        if (reportMetadata.asOfDate) {
          excelRows.push([{ value: 'As Of Date:', fontWeight: 'bold' }, { value: reportMetadata.asOfDate }]);
        }
        if (reportMetadata.currency) {
          excelRows.push([{ value: 'Currency:', fontWeight: 'bold' }, { value: reportMetadata.currency }]);
        }
        excelRows.push([
          { value: 'Generated On:', fontWeight: 'bold' },
          { value: reportMetadata.generatedAt || new Date().toISOString().slice(0, 19).replace('T', ' ') },
        ]);
        if (reportMetadata.extra) {
          for (const [k, v] of Object.entries(reportMetadata.extra)) {
            excelRows.push([{ value: `${k}:`, fontWeight: 'bold' }, { value: v }]);
          }
        }
        excelRows.push([]); // Blank separator row
      }

      // 2. Table Column Headers
      const headerRow: Row = visibleCols.map((col) => {
        const headerText = col.headerExportName || (typeof col.header === 'string' ? col.header : col.id);
        return {
          value: headerText,
          fontWeight: 'bold',
          backgroundColor: '#F1F5F9',
          align: col.align === 'right' || col.isNumeric ? 'right' : col.align === 'center' ? 'center' : 'left',
        };
      });
      excelRows.push(headerRow);

      // Helper to format data cell for Excel
      const formatExcelCell = (col: FinancialTableColumn<T>, row: T, rowIndex: number, sectionIndex?: number): Cell => {
        let rawVal: unknown;
        if (col.exportValue) {
          rawVal = col.exportValue(row, rowIndex, sectionIndex);
        } else if (col.accessor) {
          rawVal = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
        }

        if (rawVal === null || rawVal === undefined || rawVal === '') {
          return null;
        }

        const isNum = col.isNumeric || col.align === 'right';

        if (typeof rawVal === 'number') {
          return {
            type: Number,
            value: rawVal,
            align: 'right',
          };
        }

        if (isNum && typeof rawVal === 'string' && !isNaN(Number(rawVal)) && rawVal.trim() !== '') {
          return {
            type: Number,
            value: Number(rawVal),
            align: 'right',
          };
        }

        if (typeof rawVal === 'boolean') {
          return {
            type: Boolean,
            value: rawVal,
          };
        }

        if (rawVal instanceof Date) {
          return {
            type: Date,
            value: rawVal,
            format: 'yyyy-mm-dd',
          };
        }

        return {
          type: String,
          value: String(rawVal),
          align: col.align === 'center' ? 'center' : (col.align === 'right' ? 'right' : 'left'),
        };
      };

      // Helper to format total/subtotal row for Excel
      const formatExcelTotalRow = (
        totalRow: FinancialTableTotalRow | FinancialTableSubtotal,
        defaultLabel: string,
        bgColor: string = '#F1F5F9',
      ): Row => {
        const labelText = totalRow.exportLabel || (typeof totalRow.label === 'string' ? totalRow.label : defaultLabel);
        const colSpan = resolveColSpanLabel(totalRow);

        const cells: Cell[] = [
          {
            value: labelText,
            fontWeight: 'bold',
            backgroundColor: bgColor,
            align: 'left',
          },
        ];

        for (let i = 1; i < colSpan; i++) {
          cells.push(null);
        }

        for (let i = colSpan; i < visibleCols.length; i++) {
          const col = visibleCols[i];
          const rawVal = totalRow.exportValues?.[col.id] !== undefined
            ? totalRow.exportValues[col.id]
            : totalRow.values[col.id];

          if (rawVal === null || rawVal === undefined || rawVal === '') {
            cells.push({
              value: '',
              fontWeight: 'bold',
              backgroundColor: bgColor,
            });
            continue;
          }

          if (typeof rawVal === 'number') {
            cells.push({
              type: Number,
              value: rawVal,
              fontWeight: 'bold',
              backgroundColor: bgColor,
              align: 'right',
            });
          } else if (typeof rawVal === 'string' && !isNaN(Number(rawVal)) && rawVal.trim() !== '') {
            cells.push({
              type: Number,
              value: Number(rawVal),
              fontWeight: 'bold',
              backgroundColor: bgColor,
              align: 'right',
            });
          } else {
            cells.push({
              type: String,
              value: String(rawVal),
              fontWeight: 'bold',
              backgroundColor: bgColor,
              align: col.align === 'right' || col.isNumeric ? 'right' : 'left',
            });
          }
        }

        return cells;
      };

      // 3. Rows
      if (sections && sections.length > 0) {
        sections.forEach((section, sIdx) => {
          if (section.title || section.exportTitle) {
            const sTitle = section.exportTitle || (typeof section.title === 'string' ? section.title : `Section ${sIdx + 1}`);
            excelRows.push([{ value: sTitle, fontWeight: 'bold', backgroundColor: '#E2E8F0' }]);
          }

          section.rows.forEach((row, rIdx) => {
            excelRows.push(visibleCols.map((col) => formatExcelCell(col, row, rIdx, sIdx)));
          });

          if (section.subtotal) {
            excelRows.push(formatExcelTotalRow(section.subtotal, 'Subtotal', '#F8FAFC'));
          }
        });
      } else if (data && data.length > 0) {
        data.forEach((row, rIdx) => {
          excelRows.push(visibleCols.map((col) => formatExcelCell(col, row, rIdx)));
        });
      }

      // 4. Totals Footer
      if (totals) {
        const totalsList = Array.isArray(totals) ? totals : [totals];
        totalsList.forEach((tot) => {
          excelRows.push(formatExcelTotalRow(tot, 'Total', '#F1F5F9'));
        });
      }

      // 5. Estimate Column Widths
      const columnWidths = visibleCols.map((col) => {
        const headerText = (col.headerExportName || (typeof col.header === 'string' ? col.header : col.id) || '').toString();
        let maxLen = headerText.length;
        const allRows = sections ? sections.flatMap((s) => s.rows) : (data || []);
        const sampleSize = Math.min(allRows.length, 100);
        for (let r = 0; r < sampleSize; r++) {
          const row = allRows[r];
          if (!row) continue;
          let cellVal: unknown;
          if (col.exportValue) {
            cellVal = col.exportValue(row, r);
          } else if (col.accessor) {
            cellVal = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
          }
          if (cellVal != null) {
            const str = String(cellVal);
            if (str.length > maxLen) {
              maxLen = str.length;
            }
          }
        }
        return { width: Math.min(Math.max(maxLen + 3, 12), 50) };
      });

      // 6. Generate & Download Excel
      const sanitizedFileName = (exportFileName || 'financial-report').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const fileName = `${sanitizedFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const excelHandler = writeXlsxFile(excelRows, {
        sheet: 'Report',
        stickyRowsCount: reportMetadata ? 0 : 1,
        columns: columnWidths,
      });

      if (excelHandler && typeof excelHandler.toFile === 'function') {
        await excelHandler.toFile(fileName);
      }

      onExportExcel?.();
    } catch (e) {
      reportError(e, 'FinancialTable.exportExcel');
      toast.error('Excel export failed: ' + getErrorMessage(e));
    }
  }, [visibleCols, data, sections, totals, reportMetadata, exportFileName, resolveColSpanLabel, onExportExcel]);

  useImperativeHandle(ref, () => ({
    exportCsv: exportToCsv,
    exportExcel: exportToExcel,
  }), [exportToCsv, exportToExcel]);

  const renderCellContent = (col: FinancialTableColumn<T>, row: T, rowIndex: number, sectionIndex?: number) => {
    if (col.render) {
      return col.render(row, rowIndex, sectionIndex);
    }
    if (col.accessor) {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
      return val !== null && val !== undefined ? String(val as unknown) : '';
    }
    return null;
  };

  const getColAlignmentClass = (col: FinancialTableColumn<T>) => {
    if (col.align === 'right' || (col.isNumeric && col.align !== 'left' && col.align !== 'center')) {
      return 'text-right font-mono tabular-nums';
    }
    if (col.align === 'center') {
      return 'text-center';
    }
    return 'text-left';
  };

  const totalRowsList = totals ? (Array.isArray(totals) ? totals : [totals]) : [];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Optional Top Toolbar */}
      {(title || showExportButton || headerActions) && (
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            {title && (typeof title === 'string' ? (
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">{title}</h3>
            ) : (
              title
            ))}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {showExportButton && (
              <FinancialExportMenu
                onExportCsv={exportToCsv}
                onExportExcel={exportToExcel}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className={`card overflow-x-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-xl ${cardClassName}`}>
        <table className={`w-full text-sm border-collapse ${tableClassName}`}>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
              {visibleCols.map((col) => {
                const alignClass = getColAlignmentClass(col);
                return (
                  <th
                    key={col.id}
                    className={`px-4 py-3 font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider ${alignClass} ${col.headerClassName || ''}`}
                    /* inline-style-allowed: Dynamic column width specified by column definition */
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  <div className="animate-pulse">
                    {loadingMessage || tCommon('grid.loadingEllipsis')}
                  </div>
                </td>
              </tr>
            ) : sections && sections.length > 0 ? (
              sections.map((section, sIdx) => (
                <React.Fragment key={section.id || sIdx}>
                  {/* Section Title Header */}
                  {section.title && (
                    <tr className={`bg-[var(--bg-secondary)]/80 font-semibold border-b border-[var(--border)] ${section.headerClassName || ''}`}>
                      <td colSpan={visibleCols.length} className="px-4 py-2.5 text-[var(--text-primary)] text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {section.onToggleCollapse && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={section.onToggleCollapse}
                                className="p-0.5 h-auto rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-0"
                              >
                                {section.isCollapsed ? (
                                  <span className="material-symbols-outlined text-sm">expand_more</span>
                                ) : (
                                  <span className="material-symbols-outlined text-sm">expand_less</span>
                                )}
                              </Button>
                            )}
                            <span>{section.title}</span>
                            {section.badge}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Section Detail Rows */}
                  {!section.isCollapsed && (
                    <>
                      {section.rows.length === 0 ? (
                        <tr>
                          <td colSpan={visibleCols.length} className="px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                            {emptyMessage || tCommon('na')}
                          </td>
                        </tr>
                      ) : (
                        section.rows.map((row, rIdx) => {
                          const rowKey = keyExtractor(row, rIdx, sIdx);
                          const isExpanded = isRowExpanded?.(row, rIdx, sIdx);
                          const rowCustomClass = typeof rowClassName === 'function' ? rowClassName(row, rIdx, sIdx) : rowClassName || '';
                          return (
                            <React.Fragment key={rowKey}>
                              <tr
                                onClick={onRowClick ? () => onRowClick(row, rIdx, sIdx) : undefined}
                                className={`border-b border-[var(--border)] transition-colors ${
                                  onRowClick ? 'cursor-pointer hover:bg-[var(--bg-hover)] select-none' : 'hover:bg-[var(--bg-secondary)]/40'
                                } ${rowCustomClass}`}
                              >
                                {visibleCols.map((col) => {
                                  const alignClass = getColAlignmentClass(col);
                                  const customClass = typeof col.className === 'function' ? col.className(row) : col.className || '';
                                  return (
                                    <td
                                      key={col.id}
                                      className={`px-4 py-2.5 text-xs text-[var(--text-primary)] ${alignClass} ${customClass}`}
                                    >
                                      {renderCellContent(col, row, rIdx, sIdx)}
                                    </td>
                                  );
                                })}
                              </tr>
                              {renderExpandedRow && isExpanded && (
                                <tr className="bg-[var(--bg-secondary)]/30 border-b border-[var(--border)]">
                                  <td colSpan={visibleCols.length} className="p-0">
                                    {renderExpandedRow(row, rIdx, sIdx)}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* Section Subtotal Row */}
                      {section.subtotal && (() => {
                        const colSpan = resolveColSpanLabel(section.subtotal);
                        return (
                          <tr className={`border-b-2 border-[var(--border)] bg-[var(--bg-secondary)]/40 font-semibold text-xs ${section.subtotal.className || ''}`}>
                            <td
                              colSpan={colSpan}
                              className="px-4 py-2.5 text-[var(--text-secondary)] uppercase tracking-wider"
                            >
                              {section.subtotal.label || tCommon('totals')}
                            </td>
                            {visibleCols.slice(colSpan).map((col) => {
                              const alignClass = getColAlignmentClass(col);
                              return (
                                <td key={col.id} className={`px-4 py-2.5 text-[var(--text-primary)] ${alignClass}`}>
                                  {section.subtotal?.values[col.id] ?? null}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })()}
                    </>
                  )}
                </React.Fragment>
              ))
            ) : data && data.length > 0 ? (
              data.map((row, rIdx) => {
                const rowKey = keyExtractor(row, rIdx);
                const isExpanded = isRowExpanded?.(row, rIdx);
                const rowCustomClass = typeof rowClassName === 'function' ? rowClassName(row, rIdx) : rowClassName || '';
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      onClick={onRowClick ? () => onRowClick(row, rIdx) : undefined}
                      className={`border-b border-[var(--border)] transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-[var(--bg-hover)] select-none' : 'hover:bg-[var(--bg-secondary)]/40'
                      } ${rowCustomClass}`}
                    >
                      {visibleCols.map((col) => {
                        const alignClass = getColAlignmentClass(col);
                        const customClass = typeof col.className === 'function' ? col.className(row) : col.className || '';
                        return (
                          <td
                            key={col.id}
                            className={`px-4 py-2.5 text-xs text-[var(--text-primary)] ${alignClass} ${customClass}`}
                          >
                            {renderCellContent(col, row, rIdx)}
                          </td>
                        );
                      })}
                    </tr>
                    {renderExpandedRow && isExpanded && (
                      <tr className="bg-[var(--bg-secondary)]/30 border-b border-[var(--border)]">
                        <td colSpan={visibleCols.length} className="p-0">
                          {renderExpandedRow(row, rIdx)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                  {emptyMessage || tCommon('grid.noRowsToShow')}
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand Totals Footer */}
          {totalRowsList.length > 0 && !loading && (
            <tfoot>
              {totalRowsList.map((tot, tIdx) => {
                const colSpan = resolveColSpanLabel(tot);
                return (
                  <tr
                    key={tIdx}
                    className={`border-t-2 border-[var(--border)] bg-[var(--bg-secondary)] font-bold text-xs uppercase tracking-wider ${tot.className || ''}`}
                  >
                    <td colSpan={colSpan} className="px-4 py-3 text-[var(--text-secondary)]">
                      {tot.label || tCommon('totals')}
                    </td>
                    {visibleCols.slice(colSpan).map((col) => {
                      const alignClass = getColAlignmentClass(col);
                      return (
                        <td key={col.id} className={`px-4 py-3 text-[var(--text-primary)] ${alignClass}`}>
                          {tot.values[col.id] ?? null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}) as <T>(props: FinancialTableProps<T> & { ref?: React.Ref<FinancialTableHandle> }) => React.ReactElement | null;

export default FinancialTable;
