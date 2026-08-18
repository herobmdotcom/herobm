'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { tDynamic } from '../../lib/i18n';

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actor: string;
  createdOn: string;
}

function EventIcon({ type }: { type: string }) {
  const typeLower = (type || '').toLowerCase();

  // Common emoji mappings
  if (typeLower.includes('warning') || typeLower.includes('discrepancy')) return <span>⚠️</span>;
  if (typeLower.includes('receive') || typeLower.includes('reception')) return <span>📥</span>;
  if (typeLower.includes('shipment')) return <span>🚚</span>;
  if (typeLower.includes('picking')) return <span>📦</span>;
   
  if (typeLower.includes('return')) return <span aria-hidden>↩️</span>;
  if (typeLower.includes('auto_status')) return <span>⚡</span>;
  if (typeLower.includes('price')) return <span>💰</span>;
  if (typeLower.includes('stock') || typeLower.includes('inventory')) return <span>🏢</span>;
  if (typeLower.includes('credit') || typeLower.includes('debit')) return <span>💳</span>;
  if (typeLower.includes('invoice')) return <span>🧾</span>;
  if (typeLower.includes('payment')) return <span>💳</span>;
  if (typeLower.includes('import')) return <span>📥</span>;
  if (typeLower.includes('email')) return <span>✉️</span>;

  const icons: Record<string, string> = {
    created: '🆕',
    updated: '✏️',
    status_changed: '🔄',
    line_added: '➕',
    post_confirmation_line_added: '➕',
    line_updated: '📝',
    line_removed: '🗑️',
    quoted: '📨',
    confirmed: '✅',
    cancelled: '❌',
    processed: '✅',
    shipped: '🚚',
    picked: '📦',
  };
  return <span>{icons[typeLower] || '📌'}</span>;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  title?: string;
  emptyMessage?: string;
  defaultOpen?: boolean;
}

export default function ActivityTimeline({
  events,
  title,
  emptyMessage,
  defaultOpen = false,
}: ActivityTimelineProps) {
  const t = useTranslations('common');
  const displayTitle = title || t('activityTimeline');
  const displayEmptyMessage = emptyMessage || t('noEvents');
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    const handleBeforePrint = () => {
      // Imperatively open the details element — this is synchronous and
      // guaranteed to be visible to the print engine, unlike setState.
      if (detailsRef.current) {
        detailsRef.current.setAttribute('open', '');
      }
    };
    const handleAfterPrint = () => {
      // Restore the original state after printing
      if (detailsRef.current && !defaultOpen) {
        detailsRef.current.removeAttribute('open');
      }
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [defaultOpen]);

  if (!events || events.length === 0) {
    return (
      <div>
        <h3 className="section-heading mb-4">
          {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
          <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">history</span> {displayTitle}
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          {displayEmptyMessage}
        </p>
      </div>
    );
  }

  return (
    <details ref={detailsRef} open={defaultOpen || undefined}>
      <summary className="section-heading cursor-pointer select-none mb-0 list-none">
        <span className="details-chevron text-[10px] transition-transform duration-200">▶</span>
        {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
        <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">history</span> {displayTitle}
        <span className="text-[11px] font-normal lowercase tracking-normal">({events.length})</span>
      </summary>
      <div className="space-y-3 mt-4">
        {events.map((event) => {
          const hasPayload = event.payload && Object.keys(event.payload).length > 0;
          const displayType = (event.payload?.action as string) || event.eventType;
          
          return (
            <details
              key={event.eventId}
              className="text-sm py-1.5 px-3 rounded-lg bg-black/[0.02] border border-[var(--border)]"
            >
              <summary
                className={`flex items-center gap-3 select-none list-none ${hasPayload ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <EventIcon type={displayType} />
                <span className="font-semibold capitalize">
                  {displayType.replace(/_/g, ' ')}
                </span>
                <span className="text-[var(--text-muted)] text-[11px]">
                  {tDynamic(t, 'timeline.by', undefined, { actor: event.actor })}
                </span>
                <span className="ml-auto text-xs whitespace-nowrap text-[var(--text-muted)]">
                  {new Date(event.createdOn).toLocaleString()}
                </span>
                {hasPayload && (
                  <span className="text-[var(--text-muted)] text-[10px]">▶</span>
                )}
              </summary>
              {hasPayload && (
                <div className="mt-2 text-xs grid gap-y-1 ml-7 text-[var(--text-secondary)]">
                  {Object.entries(event.payload)
                    .filter(([key]) => {
                      if (key.endsWith('Name')) {
                        const idKey = key.replace(/Name$/, 'Id');
                        return !(idKey in event.payload!);
                      }
                      return true;
                    })
                    .map(([key, value]) => {
                      const displayKey = tDynamic(t, `timeline.keys.${key}`, key);
                      let displayValue: React.ReactNode = String(value ?? '—');
                      
                      // Auto-link Entity IDs if we have a name in the payload
                      if (key.endsWith('Id')) {
                        const entityType = key.replace(/Id$/, '');
                        const nameKey = `${entityType}Name`;
                        const nameVal = event.payload![nameKey] as string | undefined;
                        
                        if (nameVal && typeof value === 'string') {
                          const routeMap: Record<string, string> = {
                            customer: '/customers',
                            supplier: '/suppliers',
                            vendor: '/suppliers',
                            product: '/products',
                            salesOrder: '/sales-orders',
                            purchaseOrder: '/purchase-orders',
                            invoice: '/sales-invoices',
                            salesInvoice: '/sales-invoices',
                            supplierInvoice: '/supplier-invoices',
                            salesReturn: '/sales-returns',
                            purchaseReturn: '/purchase-orders/returns',
                            creditNote: '/sales-credit-notes',
                            debitNote: '/purchase-debit-notes',
                            quote: '/sales-quotes',
                            project: '/crm/projects',
                            actor: '/crm/actors',
                            contact: '/crm/contacts',
                            workOrder: '/manufacturing/work-orders',
                            transferOrder: '/inventory/transfers',
                            shipment: '/shipments',
                            opportunity: '/crm/opportunities',
                          };
                          
                          const route = routeMap[entityType];
                          if (route) {
                            const href = `${route}/${value}`;
                            displayValue = (
                              <a href={href} className="text-[var(--accent)] hover:underline">
                                {nameVal}
                              </a>
                            );
                          } else {
                            displayValue = nameVal;
                          }
                        }
                      }
                      
                      return (
                        <div key={key} className="flex gap-2">
                          <span className="text-[var(--text-muted)] min-w-[100px] font-medium">
                            {displayKey}
                          </span>
                          <span className="tabular-nums">
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </details>
  );
}
