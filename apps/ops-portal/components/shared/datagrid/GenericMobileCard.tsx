import React, { useState } from "react";
import { type ColDef } from "ag-grid-community";
import { getCellValue } from "./DataGridFormatters";

import { useTranslations } from "next-intl";

export function GenericMobileCard<T>({ 
  row, 
  columns, 
  onRowClicked,
  selectable,
  selected,
  onToggleSelect
}: { 
  row: T; 
  columns: ColDef<T>[]; 
  onRowClicked?: (row: T, event?: React.MouseEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("common");
  const visibleCols = columns.filter(c => !c.hide);
  if (visibleCols.length === 0) return null;

  const primaryCol = visibleCols[0];
  const primaryVal = getCellValue(primaryCol, row);

  const secondaryCol = visibleCols.length > 1 ? visibleCols[1] : null;
  const secondaryVal = secondaryCol ? getCellValue(secondaryCol, row) : null;

  const restCols = visibleCols.slice(2);
  let validRestCols = restCols.map(col => ({ col, val: getCellValue(col, row) }));
  
  if (onRowClicked) {
    validRestCols = validRestCols.filter(item => item.val != null && item.val !== '');
  } else {
    validRestCols = validRestCols.map(item => {
      if (item.val == null || item.val === '') item.val = <span className="text-slate-300">—</span>;
      return item;
    });
  }

  const displayLimit = 3;
  const isTruncated = validRestCols.length > displayLimit;
  const displayedCols = expanded ? validRestCols : validRestCols.slice(0, displayLimit);

  return (
    <div 
      className={`p-4 bg-white rounded-xl -[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200 flex flex-col gap-3 transition-transform ${onRowClicked ? 'cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={(e) => onRowClicked?.(row, e)}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-[13px] text-slate-500 font-medium whitespace-nowrap mb-0.5">{primaryVal as React.ReactNode}</div>
          <div className="text-[11px] text-slate-400 max-w-[200px] truncate">{secondaryVal as React.ReactNode}</div>
        </div>
        {selectable && (
          <div 
            className="flex items-center justify-center pt-1 shrink-0" 
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            <input 
              type="checkbox" 
              checked={selected || false} 
              readOnly 
              className={`accent-[var(--accent)] w-[18px] h-[18px] ${onToggleSelect ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50'}`}
            />
          </div>
        )}
      </div>
      
      {displayedCols.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
          {displayedCols.map(({col, val}, idx) => (
            <div key={col.field || col.headerName || idx} className="flex justify-between items-start gap-4 text-[13px]">
              <span className="text-slate-500">{col.headerName}</span>
              <span className="font-medium text-[#041627] text-right">{val as React.ReactNode}</span>
            </div>
          ))}
          {isTruncated && (
            <div 
              className="text-[13px] font-bold text-[var(--accent)] mt-1 pt-2 border-t border-slate-50 flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? t('showLess') : t('showMore', { count: validRestCols.length - displayLimit })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
