import React from "react";
import { type ColDef } from "ag-grid-community";

/** Format numbers: integers stay as integers, decimals get 2 places */
export function numericFormatter(params: { value: unknown }) {
  if (params.value == null) return "";
  const n = Number(params.value);
  if (isNaN(n)) return String(params.value);
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

export function getCellValue<T>(col: ColDef<T>, row: T) {
  let rawValue = col.field ? (row as Record<string, unknown>)[col.field] : undefined;
  if (col.valueGetter) {
    if (typeof col.valueGetter === 'function') {
      rawValue = col.valueGetter({ data: row, getValue: () => undefined } as never);
    }
  }

  let formattedValue = rawValue;
  if (col.valueFormatter) {
    if (typeof col.valueFormatter === 'function') {
      formattedValue = col.valueFormatter({ value: rawValue, data: row } as never);
    }
  }

  if (col.cellRenderer) {
    if (typeof col.cellRenderer === 'function') {
      const Renderer = col.cellRenderer as React.ElementType;
      return <Renderer value={rawValue} data={row} />;
    }
  }

  return formattedValue ?? rawValue;
}

export function getExportValue<T>(col: ColDef<T>, row: T) {
  let rawValue = col.field ? (row as Record<string, unknown>)[col.field] : undefined;
  if (col.valueGetter && typeof col.valueGetter === 'function') {
    rawValue = col.valueGetter({ data: row, getValue: () => undefined } as never);
  }
  let formattedValue = rawValue;
  if (col.valueFormatter && typeof col.valueFormatter === 'function') {
    formattedValue = col.valueFormatter({ value: rawValue, data: row } as never);
  }
  return formattedValue ?? rawValue;
}
