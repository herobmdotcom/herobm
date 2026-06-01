import React from 'react';

export interface MobileLineItemCardDetail {
  label: React.ReactNode;
  value: React.ReactNode;
  isHighlighted?: boolean;
}

export interface MobileLineItemCardProps {
  /** Main title, usually the product SKU or Number. Formatted as accent color by default. */
  title: React.ReactNode;
  /** Description or secondary info below the title */
  subtitle?: React.ReactNode;
  /** Renders in a badge style on the top right, e.g. "#1" */
  topRightBadge?: React.ReactNode;
  /** Array of key-value pairs to display in a list format */
  details?: MobileLineItemCardDetail[];
  /** Optional custom content to render at the bottom of the card */
  children?: React.ReactNode;
}

export default function MobileLineItemCard({
  title,
  subtitle,
  topRightBadge,
  details,
  children,
}: MobileLineItemCardProps) {
  
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col mb-3">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="font-semibold text-sm text-[var(--accent)] min-w-0 break-words">
          {title}
        </div>
        {topRightBadge && (
          <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">
            {topRightBadge}
          </div>
        )}
      </div>
      
      {subtitle && (
        <div className="text-sm text-slate-600 font-medium mb-3">
          {subtitle}
        </div>
      )}
      
      {details && details.length > 0 && (
        <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
          {details.map((detail, idx) => (
            <div key={idx} className="flex justify-between items-start gap-4 py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {detail.label}
              </span>
              <div className={`text-sm font-medium text-right min-w-0 flex-1 break-words ${detail.isHighlighted ? "font-bold text-[var(--accent)] text-base" : "text-slate-700"}`}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
