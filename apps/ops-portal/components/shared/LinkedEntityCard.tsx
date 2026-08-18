'use client';

import React from 'react';
import Link from 'next/link';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';

export interface LinkedEntityCardProps {
  /** Optional icon name (Material Symbols font ligature, e.g. 'receipt_long', 'inventory_2', 'assignment_return') */
  icon?: string;
  /** Custom icon node if not using standard Material Symbol string */
  iconElement?: React.ReactNode;
  /** Primary identifier / title (e.g. invoiceNumber, returnNumber, shipmentNumber) */
  title: React.ReactNode;
  /** Destination route URL */
  href?: string;
  /**
   * Subtitle text or array of metadata items.
   * If an array is provided, truthy items will be joined with ' · '.
   */
  subtitle?: React.ReactNode | (React.ReactNode | string | number | null | undefined | false)[];
  /** Formatted primary amount to display on the right (e.g. formatted currency amount) */
  amount?: React.ReactNode;
  /** Sub-text below amount (e.g. Tax, Subtotal) */
  amountSubtext?: React.ReactNode;
  /** State code (string) or custom badge node */
  status?: string | React.ReactNode;
  /** Action buttons / controls on the right (e.g. Email button, Unlink button) */
  actions?: React.ReactNode;
  /** Additional custom content below the main row (e.g. warning banners, notes) */
  children?: React.ReactNode;
  /** Additional container styling class */
  className?: string;
  /** Optional click handler when card is actionable without an href */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Optional data-testid for testing */
  testId?: string;
}

/**
 * Standardized card row component for rendering linked entity references
 * (Invoices, Shipments, Returns, Credit/Debit Notes, etc.) in detail workflows.
 */
export default function LinkedEntityCard({
  icon,
  iconElement,
  title,
  href,
  subtitle,
  amount,
  amountSubtext,
  status,
  actions,
  children,
  className = '',
  onClick,
  testId,
}: LinkedEntityCardProps) {
  const isInteractive = Boolean(href || onClick);
  const hasActions = Boolean(actions);

  const renderedSubtitle = React.useMemo(() => {
    if (!subtitle) return null;
    if (Array.isArray(subtitle)) {
      const items = subtitle.filter(
        (item) => item !== null && item !== undefined && item !== false && item !== '',
      );
      if (items.length === 0) return null;
      const allPrimitives = items.every((i) => typeof i === 'string' || typeof i === 'number');
      if (allPrimitives) {
        return items.join(' · ');
      }
      return (
        <span className="truncate">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="mx-1 text-[var(--text-muted)]">·</span>}
              {item}
            </React.Fragment>
          ))}
        </span>
      );
    }
    return subtitle;
  }, [subtitle]);

  const renderedStatus = React.useMemo(() => {
    if (!status) return null;
    if (typeof status === 'string') {
      return <StateBadge state={status as ValidState} />;
    }
    return status;
  }, [status]);

  const iconNode = iconElement || (icon ? (
    <span className="material-symbols-outlined text-[var(--accent)] text-lg shrink-0 select-none">
      {icon}
    </span>
  ) : null);

  const rightSection = (
    <div className="flex items-center gap-3 shrink-0 ml-3">
      {(amount || amountSubtext) && (
        <div className="text-right">
          {amount && (
            <div className="font-semibold text-sm text-[var(--text-primary)] tabular-nums">
              {amount}
            </div>
          )}
          {amountSubtext && (
            <div className="text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
              {amountSubtext}
            </div>
          )}
        </div>
      )}
      {renderedStatus}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );

  const baseCardClasses = `p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] transition-colors ${
    isInteractive ? 'hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)]/40 group' : ''
  } ${className}`.trim();

  // Mode 1: Whole-card Link (when href is provided and no internal action buttons exist)
  if (href && !hasActions && !children) {
    return (
      <Link
        href={href}
        className={`flex items-center justify-between no-underline text-inherit cursor-pointer ${baseCardClasses}`}
        data-testid={testId}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {iconNode}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
              {title}
            </div>
            {renderedSubtitle && (
              <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                {renderedSubtitle}
              </div>
            )}
          </div>
        </div>
        {rightSection}
      </Link>
    );
  }

  // Mode 2: Card with internal Link on left section (avoids invalid nested <a>/<button> when actions exist)
  return (
    <div
      className={baseCardClasses}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        {href ? (
          <Link
            href={href}
            className="flex items-center gap-3 flex-1 min-w-0 no-underline text-inherit group/link cursor-pointer"
          >
            {iconNode}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-[var(--text-primary)] group-hover/link:text-[var(--accent)] transition-colors truncate">
                {title}
              </div>
              {renderedSubtitle && (
                <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                  {renderedSubtitle}
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {iconNode}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                {title}
              </div>
              {renderedSubtitle && (
                <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                  {renderedSubtitle}
                </div>
              )}
            </div>
          </div>
        )}

        {rightSection}
      </div>

      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
