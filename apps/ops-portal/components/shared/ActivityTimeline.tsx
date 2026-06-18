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

export function EventIcon({ type }: { type: string }) {
  const tCommon = useTranslations('common.eventTypes');
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
  if (typeLower.includes('invoice')) return <span>🧾</span>;
  if (typeLower.includes('payment')) return <span>💳</span>;

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
        <h3
          className="text-sm font-semibold mb-4"
          style={{
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>history</span> {displayTitle}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {displayEmptyMessage}
        </p>
      </div>
    );
  }

  return (
    <details ref={detailsRef} open={defaultOpen || undefined}>
      <summary
        className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2"
        style={{
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          listStyle: 'none',
        }}
      >
        <span className="details-chevron" style={{ fontSize: 10, transition: 'transform 200ms' }}>▶</span>
        {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>history</span> {displayTitle}
        <span style={{ fontSize: 11, fontWeight: 400 }}>({events.length})</span>
      </summary>
      <div className="space-y-3" style={{ marginTop: 16 }}>
        {events.map((event) => {
          const hasPayload = event.payload && Object.keys(event.payload).length > 0;
          return (
            <details
              key={event.eventId}
              className="text-sm"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.02)',
                border: '1px solid var(--border)',
              }}
            >
              <summary
                className="flex items-center gap-3"
                style={{ cursor: hasPayload ? 'pointer' : 'default', userSelect: 'none', listStyle: 'none' }}
              >
                <EventIcon type={event.eventType} />
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {tDynamic(t, `eventTypes.${event.eventType}`)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {tDynamic(t, 'timeline.by', undefined, { actor: event.actor })}
                </span>
                <span className="ml-auto text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {new Date(event.createdOn).toLocaleString()}
                </span>
                {hasPayload && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>▶</span>
                )}
              </summary>
              {hasPayload && (
                <div
                  className="mt-2 text-xs grid gap-y-1"
                  style={{ marginLeft: 28, color: 'var(--text-secondary)' }}
                >
                  {Object.entries(event.payload).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span style={{ color: 'var(--text-muted)', minWidth: 100, fontWeight: 500 }}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof value === 'object' && value !== null
                          ? Object.entries(value as Record<string, unknown>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </details>
  );
}
