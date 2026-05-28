/* eslint-disable no-restricted-syntax */
import React from 'react';

export interface DataTableColumn<T> {
  id?: string;
  header: React.ReactNode;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  render?: (row: T, index: number) => React.ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  hidden?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyMessage?: React.ReactNode;
  footer?: React.ReactNode;
  /** Custom render override for a full desktop table row. If provided, `columns` render is ignored for this row. */
  renderCustomRow?: (row: T, index: number, visibleCols: DataTableColumn<T>[]) => React.ReactNode;
  /** Render prop for the mobile card view. If provided, table is hidden on mobile and this is shown. */
  mobileCard?: (row: T, index: number) => React.ReactNode;
  /** Wrapper class for the entire container */
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage,
  footer,
  renderCustomRow,
  mobileCard,
  className = '',
}: DataTableProps<T>) {
  const visibleCols = columns.filter((c) => !c.hidden);

  return (
    <div className={className}>
      {/* Desktop Table View */}
      <div className={`${mobileCard ? 'hidden lg:block' : ''} overflow-x-auto w-full`}>
        <table className="table-lines w-full">
          <thead>
            <tr>
              {visibleCols.map((col, i) => (
                <th key={col.id || i} style={{ width: col.width, textAlign: col.align }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              if (renderCustomRow) {
                return <React.Fragment key={keyExtractor(row, i)}>{renderCustomRow(row, i, visibleCols)}</React.Fragment>;
              }

              return (
                <tr key={keyExtractor(row, i)}>
                  {visibleCols.map((col, j) => {
                    let content: React.ReactNode = null;
                    if (col.render) {
                      content = col.render(row, i);
                    } else if (col.accessor) {
                      content = typeof col.accessor === 'function' ? col.accessor(row) : String(row[col.accessor as keyof T] as unknown);
                    }
                    
                    return (
                      <td key={col.id || j} style={{ textAlign: col.align }}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={visibleCols.length}
                  style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                >
                  {emptyMessage || 'No items'}
                </td>
              </tr>
            )}
            
            {footer}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      {mobileCard && (
        <div className="lg:hidden flex flex-col gap-3 w-full">
          {data.length === 0 ? (
            <div className="text-center text-slate-500 py-4 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
              {emptyMessage || 'No items'}
            </div>
          ) : (
            data.map((row, i) => <React.Fragment key={keyExtractor(row, i)}>{mobileCard(row, i)}</React.Fragment>)
          )}
          {footer && (
            <div className="mt-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-3">
              <table className="w-full text-sm">
                <tbody>
                  {footer}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 
 * Helper component to render a consistent key-value row inside a Mobile Card 
 */
export function MobileCardField({ label, value, className = '' }: { label: React.ReactNode, value: React.ReactNode, className?: string }) {
  return (
    <div className={`flex justify-between items-start gap-4 py-1.5 border-b border-slate-100 last:border-0 ${className}`}>
      <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
      <div className="text-sm font-medium text-right text-slate-700 min-w-0 flex-1 break-words">{value}</div>
    </div>
  );
}
