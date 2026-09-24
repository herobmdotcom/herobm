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
  /** Optional actions footer or buttons to render at the bottom of the card */
  actions?: React.ReactNode;
  /** Optional custom content to render at the bottom of the card */
  children?: React.ReactNode;
  /** Optional additional container class */
  className?: string;
}

export default function MobileLineItemCard({
  title,
  subtitle,
  topRightBadge,
  details,
  actions,
  children,
  className = '',
}: MobileLineItemCardProps) {
  return (
    <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col gap-3 mb-3 ${className}`}>
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-[var(--accent)] min-w-0 break-words">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[var(--text-muted)] font-medium mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {topRightBadge && (
          <div className="shrink-0">
            {typeof topRightBadge === 'string' || typeof topRightBadge === 'number' ? (
              <span className="text-xs font-mono font-medium text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[var(--border)]">
                {topRightBadge}
              </span>
            ) : (
              topRightBadge
            )}
          </div>
        )}
      </div>
      
      {details && details.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
          {details.map((detail, idx) => (
            <div key={idx} className="flex justify-between items-start gap-4 text-[13px]">
              <span className="text-xs font-medium text-[var(--text-muted)] shrink-0">
                {detail.label}
              </span>
              <div className={`text-[13px] font-medium text-right min-w-0 flex-1 break-words ${detail.isHighlighted ? "font-bold text-[var(--accent)] text-base" : "text-[var(--text-primary)]"}`}>
                {detail.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div className="pt-2 border-t border-[var(--border)]">
          {children}
        </div>
      )}

      {actions && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
          {actions}
        </div>
      )}
    </div>
  );
}
